import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.ts';
import { EncryptedDatabase } from '../server/db.ts';
import {
  hasXXEPayload,
  sanitizeRecordDeep,
  sanitizeSpreadsheetCell,
  sanitizeText,
  validateSpreadsheetUpload,
} from '../src/utils/security.ts';

interface AuditCheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: AuditCheckResult[] = [];

async function runCheck(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ name, passed: true, detail: 'OK' });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, detail });
    console.error(`[FAIL] ${name}: ${detail}`);
  }
}

function walkFiles(dir: string, exts: string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

function extractSessionCookie(setCookieHeaders: string[]): string | null {
  for (const h of setCookieHeaders) {
    const first = h.split(';')[0];
    if (first.startsWith('cerec_session=')) return first;
  }
  return null;
}

async function main() {
  console.log('=== AUDIT DE SÉCURITÉ AUTOMATISÉ — GROUPE CEREC-ISCOM ===\n');

  // 1. Static checks: secrets, vulnerable dependencies, unsafe sinks
  await runCheck('1. Absence de clés API / secrets / mots de passe en clair côté client', () => {
    const srcFiles = walkFiles(path.resolve(process.cwd(), 'src'), ['.ts', '.tsx', '.js']);
    const forbiddenPatterns = [
      /GEMINI_API_KEY/,
      /SESSION_SECRET/,
      /DB_ENCRYPTION_KEY/,
      /defaultPassword/,
      /AIza[0-9A-Za-z\-_]{30,}/,
      /dangerouslySetInnerHTML/,
      /eval\(/,
    ];
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pat of forbiddenPatterns) {
        assert.equal(
          pat.test(content),
          false,
          `Motif interdit (${pat}) trouvé dans ${path.relative(process.cwd(), file)}`
        );
      }
    }

    const distAssets = walkFiles(path.resolve(process.cwd(), 'dist'), ['.js', '.html']);
    for (const file of distAssets) {
      const content = fs.readFileSync(file, 'utf8');
      assert.equal(
        /GEMINI_API_KEY|SESSION_SECRET|DB_ENCRYPTION_KEY|AIza[0-9A-Za-z\-_]{30,}/.test(content),
        false,
        `Secret détecté dans le bundle compilé ${path.relative(process.cwd(), file)}`
      );
    }
  });

  await runCheck('2. Suppression de la dépendance vulnérable xlsx (SheetJS)', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')
    ) as { dependencies?: Record<string, string> };
    assert.equal(pkg.dependencies?.xlsx, undefined, 'xlsx ne doit plus être présent.');
    assert.ok(pkg.dependencies?.['read-excel-file'], 'read-excel-file requis.');
    assert.ok(pkg.dependencies?.['write-excel-file'], 'write-excel-file requis.');
    assert.ok(pkg.dependencies?.helmet, 'helmet requis.');
    assert.ok(pkg.dependencies?.dompurify, 'dompurify requis.');
  });

  await runCheck('3. Protection .gitignore et absence de persistance localStorage sensible', () => {
    const gitignore = fs.readFileSync(path.resolve(process.cwd(), '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('.env'), '.gitignore doit exclure .env');
    assert.ok(gitignore.includes('data/'), '.gitignore doit exclure data/');

    const appTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    assert.equal(
      /localStorage\.setItem/.test(appTsx),
      false,
      'App.tsx ne doit plus stocker la base ou la session dans localStorage.'
    );
  });

  // 2. Unit tests: XSS, XXE, Prototype Pollution, CSV Injection
  await runCheck('4. Neutralisation XSS (scripts, balises, URIs javascript:)', () => {
    const xss1 = sanitizeText('<script>alert("xss")</script>Jean <img src=x onerror=alert(1)>');
    assert.equal(xss1.includes('<script'), false);
    assert.equal(xss1.includes('onerror'), false);
    assert.ok(xss1.includes('Jean'));

    const xss2 = sanitizeText('javascript:alert(document.cookie)');
    assert.equal(xss2.toLowerCase().includes('javascript:'), false);
  });

  await runCheck('5. Protection XXE (XML External Entity) & Validation binaire OOXML', () => {
    const xxePayload =
      '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><x>&xxe;</x>';
    assert.equal(hasXXEPayload(xxePayload), true);

    assert.throws(
      () => validateSpreadsheetUpload('piege.xlsx', new TextEncoder().encode(xxePayload).buffer),
      /signature binaire ZIP\/OOXML/i
    );
    assert.throws(
      () => validateSpreadsheetUpload('piege.csv', new TextEncoder().encode(xxePayload).buffer),
      /XML\/XXE/i
    );
  });

  await runCheck('6. Protection Prototype Pollution & Injection de formules Excel/CSV', () => {
    const malicious = JSON.parse(
      '{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"hacked":true}},"nom":"<b>Kouba</b>"}'
    );
    const cleaned = sanitizeRecordDeep(malicious) as Record<string, unknown>;
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
    assert.equal(({} as Record<string, unknown>).hacked, undefined);
    assert.equal(cleaned.nom, 'Kouba');

    assert.equal(sanitizeSpreadsheetCell("=CMD|'/C calc'!A0"), "'=CMD|'/C calc'!A0");
    assert.equal(sanitizeSpreadsheetCell('+2+5'), "'+2+5");
    assert.equal(sanitizeSpreadsheetCell('-12.5'), '-12.5');
  });

  // 3. Integration tests against live Express app + AES-256-GCM EncryptedDatabase
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cerec-security-audit-'));
  let server: http.Server | null = null;

  try {
    const { app, db } = await createApp({ dataDir: tempDir, attachVite: false });

    // Generate ephemeral runtime passwords strictly in memory for audit HTTP checks
    const adminPassword = db.rotateUserPassword('admin@cerec-iscom.cg', 'audit', '127.0.0.1');
    const dgPassword = db.rotateUserPassword('dg@cerec-iscom.cg', 'audit', '127.0.0.1');
    const scolPassword = db.rotateUserPassword('scolarite@cerec-iscom.cg', 'audit', '127.0.0.1');
    assert.ok(adminPassword && dgPassword && scolPassword);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server!.address();
    assert.ok(addr && typeof addr !== 'string');
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    await runCheck('7. Chiffrement AES-256-GCM de la base de données & détection d’altération', () => {
      const dbFile = db.getDbPath();
      const raw = fs.readFileSync(dbFile, 'utf8');
      const parsed = JSON.parse(raw) as { v: number; alg: string; iv: string; tag: string; ciphertext: string };
      assert.equal(parsed.v, 1);
      assert.equal(parsed.alg, 'aes-256-gcm');
      assert.equal(raw.includes('cerec-iscom.cg'), false, 'Aucune donnée en clair sur disque.');

      // Tamper copy and verify GCM authTag rejects modification
      const tamperDir = path.join(tempDir, 'tamper-test');
      fs.mkdirSync(tamperDir, { recursive: true });
      fs.copyFileSync(path.join(tempDir, '.server-keys.json'), path.join(tamperDir, '.server-keys.json'));
      const tampered = {
        ...parsed,
        ciphertext: Buffer.from('tampered-ciphertext').toString('base64'),
      };
      fs.writeFileSync(path.join(tamperDir, 'cerec-db.enc.json'), JSON.stringify(tampered));
      assert.throws(() => new EncryptedDatabase(tamperDir));
    });

    await runCheck('8. En-têtes de sécurité HTTP (CSP, nosniff, Referrer-Policy, sans X-Powered-By)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      assert.equal(res.headers.get('x-powered-by'), null);
      const csp = res.headers.get('content-security-policy') ?? '';
      assert.ok(csp.includes("object-src 'none'"));
      assert.ok(csp.includes('frame-ancestors'));
    });

    await runCheck('9. Blocage des requêtes non authentifiées et des charges XXE sur /api', async () => {
      const unauth = await fetch(`${baseUrl}/api/state`);
      assert.equal(unauth.status, 401);

      const xxeAttempt = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>',
          password: 'test',
        }),
      });
      assert.equal(xxeAttempt.status, 400);
    });

    await runCheck('10. Contrôle d’accès DG (lecture seule stricte + cookie HttpOnly)', async () => {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'dg@cerec-iscom.cg', password: dgPassword }),
      });
      assert.equal(loginRes.status, 200);
      const setCookies = loginRes.headers.getSetCookie?.() ?? [];
      assert.ok(setCookies.some((c) => c.includes('HttpOnly')), 'Cookie HttpOnly obligatoire.');
      const cookie = extractSessionCookie(setCookies);
      assert.ok(cookie);
      const loginData = (await loginRes.json()) as { csrfToken: string };

      const stateRes = await fetch(`${baseUrl}/api/state`, {
        headers: { Cookie: cookie },
      });
      assert.equal(stateRes.status, 200);
      const stateJson = (await stateRes.json()) as { state: Record<string, unknown> };

      const writeAttempt = await fetch(`${baseUrl}/api/state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
          'X-CSRF-Token': loginData.csrfToken,
        },
        body: JSON.stringify({ activeRole: 'dg', state: stateJson.state }),
      });
      assert.equal(writeAttempt.status, 403);

      const auditRes = await fetch(`${baseUrl}/api/security/audit`, {
        headers: { Cookie: cookie },
      });
      assert.equal(auditRes.status, 200);
    });

    await runCheck('11. Cloisonnement RBAC, protection CSRF & assainissement écriture API', async () => {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'scolarite@cerec-iscom.cg', password: scolPassword }),
      });
      assert.equal(loginRes.status, 200);
      const cookie = extractSessionCookie(loginRes.headers.getSetCookie?.() ?? []);
      assert.ok(cookie);
      const { csrfToken } = (await loginRes.json()) as { csrfToken: string };

      // Scolarité must not receive Caisse payments or Admin audit log
      const stateRes = await fetch(`${baseUrl}/api/state`, { headers: { Cookie: cookie } });
      assert.equal(stateRes.status, 200);
      const { state } = (await stateRes.json()) as {
        state: { payments: unknown[]; students: Record<string, unknown>[] };
      };
      assert.equal(state.payments.length, 0, 'Paiements masqués pour la Scolarité.');

      const forbiddenAudit = await fetch(`${baseUrl}/api/security/audit`, {
        headers: { Cookie: cookie },
      });
      assert.equal(forbiddenAudit.status, 403);

      // Missing CSRF token must be rejected
      const noCsrf = await fetch(`${baseUrl}/api/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ activeRole: 'scolarite', state }),
      });
      assert.equal(noCsrf.status, 403);

      // Valid CSRF + XSS payload in student name must be stripped before encrypted storage
      const injectedStudent = {
        ...state.students[0],
        nom: '<script>alert(1)</script>Malonga',
      };
      const putRes = await fetch(`${baseUrl}/api/state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          activeRole: 'scolarite',
          state: { ...state, students: [injectedStudent, ...state.students.slice(1)] },
        }),
      });
      assert.equal(putRes.status, 200);
      const updated = (await putRes.json()) as {
        state: { students: { nom: string }[] };
      };
      assert.equal(updated.state.students[0].nom, 'Malonga');
    });

    await runCheck('12. Rotation de mot de passe Admin & Limitation anti-brute-force (429)', async () => {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@cerec-iscom.cg', password: adminPassword }),
      });
      assert.equal(loginRes.status, 200);
      const cookie = extractSessionCookie(loginRes.headers.getSetCookie?.() ?? []);
      assert.ok(cookie);
      const { csrfToken } = (await loginRes.json()) as { csrfToken: string };

      const rotateRes = await fetch(`${baseUrl}/api/auth/rotate-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ email: 'enseignant@cerec-iscom.cg' }),
      });
      assert.equal(rotateRes.status, 200);
      const rotated = (await rotateRes.json()) as { newPassword: string };
      assert.ok(rotated.newPassword && rotated.newPassword.length >= 10);

      // Brute force lock after 10 failures from distinct client IP
      const attackerIp = '198.51.100.99';
      for (let i = 0; i < 10; i++) {
        const failRes = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': attackerIp,
          },
          body: JSON.stringify({ email: 'dg@cerec-iscom.cg', password: 'mauvais-mot-de-passe' }),
        });
        assert.equal(failRes.status, 401);
      }
      const blockedRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': attackerIp,
        },
        body: JSON.stringify({ email: 'dg@cerec-iscom.cg', password: dgPassword }),
      });
      assert.equal(blockedRes.status, 429);
    });
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const passed = results.filter((r) => r.passed).length;
  console.log(`\nRésultat global : ${passed}/${results.length} contrôles réussis.`);
  if (passed !== results.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Erreur critique durant l’audit de sécurité:', err);
  process.exit(1);
});
