import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createInitialSeedData } from '../src/data/seedData.ts';
import type { Campus, CerecState, UserRole } from '../src/types/cerec.ts';
import { getRolePermissions } from '../src/utils/permissions.ts';
import { sanitizeRecordDeep } from '../src/utils/security.ts';

export interface StoredCompartmentUser {
  id: string;
  compartment: string;
  role: UserRole;
  campus: Campus | 'Tous';
  email: string;
  displayName: string;
  salt: string;
  passwordHash: string;
  passwordUpdatedAt: string;
}

export interface SecurityAuditEvent {
  id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  event: string;
  actor: string;
  ip: string;
  detail: string;
}

interface EncryptedDiskEnvelope {
  v: 1;
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  ciphertext: string;
}

interface ServerKeyStore {
  sessionSecret: string;
  dbEncryptionKey: string;
}

export interface DatabasePayload {
  state: CerecState;
  users: StoredCompartmentUser[];
  auditLogs: SecurityAuditEvent[];
  updatedAt: string;
}

const BOOTSTRAP_USERS: Omit<StoredCompartmentUser, 'passwordUpdatedAt'>[] = [
  {
    id: 'acc-dg',
    compartment: 'Direction Générale (Supervision)',
    role: 'dg',
    campus: 'Tous',
    email: 'dg@cerec-iscom.cg',
    displayName: 'Directeur Général',
    salt: 'a51105db5b3f83c9f751e32582f37144',
    passwordHash:
      '3ac14c53fdfcbe69ed616e63c7613b2a6c65f69e1f08855b41e50e1df70e23acbe3465054246a33c50bec764a2e31d9d21560e349bc551cc2ffdee4b6a3637f3',
  },
  {
    id: 'acc-admin',
    compartment: 'Administration Générale & Paramètres',
    role: 'admin',
    campus: 'Tous',
    email: 'admin@cerec-iscom.cg',
    displayName: 'Administrateur Général',
    salt: '1c89bce7c5adcca5b3ad95e44c233bd7',
    passwordHash:
      '0760144995dc5a055e7d696f9e77ae1d0be81bb5aa3867aba934530d3b9327ad23504a500dc98992d8214580dc06020ef5041ea79f1218212a69aa370ed0e983',
  },
  {
    id: 'acc-direction',
    compartment: 'Direction Académique',
    role: 'direction',
    campus: 'Tous',
    email: 'direction@cerec-iscom.cg',
    displayName: 'Direction Académique',
    salt: '4fef77a68573ebc87e0e7b3556e13924',
    passwordHash:
      'd11423f85e4f30e4832fce88b5a901f084d725c7af6adbf3286e0aaebe7abf0a49e122ddf1065283d7f879a2f752c6b58979ac554a2784eea57fa4c7954e72d0',
  },
  {
    id: 'acc-scolarite-pn',
    compartment: 'Scolarité & Examens (Pointe-Noire)',
    role: 'scolarite',
    campus: 'Pointe-Noire',
    email: 'scolarite@cerec-iscom.cg',
    displayName: 'Scolarité Pointe-Noire',
    salt: '5fe4581521a9971ac4a43785616e029d',
    passwordHash:
      '8a2e0aeee7158377f32c09d7ae71b268a1b2b7209ee8bec26b83c07ff126fdf3cadecb1916249ccb1ab14abdd1d9bd384d4eb44b5a5bc3a1e96a9f9ba89a1e99',
  },
  {
    id: 'acc-scolarite-bz',
    compartment: 'Scolarité & Examens (Brazzaville)',
    role: 'scolarite',
    campus: 'Brazzaville',
    email: 'scolarite.bz@cerec-iscom.cg',
    displayName: 'Scolarité Brazzaville',
    salt: 'ac50a9374b7c04acc8a657b41f66a18d',
    passwordHash:
      '141bba95d14555126d8b42762c8c7385b8232788aa1c0275bcde44e07d2bc2bf4caa94e0ee9644941294b155ab1f76260ae12f19f27bff8196adfc447d515a1f',
  },
  {
    id: 'acc-caisse-pn',
    compartment: 'Caisse & Comptabilité (Pointe-Noire)',
    role: 'caisse',
    campus: 'Pointe-Noire',
    email: 'caisse@cerec-iscom.cg',
    displayName: 'Caisse Pointe-Noire',
    salt: '521ac5d2f985c7ffdbc9bf29f4a28ff3',
    passwordHash:
      '92f43c2f1af1801c3602e9e689c0887be5f2f0a1f81efa1ec290f4c952c94674061b09a215baa1257bde4a446ebaf70429ba664c89c12f73c1131c9cc50d58bb',
  },
  {
    id: 'acc-caisse-bz',
    compartment: 'Caisse & Comptabilité (Brazzaville)',
    role: 'caisse',
    campus: 'Brazzaville',
    email: 'caisse.bz@cerec-iscom.cg',
    displayName: 'Caisse Brazzaville',
    salt: '96b758e3d73dcc9b9eefee1aa0e8f8ca',
    passwordHash:
      '40b1fb67a591d42fa7731d719dd872515417a9851f7200315d0e7866c107be2bea5ef3a32b83ca865b804a323266f1a9ad850b64f3d5f3eb30ba706342dacafa',
  },
  {
    id: 'acc-enseignant',
    compartment: 'Corps Enseignant',
    role: 'enseignant',
    campus: 'Tous',
    email: 'enseignant@cerec-iscom.cg',
    displayName: 'Corps Enseignant',
    salt: 'fddf72cf80699235c6a22c7636b610e9',
    passwordHash:
      'c2c32533c4f7980fddff6c0644836d3a1f38029840e60a01771c4178ac186947a0d9b61ebcc929dae91fc56c16aeb45effbb1d2a5171471b2f7d6e78ba272074',
  },
  {
    id: 'acc-guerite-pn',
    compartment: 'Surveillance & Guérite (Pointe-Noire)',
    role: 'surveillance',
    campus: 'Pointe-Noire',
    email: 'guerite@cerec-iscom.cg',
    displayName: 'Guérite Pointe-Noire',
    salt: '6c30215b781983dd97c5128e015d0789',
    passwordHash:
      'd8266e91d1e6c837ddb7aaf930fa97757c5f0eb21577dcb1cf031a9091c5aee8a9048d055c99a26d6e45be80f486c05920db19004292170a17628b87fce6bd4d',
  },
  {
    id: 'acc-guerite-bz',
    compartment: 'Surveillance & Guérite (Brazzaville)',
    role: 'surveillance',
    campus: 'Brazzaville',
    email: 'guerite.bz@cerec-iscom.cg',
    displayName: 'Guérite Brazzaville',
    salt: '0543e224d18e4548493241fef98d52eb',
    passwordHash:
      'ee31788284dc4390abb06cbc367504671d72f78ea3b6c7f21ec76287fdb73e276113333deef4f901a99f7844b3e2d572625085ab5b9faabac255320fbc90d046',
  },
];

