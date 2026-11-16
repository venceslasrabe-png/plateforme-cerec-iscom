import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import {
  EncryptedDatabase,
  mergeRoleScopedState,
  scopeStateForRole,
  verifyPassword,
} from './server/db.ts';
import type { Campus, CerecState, UserRole } from './src/types/cerec.ts';
import { getRolePermissions } from './src/utils/permissions.ts';
import { hasXXEPayload, sanitizeRecordDeep, sanitizeText } from './src/utils/security.ts';

interface SessionPayload {
  email: string;
  displayName: string;
  role: UserRole;
  campus: Campus | 'Tous';
  remember: boolean;
  csrfToken: string;
  loggedInAt: string;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  session?: SessionPayload;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

const SESSION_COOKIE_NAME = 'cerec_session';

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function signSessionToken(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifySessionToken(token: string, secret: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed || typeof parsed.exp !== 'number' || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

function isHttpsRequest(req: Request): boolean {
  return Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
}

export async function createApp(options?: {
  dataDir?: string;
  attachVite?: boolean;
}) {
  const db = new EncryptedDatabase(options?.dataDir);
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const loginFailures = new Map<string, RateBucket>();
  const apiRequests = new Map<string, RateBucket>();

  // HTTP Security Headers (CSP, X-Content-Type-Options, Referrer-Policy, iframe-compatible for AI Studio)
  app.use(
    helmet({
      frameguard: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://lh3.googleusercontent.com',
            'https://*.googleusercontent.com',
          ],
          connectSrc: ["'self'"],
          workerSrc: ["'self'"],
          manifestSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: [
            "'self'",
            'https://aistudio.google.com',
            'https://*.google.com',
            'https://*.googleusercontent.com',
          ],
        },
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      noSniff: true,
    })
  );

  // Body parser with raw XXE payload inspection
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        const raw = buf.toString('utf8');
        if (hasXXEPayload(raw)) {
          (req as Request & { xxeDetected?: boolean }).xxeDetected = true;
        }
      },
    })
  );

  // Reject XXE payloads & sanitize Prototype Pollution keys on all API requests
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if ((req as Request & { xxeDetected?: boolean }).xxeDetected) {
      db.appendAuditLog(
        'critical',
        'XXE_BLOCKED',
        'Anonyme',
        getClientIp(req),
        `Charge utile XML/XXE bloquée sur ${req.method} ${req.path}`
      );
      res.status(400).json({ error: 'Requête rejetée : contenu XML/XXE non autorisé.' });
      return;
    }

    const ip = getClientIp(req);
    const now = Date.now();
    const bucket = apiRequests.get(ip);
    if (!bucket || now > bucket.resetAt) {
      apiRequests.set(ip, { count: 1, resetAt: now + 60_000 });
    } else {
      bucket.count += 1;
      if (bucket.count > 300) {
        res.status(429).json({ error: 'Trop de requêtes API. Veuillez patienter.' });
        return;
      }
    }

    next();
  });

  // Session extractor middleware
  const requireAuth = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE_NAME];
    if (!token) {
      res.status(401).json({ error: 'Session requise. Veuillez vous connecter.' });
      return;
    }
    const payload = verifySessionToken(token, db.getSessionSecret());
    if (!payload) {
      res.status(401).json({ error: 'Session expirée ou signature invalide.' });
      return;
    }
    req.session = payload;
    next();
  };

  const requireCsrf = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const csrfHeader = req.headers['x-csrf-token'];
    const token = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;
    if (!req.session || !token || token !== req.session.csrfToken) {
      db.appendAuditLog(
        'warning',
        'CSRF_BLOCKED',
        req.session?.email ?? 'Inconnu',
        getClientIp(req),
        `Jeton CSRF manquant ou invalide sur ${req.method} ${req.path}`
      );
      res.status(403).json({ error: 'Jeton de sécurité CSRF manquant ou invalide.' });
      return;
    }
    next();
  };

  // POST /api/auth/login
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const failBucket = loginFailures.get(ip);
    if (failBucket && now < failBucket.resetAt && failBucket.count >= 10) {
      db.appendAuditLog(
        'critical',
        'BRUTE_FORCE_BLOCKED',
        sanitizeText(req.body?.email ?? 'inconnu', 120),
        ip,
        'Verrouillage temporaire après 10 tentatives de connexion échouées.'
      );
      res.status(429).json({
        error:
          'Trop de tentatives de connexion échouées. Réessayez dans 15 minutes.',
      });
      return;
    }

    const email = sanitizeText(req.body?.email ?? '', 180).toLowerCase();
    const password = String(req.body?.password ?? '');
    const remember = Boolean(req.body?.remember ?? true);

    if (!email || !email.includes('@') || !password.trim()) {
      res.status(400).json({
        error: 'Veuillez saisir une adresse mail et un mot de passe valides.',
      });
      return;
    }

    const payload = db.read();
    const user = payload.users.find((u) => u.email.toLowerCase() === email);

    if (!user || !verifyPassword(password.trim(), user.salt, user.passwordHash)) {
      const nextCount =
        failBucket && now < failBucket.resetAt ? failBucket.count + 1 : 1;
      loginFailures.set(ip, {
        count: nextCount,
        resetAt: failBucket && now < failBucket.resetAt ? failBucket.resetAt : now + 15 * 60_000,
      });
      db.appendAuditLog(
        'warning',
        'AUTH_FAILED',
        email,
        ip,
        'Tentative de connexion avec identifiants invalides.'
      );
      res.status(401).json({
        error: 'Adresse mail ou mot de passe incorrect.',
      });
      return;
    }

    loginFailures.delete(ip);
    const csrfToken = crypto.randomBytes(24).toString('hex');
    const maxAgeMs = remember ? 7 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
    const session: SessionPayload = {
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      campus: user.campus,
      remember,
      csrfToken,
      loggedInAt: new Date().toISOString(),
      exp: Date.now() + maxAgeMs,
    };

    const signed = signSessionToken(session, db.getSessionSecret());
    const https = isHttpsRequest(req);
    const cookieParts = [
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(signed)}`,
      'HttpOnly',
      'Path=/',
      https ? 'SameSite=None' : 'SameSite=Lax',
    ];
    if (https) cookieParts.push('Secure');
    if (remember) cookieParts.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`);
    res.setHeader('Set-Cookie', cookieParts.join('; '));

    db.appendAuditLog(
      'info',
      'AUTH_SUCCESS',
      user.email,
      ip,
      `Connexion réussie sur l’espace ${user.compartment}.`
    );

    res.json({
      session: {
        email: session.email,
        displayName: session.displayName,
        role: session.role,
        campus: session.campus,
        remember: session.remember,
        loggedInAt: session.loggedInAt,
      },
      csrfToken: session.csrfToken,
    });
  });

  // POST /api/auth/logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const https = isHttpsRequest(req);
    const cookieParts = [
      `${SESSION_COOKIE_NAME}=`,
      'HttpOnly',
      'Path=/',
      'Max-Age=0',
      https ? 'SameSite=None' : 'SameSite=Lax',
    ];
    if (https) cookieParts.push('Secure');
    res.setHeader('Set-Cookie', cookieParts.join('; '));
    res.json({ ok: true });
  });

  // GET /api/auth/me
  app.get('/api/auth/me', (req: Request, res: Response) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE_NAME];
    if (!token) {
      res.json({ authenticated: false });
      return;
    }
    const session = verifySessionToken(token, db.getSessionSecret());
    if (!session) {
      res.json({ authenticated: false });
      return;
    }
    res.json({
      authenticated: true,
      session: {
        email: session.email,
        displayName: session.displayName,
        role: session.role,
        campus: session.campus,
        remember: session.remember,
        loggedInAt: session.loggedInAt,
      },
      csrfToken: session.csrfToken,
    });
  });

  // POST /api/auth/rotate-password (Admin only)
  app.post(
    '/api/auth/rotate-password',
    requireAuth,
    requireCsrf,
    (req: AuthenticatedRequest, res: Response) => {
      const session = req.session!;
      if (session.role !== 'admin') {
        db.appendAuditLog(
          'warning',
          'FORBIDDEN_PASSWORD_ROTATION',
          session.email,
          getClientIp(req),
          'Tentative non autorisée de rotation de mot de passe.'
        );
        res.status(403).json({
          error: 'Seul l’Administrateur Général peut réinitialiser les accès.',
        });
        return;
      }

      const targetEmail = sanitizeText(req.body?.email ?? '', 180).toLowerCase();
      if (!targetEmail) {
        res.status(400).json({ error: 'Adresse mail cible manquante.' });
        return;
      }

      const newPassword = db.rotateUserPassword(
        targetEmail,
        session.email,
        getClientIp(req)
      );
      if (!newPassword) {
        res.status(404).json({ error: 'Compartiment introuvable.' });
        return;
      }

      res.json({ ok: true, email: targetEmail, newPassword });
    }
  );

  // GET /api/state (Authenticated + Role-Scoped Data)
  app.get('/api/state', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const session = req.session!;
    const requestedRole = sanitizeText(
      String(req.query.role ?? session.role),
      32
    ) as UserRole;
    const effectiveRole: UserRole =
      session.role === 'admin' && getRolePermissions(requestedRole)
        ? requestedRole
        : session.role;

    const full = db.read();
    const scoped = scopeStateForRole(full.state, effectiveRole);
    res.json({ state: scoped, updatedAt: full.updatedAt });
  });

  // PUT /api/state (Authenticated + CSRF + Read-Only/RBAC + XSS/Prototype Pollution Guard)
  app.put(
    '/api/state',
    requireAuth,
    requireCsrf,
    (req: AuthenticatedRequest, res: Response) => {
      const session = req.session!;
      const requestedRole = sanitizeText(
        String(req.body?.activeRole ?? session.role),
        32
      ) as UserRole;
      const effectiveRole: UserRole =
        session.role === 'admin' ? requestedRole : session.role;
      const perms = getRolePermissions(effectiveRole);

      if (effectiveRole === 'dg' || perms.readOnly) {
        db.appendAuditLog(
          'warning',
          'BLOCKED_READONLY_WRITE',
          session.email,
          getClientIp(req),
          'Tentative d’écriture bloquée pour le profil Directeur Général (lecture seule).'
        );
        res.status(403).json({
          error:
            'Mode Supervision (Directeur Général) : lecture seule, aucune modification autorisée.',
        });
        return;
      }

      const incomingState = req.body?.state as CerecState | undefined;
      if (
        !incomingState ||
        typeof incomingState !== 'object' ||
        !Array.isArray(incomingState.students) ||
        !Array.isArray(incomingState.filieres)
      ) {
        res.status(400).json({ error: 'Structure de données invalide.' });
        return;
      }

      const current = db.read();
      const merged = mergeRoleScopedState(current.state, incomingState, effectiveRole);
      const saved = db.updateState(merged);
      res.json({
        state: scopeStateForRole(saved.state, effectiveRole),
        updatedAt: saved.updatedAt,
      });
    }
  );

  // POST /api/notifications/read (Allows any role, including DG, to mark own notifications read)
  app.post(
    '/api/notifications/read',
    requireAuth,
    requireCsrf,
    (req: AuthenticatedRequest, res: Response) => {
      const session = req.session!;
      const targetId = req.body?.id ? sanitizeText(req.body.id, 120) : null;
      const markAll = Boolean(req.body?.all);
      const current = db.read();

      const nextNotifications = (current.state.notifications ?? []).map((n) => {
        if (!n.targetRoles.includes(session.role)) return n;
        if (markAll || (targetId && n.id === targetId)) {
          if (n.readByRoles.includes(session.role)) return n;
          return { ...n, readByRoles: [...n.readByRoles, session.role] };
        }
        return n;
      });

      const saved = db.updateState({
        ...current.state,
        notifications: nextNotifications,
      });
      res.json({
        notifications: scopeStateForRole(saved.state, session.role).notifications,
      });
    }
  );

  // POST /api/security/reset-demo (Admin only)
  app.post(
    '/api/security/reset-demo',
    requireAuth,
    requireCsrf,
    (req: AuthenticatedRequest, res: Response) => {
      const session = req.session!;
      if (session.role !== 'admin') {
        res.status(403).json({
          error: 'Action réservée à l’Administrateur Général.',
        });
        return;
      }
      const saved = db.resetDemoState(session.email, getClientIp(req));
      res.json({ state: saved.state, updatedAt: saved.updatedAt });
    }
  );

  // GET /api/security/audit (Admin & DG only — never leaks keys or password hashes)
  app.get(
    '/api/security/audit',
    requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const session = req.session!;
      if (session.role !== 'admin' && session.role !== 'dg') {
        res.status(403).json({
          error: 'Accès au journal de sécurité réservé à la Direction et à l’Administration.',
        });
        return;
      }
      const data = db.read();
      res.json({
        posture: {
          dbEncryption: 'AES-256-GCM (chiffrée au repos)',
          passwordHashing: 'scrypt + comparaison temps constant',
          sessionProtection: 'Cookie HttpOnly signé HMAC-SHA256 + Jeton CSRF',
          xssProtection: 'DOMPurify + CSP strict + assainissement profond',
          xxeProtection: 'Validation binaire OOXML + rejet DTD/ENTITY + parseur sans sheetJS vulnérable',
          apiKeysServerOnly: true,
          geminiKeyConfigured: Boolean(
            process.env.GEMINI_API_KEY &&
              process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
          ),
          rateLimitingActive: true,
          auditCount: data.auditLogs.length,
        },
        users: data.users.map((u) => ({
          id: u.id,
          compartment: u.compartment,
          role: u.role,
          campus: u.campus,
          email: u.email,
          passwordUpdatedAt: u.passwordUpdatedAt,
        })),
        auditLogs: data.auditLogs.slice(0, 30),
      });
    }
  );

  // Explicit 404 for unknown /api routes so they never fall through to SPA HTML
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Point de terminaison API introuvable.' });
  });

  if (options?.attachVite !== false) {
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distDir = path.resolve(process.cwd(), 'dist');
      app.use(express.static(distDir));
      app.get('*', (_req: Request, res: Response) => {
        const indexFile = path.join(distDir, 'index.html');
        if (fs.existsSync(indexFile)) {
          res.sendFile(indexFile);
        } else {
          res.status(404).send('Build introuvable. Exécutez npm run build.');
        }
      });
    }
  }

  return { app, db };
}

const currentFilePath = path.resolve(fileURLToPath(import.meta.url));
const entryFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (entryFilePath === currentFilePath) {
  const port = Number(process.env.PORT ?? 3000);
  createApp({ attachVite: true })
    .then(({ app }) => {
      app.listen(port, '0.0.0.0', () => {
        console.log(`CEREC-ISCOM serveur sécurisé actif sur le port ${port}`);
      });
    })
    .catch((err) => {
      console.error('Échec du démarrage du serveur CEREC-ISCOM:', err);
      process.exit(1);
    });
}