export function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { salt: actualSalt, hash: derived };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  try {
    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function generateStrongPassword(): string {
  const words = ['Cerec', 'Iscom', 'Campus', 'Lmd', 'Congo'];
  const word = words[crypto.randomInt(words.length)];
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  const sym = ['!', '@', '#', '$'][crypto.randomInt(4)];
  return `${word}@${code}${sym}`;
}

export class EncryptedDatabase {
  private readonly dataDir: string;
  private readonly dbPath: string;
  private readonly keyPath: string;
  private readonly keys: ServerKeyStore;
  private readonly aesKey: Buffer;
  private cache: DatabasePayload | null = null;

  constructor(dataDir = path.resolve(process.cwd(), 'data')) {
    this.dataDir = dataDir;
    this.dbPath = path.join(this.dataDir, 'cerec-db.enc.json');
    this.keyPath = path.join(this.dataDir, '.server-keys.json');
    fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
    this.keys = this.loadOrInitKeys();
    this.aesKey = crypto.scryptSync(
      this.keys.dbEncryptionKey,
      'cerec-iscom-aes256-salt-v1',
      32
    );
    this.loadOrInitDb();
  }

  getSessionSecret(): string {
    return this.keys.sessionSecret;
  }

  getDbPath(): string {
    return this.dbPath;
  }

  private loadOrInitKeys(): ServerKeyStore {
    const envSession = process.env.SESSION_SECRET?.trim();
    const envDbKey = process.env.DB_ENCRYPTION_KEY?.trim();

    let fileKeys: Partial<ServerKeyStore> = {};
    if (fs.existsSync(this.keyPath)) {
      try {
        fileKeys = JSON.parse(fs.readFileSync(this.keyPath, 'utf8')) as Partial<ServerKeyStore>;
      } catch {
        fileKeys = {};
      }
    }

    const sessionSecret =
      envSession && envSession.length >= 16
        ? envSession
        : fileKeys.sessionSecret || crypto.randomBytes(32).toString('hex');

    const dbEncryptionKey =
      envDbKey && envDbKey.length >= 16
        ? envDbKey
        : fileKeys.dbEncryptionKey || crypto.randomBytes(32).toString('hex');

    if (!fs.existsSync(this.keyPath) || !fileKeys.sessionSecret || !fileKeys.dbEncryptionKey) {
      const toStore: ServerKeyStore = { sessionSecret, dbEncryptionKey };
      fs.writeFileSync(this.keyPath, JSON.stringify(toStore, null, 2), { mode: 0o600 });
      try {
        fs.chmodSync(this.keyPath, 0o600);
      } catch {
        // ignore chmod failures on restricted filesystems
      }
    }

    return { sessionSecret, dbEncryptionKey };
  }

  private encryptPayload(payload: DatabasePayload): EncryptedDiskEnvelope {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.aesKey, iv);
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      v: 1,
      alg: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }

  private decryptEnvelope(envelope: EncryptedDiskEnvelope): DatabasePayload {
    if (envelope.v !== 1 || envelope.alg !== 'aes-256-gcm') {
      throw new Error('Format de base de données chiffrée non pris en charge.');
    }
    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.aesKey, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8')) as DatabasePayload;
  }

  private createBootstrapPayload(): DatabasePayload {
    const now = new Date().toISOString();
    return {
      state: createInitialSeedData(),
      users: BOOTSTRAP_USERS.map((u) => ({ ...u, passwordUpdatedAt: now })),
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: now,
          severity: 'info',
          event: 'DB_INITIALIZED',
          actor: 'Système CEREC-ISCOM',
          ip: '127.0.0.1',
          detail: 'Base de données chiffrée AES-256-GCM initialisée avec hachage scrypt.',
        },
      ],
      updatedAt: now,
    };
  }

  private loadOrInitDb(): DatabasePayload {
    if (this.cache) return this.cache;

    if (fs.existsSync(this.dbPath)) {
      const raw = fs.readFileSync(this.dbPath, 'utf8');
      const envelope = JSON.parse(raw) as EncryptedDiskEnvelope;
      const decoded = this.decryptEnvelope(envelope);
      this.cache = decoded;
      return decoded;
    }

    const fresh = this.createBootstrapPayload();
    this.persist(fresh);
    return fresh;
  }

  private persist(payload: DatabasePayload): void {
    const sanitized: DatabasePayload = {
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    const envelope = this.encryptPayload(sanitized);
    const tmpPath = `${this.dbPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(envelope, null, 2), { mode: 0o600 });
    fs.renameSync(tmpPath, this.dbPath);
    try {
      fs.chmodSync(this.dbPath, 0o600);
    } catch {
      // ignore chmod errors
    }
    this.cache = sanitized;
  }

  read(): DatabasePayload {
    return this.loadOrInitDb();
  }

  updateState(nextState: CerecState): DatabasePayload {
    const current = this.loadOrInitDb();
    const cleaned = sanitizeRecordDeep(nextState);
    const updated: DatabasePayload = {
      ...current,
      state: cleaned,
      updatedAt: new Date().toISOString(),
    };
    this.persist(updated);
    return updated;
  }

  resetDemoState(actor: string, ip: string): DatabasePayload {
    const current = this.loadOrInitDb();
    const freshState = createInitialSeedData();
    const event: SecurityAuditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: 'warning',
      event: 'DEMO_DATA_RESET',
      actor,
      ip,
      detail: 'Réinitialisation contrôlée des données de démonstration.',
    };
    const updated: DatabasePayload = {
      ...current,
      state: freshState,
      auditLogs: [event, ...current.auditLogs].slice(0, 200),
      updatedAt: new Date().toISOString(),
    };
    this.persist(updated);
    return updated;
  }

  rotateUserPassword(email: string, actor: string, ip: string): string | null {
    const current = this.loadOrInitDb();
    const idx = current.users.findIndex(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (idx < 0) return null;

    const newPassword = generateStrongPassword();
    const { salt, hash } = hashPassword(newPassword);
    const now = new Date().toISOString();
    const nextUsers = [...current.users];
    nextUsers[idx] = {
      ...nextUsers[idx],
      salt,
      passwordHash: hash,
      passwordUpdatedAt: now,
    };

    const event: SecurityAuditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: now,
      severity: 'info',
      event: 'PASSWORD_ROTATED',
      actor,
      ip,
      detail: `Renouvellement du mot de passe pour ${nextUsers[idx].email}.`,
    };

    this.persist({
      ...current,
      users: nextUsers,
      auditLogs: [event, ...current.auditLogs].slice(0, 200),
      updatedAt: now,
    });

    return newPassword;
  }

  appendAuditLog(
    severity: SecurityAuditEvent['severity'],
    event: string,
    actor: string,
    ip: string,
    detail: string
  ): void {
    const current = this.loadOrInitDb();
    const entry: SecurityAuditEvent = {
      id: `aud-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      timestamp: new Date().toISOString(),
      severity,
      event,
      actor,
      ip,
      detail,
    };
    this.persist({
      ...current,
      auditLogs: [entry, ...current.auditLogs].slice(0, 200),
    });
  }
}

export function scopeStateForRole(state: CerecState, role: UserRole): CerecState {
  const perms = getRolePermissions(role);
  return {
    ...state,
    payments: perms.canAccessFinanceData ? state.payments : [],
    grades: perms.canViewStudentGrades ? state.grades : [],
    gateLogs: perms.canAccessGateLogs ? state.gateLogs : [],
    notifications: (state.notifications ?? []).filter((n) =>
      n.targetRoles.includes(role) || role === 'admin' || role === 'dg'
    ),
  };
}

export function mergeRoleScopedState(
  existing: CerecState,
  incoming: CerecState,
  role: UserRole
): CerecState {
  const perms = getRolePermissions(role);
  const cleanIncoming = sanitizeRecordDeep(incoming);

  return {
    filieres: perms.canManageFilieresAndUes ? cleanIncoming.filieres ?? existing.filieres : existing.filieres,
    ues: perms.canManageFilieresAndUes ? cleanIncoming.ues ?? existing.ues : existing.ues,
    students:
      perms.canManageStudents || perms.canCreateAcademicYear || perms.canManageSystemSettings
        ? cleanIncoming.students ?? existing.students
        : existing.students,
    grades: perms.canEditGrades || perms.canDeliberateAndRattrapage || perms.canManageSystemSettings
      ? cleanIncoming.grades ?? existing.grades
      : existing.grades,
    payments:
      perms.canCollectPayments || perms.canManageSystemSettings
        ? cleanIncoming.payments ?? existing.payments
        : existing.payments,
    attendance:
      perms.canMarkAttendance || perms.canManageSystemSettings
        ? cleanIncoming.attendance ?? existing.attendance
        : existing.attendance,
    schedule:
      perms.canManagePlanningAndTrimesters || perms.canManageSystemSettings
        ? cleanIncoming.schedule ?? existing.schedule
        : existing.schedule,
    lecturers:
      perms.canManageFaculty || perms.canManageSystemSettings
        ? cleanIncoming.lecturers ?? existing.lecturers
        : existing.lecturers,
    gateLogs:
      perms.canOperateGate || perms.canManageSystemSettings
        ? cleanIncoming.gateLogs ?? existing.gateLogs
        : existing.gateLogs,
    announcements:
      perms.canPublishAnnouncementsAndMissions || perms.canManageSystemSettings
        ? cleanIncoming.announcements ?? existing.announcements
        : existing.announcements,
    missions:
      perms.canPublishAnnouncementsAndMissions ||
      perms.canUpdateMissionStatus ||
      perms.canManageSystemSettings
        ? cleanIncoming.missions ?? existing.missions
        : existing.missions,
    settings:
      perms.canManageSystemSettings ||
      perms.canManageAcademicCalendar ||
      perms.canCreateAcademicYear ||
      perms.canManagePlanningAndTrimesters
        ? cleanIncoming.settings ?? existing.settings
        : existing.settings,
    academicYears:
      perms.canCreateAcademicYear ||
      perms.canManageAcademicCalendar ||
      perms.canManageSystemSettings
        ? cleanIncoming.academicYears ?? existing.academicYears
        : existing.academicYears,
    trimestres:
      perms.canManagePlanningAndTrimesters ||
      perms.canManageAcademicCalendar ||
      perms.canManageSystemSettings
        ? cleanIncoming.trimestres ?? existing.trimestres
        : existing.trimestres,
    notifications: (() => {
      const existingList = existing.notifications ?? [];
      const incomingList = cleanIncoming.notifications ?? [];
      const mergedMap = new Map(existingList.map((n) => [n.id, n]));
      for (const n of incomingList) {
        mergedMap.set(n.id, n);
      }
      return Array.from(mergedMap.values()).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
    })(),
  };
}
