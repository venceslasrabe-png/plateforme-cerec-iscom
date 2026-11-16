import {
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  CalendarPlus,
  CalendarRange,
  CheckSquare,
  CreditCard,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { CreateAcademicYearModal } from './components/CreateAcademicYearModal';
import { CreateTrimesterModal } from './components/CreateTrimesterModal';
import { AuthSession, LoginPage } from './components/LoginPage';
import { NotificationCenter } from './components/NotificationCenter';
import { AcademicView } from './components/modules/AcademicView';
import { AttendanceView } from './components/modules/AttendanceView';
import { CommunicationView } from './components/modules/CommunicationView';
import { DashboardView } from './components/modules/DashboardView';
import { ExamsView } from './components/modules/ExamsView';
import { FacultyView } from './components/modules/FacultyView';
import { FinanceView } from './components/modules/FinanceView';
import { GradesView } from './components/modules/GradesView';
import { SettingsView } from './components/modules/SettingsView';
import { StudentsView } from './components/modules/StudentsView';
import { SurveillanceView } from './components/modules/SurveillanceView';
import { CEREC_LOGO_URL, createInitialSeedData } from './data/seedData';
import {
  Announcement,
  AttendanceRecord,
  Campus,
  CerecState,
  Filiere,
  GateLog,
  GradeRecord,
  Lecturer,
  LmdSettings,
  MissionTask,
  ModuleId,
  Payment,
  ScheduleSlot,
  Student,
  SystemNotification,
  Trimester,
  UE,
  UserRole,
} from './types/cerec';
import {
  CreateAcademicYearResult,
  exportCerecToExcel,
  formatFCFA,
  getAvailableAcademicYears,
  getFrenchWeekday,
  getLocalDateISO,
  getLocalTimeHHMM,
} from './utils/lmd';
import {
  canAccessModule,
  getRoleDefinition,
  getRolePermissions,
  ORDERED_ROLES,
} from './utils/permissions';
import { sanitizeRecordDeep } from './utils/security';

const LEGACY_STORAGE_KEYS = [
  'cerec_iscom_lmd_state_v1',
  'cerec_iscom_active_role_v1',
  'cerec_iscom_auth_session_v1',
];

function normalizeHydratedState(parsed: Partial<CerecState> | null | undefined): CerecState {
  const seed = createInitialSeedData();
  if (!parsed) return seed;

  const filieres = (parsed.filieres ?? seed.filieres).map((f) => {
    const seedMatch = seed.filieres.find((sf) => sf.code === f.code);
    return {
      ...f,
      options:
        Array.isArray(f.options) && f.options.length > 0
          ? f.options
          : seedMatch?.options ?? ['Option générale'],
    };
  });
  const ues = (parsed.ues ?? seed.ues).map((u) => {
    const seedMatch = seed.ues.find((su) => su.id === u.id || su.code === u.code);
    return {
      ...u,
      option: u.option ?? seedMatch?.option ?? 'Tronc commun',
    };
  });
  const students = (parsed.students ?? seed.students).map((s) => {
    const seedMatch = seed.students.find((ss) => ss.id === s.id);
    const fil = filieres.find((f) => f.code === s.filiereCode);
    return {
      ...s,
      option: s.option ?? seedMatch?.option ?? fil?.options[0],
    };
  });
  const trimestres =
    Array.isArray(parsed.trimestres) && parsed.trimestres.length > 0
      ? parsed.trimestres
      : seed.trimestres ?? [];
  const rawNotifications = Array.isArray(parsed.notifications)
    ? parsed.notifications
    : seed.notifications ?? [];
  const notifications = rawNotifications.map((n) =>
    n.targetRoles.includes('dg') && !n.targetRoles.includes('direction')
      ? { ...n, targetRoles: [...n.targetRoles, 'direction' as UserRole] }
      : n
  );
  const settings: LmdSettings = {
    ...seed.settings,
    ...(parsed.settings ?? {}),
    trimestreActifId:
      parsed.settings?.trimestreActifId ??
      trimestres.find(
        (t) =>
          t.anneeAcademique === (parsed.settings?.anneeAcademique ?? seed.settings.anneeAcademique) &&
          t.statut === 'En cours'
      )?.id ??
      seed.settings.trimestreActifId,
  };

  return sanitizeRecordDeep({
    ...seed,
    ...parsed,
    filieres,
    ues,
    students,
    trimestres,
    notifications,
    settings,
  });
}

interface NavItem {
  id: ModuleId;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dash',
    label: 'Tableau de bord',
    subtitle: 'Indicateurs exécutifs, effectifs et recouvrement en temps réel',
    icon: LayoutDashboard,
  },
  {
    id: 'etu',
    label: 'Étudiants & Inscriptions',
    subtitle: 'Dossiers LMD, cartes PVC avec QR Code et fiches d’inscription A4',
    icon: Users,
  },
  {
    id: 'aca',
    label: 'Structure LMD & Planning',
    subtitle: 'Filières, Unités d’Enseignement (UE), crédits ECTS et emploi du temps',
    icon: BookOpen,
  },
  {
    id: 'pres',
    label: 'Feuille de présences',
    subtitle: 'Appel numérique par cours, scan QR et détection d’absences répétées',
    icon: CheckSquare,
  },
  {
    id: 'notes',
    label: 'Notes & Relevés LMD',
    subtitle: 'Saisie CC/Examen/Rattrapage, moyennes pondérées et relevés officiels',
    icon: FileSpreadsheet,
  },
  {
    id: 'exam',
    label: 'Examens & Délibérations',
    subtitle: 'Jurys de session, compensation semestrielle et procès-verbaux',
    icon: Award,
  },
  {
    id: 'fin',
    label: 'Caisse & Recouvrement',
    subtitle: 'Encaissements FCFA, suivi des tranches et reçus officiels',
    icon: CreditCard,
  },
  {
    id: 'ens',
    label: 'Corps Professoral',
    subtitle: 'Annuaire des enseignants, grades et décompte des vacations',
    icon: Briefcase,
  },
  {
    id: 'surv',
    label: 'Surveillance & Guérite',
    subtitle: 'Contrôle d’accès par badge QR, registre visiteurs et alertes portail',
    icon: ShieldCheck,
  },
  {
    id: 'com',
    label: 'Communication & Missions',
    subtitle: 'Notes de service campus et suivi des tâches administratives',
    icon: Megaphone,
  },
  {
    id: 'par',
    label: 'Rôles & Paramètres',
    subtitle: 'Profils d’accès, seuils LMD, export Excel et maintenance',
    icon: Settings,
  },
];

export default function App() {
  const [state, setState] = useState<CerecState>(() => createInitialSeedData());
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeRole, setActiveRole] = useState<UserRole>('dg');
  const [activeModule, setActiveModule] = useState<ModuleId>('dash');
  const [moduleHistory, setModuleHistory] = useState<ModuleId[]>([]);
  const [campusFilter, setCampusFilter] = useState<Campus | 'Tous'>('Tous');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [createYearOpen, setCreateYearOpen] = useState(false);
  const [createTrimesterOpen, setCreateTrimesterOpen] = useState(false);
  const [editingTrimester, setEditingTrimester] = useState<Trimester | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const serverSyncedRef = useRef(false);
  const skipNextSyncRef = useRef(false);

  // Purge any legacy plaintext data in localStorage & hydrate HttpOnly session from server
  useEffect(() => {
    try {
      for (const key of LEGACY_STORAGE_KEYS) {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore storage access issues
    }

    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as {
          authenticated?: boolean;
          session?: AuthSession;
          csrfToken?: string;
        };
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.authenticated && data.session && data.csrfToken) {
          setAuthSession(data.session);
          setCsrfToken(data.csrfToken);
          setActiveRole(data.session.role);
          setCampusFilter(data.session.campus);
          setActiveModule(getRoleDefinition(data.session.role).allowedModules[0] ?? 'dash');
        }
      })
      .catch(() => {
        // fallback to login screen
      })
      .finally(() => {
        if (!cancelled) setAuthChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Load encrypted role-scoped state from server whenever session or active admin role changes
  useEffect(() => {
    if (!authSession) {
      serverSyncedRef.current = false;
      return;
    }

    let cancelled = false;
    const effectiveRole = authSession.role === 'admin' ? activeRole : authSession.role;
    fetch(`/api/state?role=${encodeURIComponent(effectiveRole)}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (res.status === 401) {
          setAuthSession(null);
          setCsrfToken(null);
          return null;
        }
        if (!res.ok) return null;
        return (await res.json()) as { state?: CerecState };
      })
      .then((data) => {
        if (cancelled || !data?.state) return;
        skipNextSyncRef.current = true;
        serverSyncedRef.current = true;
        setState(normalizeHydratedState(data.state));
      })
      .catch(() => {
        // keep current in-memory state on transient error
      });

    return () => {
      cancelled = true;
    };
  }, [authSession, activeRole]);

  // Persist role-scoped mutations to encrypted server database (AES-256-GCM)
  useEffect(() => {
    if (!authSession || !csrfToken || !serverSyncedRef.current) return;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    const currentPerms = getRolePermissions(activeRole);
    if (currentPerms.readOnly) return;

    const timer = window.setTimeout(() => {
      fetch('/api/state', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          activeRole,
          state: sanitizeRecordDeep(state),
        }),
      })
        .then(async (res) => {
          if (res.status === 401) {
            setAuthSession(null);
            setCsrfToken(null);
          }
        })
        .catch(() => {
          // ignore network interruption
        });
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [state, authSession, activeRole, csrfToken]);

  const roleDef = getRoleDefinition(activeRole);
  const perms = getRolePermissions(activeRole);

  useEffect(() => {
    if (authSession && authSession.role !== 'admin' && activeRole !== authSession.role) {
      setActiveRole(authSession.role);
    }
  }, [authSession, activeRole]);

  useEffect(() => {
    const allowed = getRoleDefinition(activeRole).allowedModules;
    if (!allowed.includes(activeModule)) {
      setActiveModule(allowed[0] ?? 'dash');
    }
    setModuleHistory((prev) => prev.filter((id) => allowed.includes(id)));
  }, [activeRole, activeModule]);

  const navigateTo = (next: ModuleId) => {
    if (!canAccessModule(activeRole, next)) return;
    if (next === activeModule) return;
    setModuleHistory((prev) => [...prev.slice(-19), activeModule]);
    setActiveModule(next);
  };

  const handleBack = () => {
    const allowed = getRoleDefinition(activeRole).allowedModules;
    const remaining = [...moduleHistory];
    while (remaining.length > 0) {
      const prev = remaining.pop()!;
      if (prev !== activeModule && allowed.includes(prev)) {
        setModuleHistory(remaining);
        setActiveModule(prev);
        return;
      }
    }
    setModuleHistory([]);
    setActiveModule(allowed[0] ?? 'dash');
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((prev) => (prev === message ? null : prev));
    }, 3500);
  };

  const guardWrite = (allowed = true): boolean => {
    if (perms.readOnly || !allowed) {
      notify(
        perms.readOnly
          ? 'Mode Supervision (Directeur Général) : lecture seule, aucune modification autorisée.'
          : 'Action non autorisée pour ce profil.'
      );
      return false;
    }
    return true;
  };

  const handleLogin = (session: AuthSession, token: string) => {
    serverSyncedRef.current = false;
    setCsrfToken(token);
    setAuthSession(session);
    setActiveRole(session.role);
    setCampusFilter(session.campus);
    setModuleHistory([]);
    setActiveModule(getRoleDefinition(session.role).allowedModules[0] ?? 'dash');
    notify(`Bienvenue, ${session.displayName}. Session chiffrée active.`);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore network failures on logout
    }
    serverSyncedRef.current = false;
    setCsrfToken(null);
    setAuthSession(null);
    setState(createInitialSeedData());
    setMobileMenuOpen(false);
    setModuleHistory([]);
  };

  const visibleNav = NAV_ITEMS.filter((item) => canAccessModule(activeRole, item.id));
  const currentMeta = NAV_ITEMS.find((n) => n.id === activeModule) ?? NAV_ITEMS[0];

  const handleMarkNotificationRead = (id: string) => {
    skipNextSyncRef.current = true;
    setState((prev) => ({
      ...prev,
      notifications: (prev.notifications ?? []).map((n) =>
        n.id === id && !n.readByRoles.includes(activeRole)
          ? { ...n, readByRoles: [...n.readByRoles, activeRole] }
          : n
      ),
    }));
    if (csrfToken) {
      fetch('/api/notifications/read', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ id }),
      }).catch(() => {});
    }
  };

  const handleMarkAllNotificationsRead = () => {
    skipNextSyncRef.current = true;
    setState((prev) => ({
      ...prev,
      notifications: (prev.notifications ?? []).map((n) =>
        n.targetRoles.includes(activeRole) &&
        (campusFilter === 'Tous' || n.campus === campusFilter) &&
        !n.readByRoles.includes(activeRole)
          ? { ...n, readByRoles: [...n.readByRoles, activeRole] }
          : n
      ),
    }));
    if (csrfToken) {
      fetch('/api/notifications/read', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ all: true }),
      }).catch(() => {});
    }
  };

  // State Mutations (permission & read-only guarded)
  const handleAddStudent = (student: Student) => {
    if (!guardWrite(perms.canManageStudents)) return;
    const nowIso = new Date().toISOString();
    const actorName = authSession?.displayName ?? roleDef.label;
    setState((prev) => {
      const filiere = prev.filieres.find((f) => f.code === student.filiereCode);
      const fraisInscription = filiere?.fraisInscription ?? 75000;
      const scolariteNette = Math.round(
        (filiere?.scolariteAnnuelle ?? 480000) * (1 - (student.boursePct || 0) / 100)
      );
      const totalDu = fraisInscription + scolariteNette;
      const baseId = Date.now();

      const caisseNotif: SystemNotification = {
        id: `notif-${baseId}-caisse`,
        category: 'inscription',
        title: 'Nouvelle inscription étudiant à encaisser',
        message: `${student.nom} ${student.prenom} (${student.matricule} · ${student.filiereCode} ${student.niveau}) inscrit(e) à ${student.campus} — Frais d’inscription : ${formatFCFA(fraisInscription)} · Scolarité due : ${formatFCFA(totalDu)}.`,
        targetRoles: ['caisse'],
        campus: student.campus,
        targetModule: 'fin',
        relatedStudentId: student.id,
        amountFCFA: totalDu,
        createdAt: nowIso,
        actorRole: activeRole,
        actorName,
        readByRoles: [],
      };

      const dgNotif: SystemNotification = {
        id: `notif-${baseId}-dg`,
        category: 'inscription',
        title: 'Nouvelle inscription étudiant enregistrée',
        message: `${student.nom} ${student.prenom} (${student.matricule} · ${student.filiereCode} ${student.niveau}) inscrit(e) sur le campus ${student.campus} (${student.anneeAcademique}) par ${actorName}.`,
        targetRoles: ['dg', 'direction'],
        campus: student.campus,
        targetModule: 'etu',
        relatedStudentId: student.id,
        amountFCFA: totalDu,
        createdAt: nowIso,
        actorRole: activeRole,
        actorName,
        readByRoles: [],
      };

      return {
        ...prev,
        students: [student, ...prev.students],
        notifications: [caisseNotif, dgNotif, ...(prev.notifications ?? [])].slice(0, 100),
      };
    });
    notify(
      `Étudiant inscrit : ${student.nom} ${student.prenom} (${student.matricule}) — Notification envoyée à la Caisse, au Directeur Général et au Directeur Académique.`
    );
  };

  const handleUpdateStudent = (student: Student) => {
    if (!guardWrite(perms.canManageStudents)) return;
    setState((prev) => ({
      ...prev,
      students: prev.students.map((s) => (s.id === student.id ? student : s)),
    }));
    notify(`Dossier mis à jour : ${student.nom} ${student.prenom}`);
  };

  const handleDeleteStudent = (id: string) => {
    if (!guardWrite(perms.canManageStudents)) return;
    setState((prev) => ({
      ...prev,
      students: prev.students.filter((s) => s.id !== id),
    }));
    notify('Dossier étudiant supprimé.');
  };

  const handleAddFiliere = (filiere: Filiere) => {
    if (!guardWrite(perms.canManageFilieresAndUes)) return;
    setState((prev) => ({ ...prev, filieres: [...prev.filieres, filiere] }));
    notify(`Filière ${filiere.code} ajoutée.`);
  };

  const handleUpdateFiliere = (filiere: Filiere) => {
    if (!guardWrite(perms.canManageFilieresAndUes)) return;
    setState((prev) => {
      const previous = prev.filieres.find((f) => f.id === filiere.id);
      const codeChanged = previous && previous.code !== filiere.code;
      return {
        ...prev,
        filieres: prev.filieres.map((f) => (f.id === filiere.id ? filiere : f)),
        ues: codeChanged
          ? prev.ues.map((u) =>
              u.filiereCode === previous.code ? { ...u, filiereCode: filiere.code } : u
            )
          : prev.ues,
        students: codeChanged
          ? prev.students.map((s) =>
              s.filiereCode === previous.code ? { ...s, filiereCode: filiere.code } : s
            )
          : prev.students,
        schedule: codeChanged
          ? prev.schedule.map((sc) =>
              sc.filiereCode === previous.code ? { ...sc, filiereCode: filiere.code } : sc
            )
          : prev.schedule,
      };
    });
    notify(`Filière ${filiere.code} mise à jour.`);
  };

  const handleDeleteFiliere = (id: string) => {
    if (!guardWrite(perms.canManageFilieresAndUes)) return;
    setState((prev) => ({
      ...prev,
      filieres: prev.filieres.filter((f) => f.id !== id),
    }));
    notify('Filière supprimée.');
  };

  const handleAddUe = (ue: UE) => {
    if (!guardWrite(perms.canManageFilieresAndUes)) return;
    setState((prev) => ({ ...prev, ues: [...prev.ues, ue] }));
    notify(`UE ${ue.code} ajoutée à la maquette LMD.`);
  };

  const handleUpdateUe = (ue: UE) => {
    if (!guardWrite(perms.canManageFilieresAndUes)) return;
    setState((prev) => ({
      ...prev,
      ues: prev.ues.map((u) => (u.id === ue.id ? ue : u)),
    }));
    notify(`UE ${ue.code} mise à jour.`);
  };

  const handleDeleteUe = (id: string) => {
    if (!guardWrite(perms.canManageFilieresAndUes)) return;
    setState((prev) => ({ ...prev, ues: prev.ues.filter((u) => u.id !== id) }));
    notify('UE retirée de la maquette.');
  };

  const handleAddSchedule = (slot: ScheduleSlot) => {
    if (!guardWrite(perms.canManagePlanningAndTrimesters)) return;
    setState((prev) => ({ ...prev, schedule: [...prev.schedule, slot] }));
    notify('Séance ajoutée à l’emploi du temps.');
  };

  const handleUpdateSchedule = (slot: ScheduleSlot) => {
    if (!guardWrite(perms.canManagePlanningAndTrimesters)) return;
    setState((prev) => ({
      ...prev,
      schedule: prev.schedule.map((s) => (s.id === slot.id ? slot : s)),
    }));
    notify('Séance mise à jour dans le planning.');
  };

  const handleDeleteSchedule = (id: string) => {
    if (!guardWrite(perms.canManagePlanningAndTrimesters)) return;
    setState((prev) => ({
      ...prev,
      schedule: prev.schedule.filter((s) => s.id !== id),
    }));
    notify('Séance retirée du planning.');
  };

  const handleSetAttendance = (record: AttendanceRecord) => {
    if (!guardWrite(perms.canMarkAttendance)) return;
    setState((prev) => {
      const exists = prev.attendance.some(
        (a) =>
          a.date === record.date &&
          a.ueId === record.ueId &&
          a.studentId === record.studentId
      );
      const nextAttendance = exists
        ? prev.attendance.map((a) =>
            a.date === record.date &&
            a.ueId === record.ueId &&
            a.studentId === record.studentId
              ? record
              : a
          )
        : [record, ...prev.attendance];
      return { ...prev, attendance: nextAttendance };
    });
  };

  const handleBulkAttendance = (records: AttendanceRecord[]) => {
    if (!guardWrite(perms.canMarkAttendance)) return;
    setState((prev) => {
      const filtered = prev.attendance.filter(
        (a) =>
          !records.some(
            (r) => r.date === a.date && r.ueId === a.ueId && r.studentId === a.studentId
          )
      );
      return { ...prev, attendance: [...records, ...filtered] };
    });
    notify(`Appel enregistré pour ${records.length} étudiant(s).`);
  };

  const handleClearAttendance = (date: string, ueId: string, studentIds: string[]) => {
    if (!guardWrite(perms.canMarkAttendance)) return;
    setState((prev) => ({
      ...prev,
      attendance: prev.attendance.filter(
        (a) => !(a.date === date && a.ueId === ueId && studentIds.includes(a.studentId))
      ),
    }));
    notify('Feuille d’appel réinitialisée pour cette séance.');
  };

  const handleUpsertGrade = (grade: GradeRecord) => {
    if (!guardWrite(perms.canEditGrades || perms.canDeliberateAndRattrapage)) return;
    setState((prev) => {
      const exists = prev.grades.some(
        (g) => g.studentId === grade.studentId && g.ueId === grade.ueId
      );
      const nextGrades = exists
        ? prev.grades.map((g) =>
            g.studentId === grade.studentId && g.ueId === grade.ueId ? grade : g
          )
        : [...prev.grades, grade];
      return { ...prev, grades: nextGrades };
    });
  };

  const handleBulkUpsertGrades = (records: GradeRecord[]) => {
    if (!guardWrite(perms.canEditGrades || perms.canDeliberateAndRattrapage)) return;
    setState((prev) => {
      const map = new Map(prev.grades.map((g) => [`${g.studentId}__${g.ueId}`, g]));
      records.forEach((rec) => {
        map.set(`${rec.studentId}__${rec.ueId}`, rec);
      });
      return { ...prev, grades: Array.from(map.values()) };
    });
  };

  const handleDeleteGrade = (studentId: string, ueId: string) => {
    if (!guardWrite(perms.canEditGrades)) return;
    setState((prev) => ({
      ...prev,
      grades: prev.grades.filter(
        (g) => !(g.studentId === studentId && g.ueId === ueId)
      ),
    }));
    notify('Notes réinitialisées pour cet étudiant.');
  };

  const handleAddPayment = (payment: Payment) => {
    if (!guardWrite(perms.canCollectPayments)) return;
    const nowIso = new Date().toISOString();
    const actorName = authSession?.displayName ?? roleDef.label;
    setState((prev) => {
      const st = prev.students.find((s) => s.id === payment.studentId);
      const isInscriptionPayment = payment.motif === 'Inscription';
      const dgPaymentNotif: SystemNotification = {
        id: `notif-${Date.now()}-pay`,
        category: isInscriptionPayment ? 'inscription' : 'encaissement',
        title: isInscriptionPayment
          ? 'Inscription & encaissement Caisse'
          : 'Encaissement Caisse enregistré',
        message: `${
          st
            ? `${st.nom} ${st.prenom} (${st.matricule} · ${st.filiereCode} ${st.niveau})`
            : payment.studentId
        } — ${formatFCFA(payment.montant)} (${payment.motif} · ${payment.mode}), reçu ${payment.numeroRecu} par ${payment.caissier}.`,
        targetRoles: ['dg', 'direction'],
        campus: payment.campus,
        targetModule: 'fin',
        relatedStudentId: payment.studentId,
        relatedPaymentId: payment.id,
        amountFCFA: payment.montant,
        createdAt: nowIso,
        actorRole: activeRole,
        actorName,
        readByRoles: [],
      };

      return {
        ...prev,
        payments: [payment, ...prev.payments],
        notifications: [dgPaymentNotif, ...(prev.notifications ?? [])].slice(0, 100),
      };
    });
    notify(
      `Encaissement validé : ${payment.numeroRecu} — Notification transmise au Directeur Général et au Directeur Académique.`
    );
  };

  const handleDeletePayment = (id: string) => {
    if (!guardWrite(perms.canCollectPayments)) return;
    setState((prev) => ({
      ...prev,
      payments: prev.payments.filter((p) => p.id !== id),
    }));
    notify('Reçu annulé et retiré du journal de caisse.');
  };

  const handleAddLecturer = (lecturer: Lecturer) => {
    if (!guardWrite(perms.canManageFaculty)) return;
    setState((prev) => ({ ...prev, lecturers: [...prev.lecturers, lecturer] }));
    notify(`Enseignant ajouté : ${lecturer.nom}`);
  };

  const handleUpdateLecturer = (lecturer: Lecturer) => {
    if (!guardWrite(perms.canManageFaculty)) return;
    setState((prev) => ({
      ...prev,
      lecturers: prev.lecturers.map((l) => (l.id === lecturer.id ? lecturer : l)),
    }));
    notify(`Fiche enseignant mise à jour : ${lecturer.nom}`);
  };

  const handleDeleteLecturer = (id: string) => {
    if (!guardWrite(perms.canManageFaculty)) return;
    setState((prev) => ({
      ...prev,
      lecturers: prev.lecturers.filter((l) => l.id !== id),
    }));
    notify('Enseignant retiré de l’annuaire.');
  };

  const handleAddGateLog = (log: GateLog) => {
    if (!guardWrite(perms.canOperateGate)) return;
    const operator = authSession?.displayName ?? roleDef.label;
    const dateVal = log.date || getLocalDateISO();
    const enriched: GateLog = {
      ...log,
      date: dateVal,
      jour: log.jour || getFrenchWeekday(dateVal),
      pointeurEntree:
        log.heureEntree && log.heureEntree !== '—'
          ? log.pointeurEntree || operator
          : undefined,
      pointeurSortie: log.heureSortie
        ? log.pointeurSortie || operator
        : undefined,
    };
    setState((prev) => ({ ...prev, gateLogs: [enriched, ...prev.gateLogs] }));
  };

  const handleMarkExit = (id: string) => {
    if (!guardWrite(perms.canOperateGate)) return;
    const nowObj = new Date();
    const nowTime = getLocalTimeHHMM(nowObj);
    const nowDate = getLocalDateISO(nowObj);
    const nowDay = getFrenchWeekday(nowDate);
    const operator = authSession?.displayName ?? roleDef.label;
    setState((prev) => ({
      ...prev,
      gateLogs: prev.gateLogs.map((g) =>
        g.id === id
          ? {
              ...g,
              heureSortie: nowTime,
              dateSortie: nowDate,
              jourSortie: nowDay,
              pointeurSortie: operator,
            }
          : g
      ),
    }));
    notify(`Sortie enregistrée (${nowDay} ${nowDate} à ${nowTime}).`);
  };

  const handleCloseAllGateLogs = (campus: Campus | 'Tous') => {
    if (!guardWrite(perms.canOperateGate)) return;
    const nowObj = new Date();
    const nowTime = getLocalTimeHHMM(nowObj);
    const nowDate = getLocalDateISO(nowObj);
    const nowDay = getFrenchWeekday(nowDate);
    const operator = authSession?.displayName ?? roleDef.label;
    setState((prev) => ({
      ...prev,
      gateLogs: prev.gateLogs.map((g) =>
        !g.heureSortie && (campus === 'Tous' || g.campus === campus)
          ? {
              ...g,
              heureSortie: nowTime,
              dateSortie: nowDate,
              jourSortie: nowDay,
              pointeurSortie: operator,
            }
          : g
      ),
    }));
    notify(`Toutes les sorties ouvertes pointées (${nowDay} ${nowDate} à ${nowTime}).`);
  };

  const handleDeleteGateLog = (id: string) => {
    if (!guardWrite(perms.canOperateGate)) return;
    setState((prev) => ({
      ...prev,
      gateLogs: prev.gateLogs.filter((g) => g.id !== id),
    }));
    notify('Mouvement retiré de la main courante.');
  };

  const handleAddAnnouncement = (ann: Announcement) => {
    if (!guardWrite(perms.canPublishAnnouncementsAndMissions)) return;
    setState((prev) => ({
      ...prev,
      announcements: [ann, ...prev.announcements],
    }));
    notify('Note de service publiée.');
  };

  const handleUpdateAnnouncement = (ann: Announcement) => {
    if (!guardWrite(perms.canPublishAnnouncementsAndMissions)) return;
    setState((prev) => ({
      ...prev,
      announcements: prev.announcements.map((a) => (a.id === ann.id ? ann : a)),
    }));
    notify('Note de service mise à jour.');
  };

  const handleDeleteAnnouncement = (id: string) => {
    if (!guardWrite(perms.canPublishAnnouncementsAndMissions)) return;
    setState((prev) => ({
      ...prev,
      announcements: prev.announcements.filter((a) => a.id !== id),
    }));
    notify('Note de service supprimée.');
  };

  const handleAddMission = (task: MissionTask) => {
    if (!guardWrite(perms.canPublishAnnouncementsAndMissions)) return;
    setState((prev) => ({ ...prev, missions: [task, ...prev.missions] }));
    notify('Mission assignée.');
  };

  const handleUpdateMission = (task: MissionTask) => {
    if (!guardWrite(perms.canPublishAnnouncementsAndMissions)) return;
    setState((prev) => ({
      ...prev,
      missions: prev.missions.map((m) => (m.id === task.id ? task : m)),
    }));
    notify('Mission mise à jour.');
  };

  const handleUpdateMissionStatus = (id: string, statut: MissionTask['statut']) => {
    if (!guardWrite(perms.canUpdateMissionStatus)) return;
    setState((prev) => ({
      ...prev,
      missions: prev.missions.map((m) => (m.id === id ? { ...m, statut } : m)),
    }));
  };

  const handleDeleteMission = (id: string) => {
    if (!guardWrite(perms.canPublishAnnouncementsAndMissions)) return;
    setState((prev) => ({
      ...prev,
      missions: prev.missions.filter((m) => m.id !== id),
    }));
    notify('Mission supprimée.');
  };

  const handleUpdateSettings = (settings: LmdSettings) => {
    if (!guardWrite(perms.canManageSystemSettings)) return;
    setState((prev) => ({ ...prev, settings }));
  };

  const handleImportState = (nextState: CerecState) => {
    if (!guardWrite(perms.canManageSystemSettings)) return;
    setState(nextState);
  };

  const handleChangeActiveYear = (year: string) => {
    if (!guardWrite(perms.canManageAcademicCalendar)) return;
    setState((prev) => ({
      ...prev,
      academicYears: Array.from(
        new Set([...getAvailableAcademicYears(prev), year])
      ).sort((a, b) => a.localeCompare(b)),
      settings: { ...prev.settings, anneeAcademique: year },
    }));
    notify(`Année académique active basculée sur ${year}.`);
  };

  const handleAcademicYearCreated = (result: CreateAcademicYearResult) => {
    if (!guardWrite(perms.canCreateAcademicYear)) return;
    setState(result.nextState);
    setCreateYearOpen(false);
    const details =
      result.totalCreated > 0
        ? ` — ${result.totalCreated} étudiant(s) reconduit(s) (${result.promotedCount} promu(s), ${result.repeatedCount} redoublant(s)/reconduit(s))`
        : ' — exercice vierge prêt pour les inscriptions';
    notify(`Année académique ${result.year} créée${details}.`);
  };

  const handleSaveTrimester = (trimester: Trimester, activate: boolean) => {
    if (!guardWrite(perms.canManagePlanningAndTrimesters)) return;
    setState((prev) => {
      const list = prev.trimestres ?? [];
      const exists = list.some((t) => t.id === trimester.id);
      const updatedList = exists
        ? list.map((t) => (t.id === trimester.id ? trimester : t))
        : [...list, trimester];
      const normalized = activate
        ? updatedList.map((t) =>
            t.id === trimester.id
              ? { ...t, statut: 'En cours' as const }
              : t.anneeAcademique === trimester.anneeAcademique && t.statut === 'En cours'
              ? { ...t, statut: 'Planifié' as const }
              : t
          )
        : updatedList;
      return {
        ...prev,
        trimestres: normalized,
        settings: activate
          ? {
              ...prev.settings,
              anneeAcademique: trimester.anneeAcademique,
              trimestreActifId: trimester.id,
            }
          : prev.settings,
      };
    });
    setCreateTrimesterOpen(false);
    setEditingTrimester(null);
    notify(
      `Trimestre ${trimester.code} (${trimester.anneeAcademique}) enregistré${
        activate ? ' et activé' : ''
      }.`
    );
  };

  const handleGenerateTrimesterBatch = (
    created: Trimester[],
    year: string,
    activateFirst: boolean
  ) => {
    if (!guardWrite(perms.canManagePlanningAndTrimesters)) return;
    setState((prev) => {
      const list = prev.trimestres ?? [];
      const first = created[0];
      const merged = [...list, ...created];
      const normalized =
        activateFirst && first
          ? merged.map((t) =>
              t.id === first.id
                ? { ...t, statut: 'En cours' as const }
                : t.anneeAcademique === year && t.statut === 'En cours'
                ? { ...t, statut: 'Planifié' as const }
                : t
            )
          : merged;
      return {
        ...prev,
        trimestres: normalized,
        settings:
          activateFirst && first
            ? {
                ...prev.settings,
                anneeAcademique: year,
                trimestreActifId: first.id,
              }
            : prev.settings,
      };
    });
    setCreateTrimesterOpen(false);
    setEditingTrimester(null);
    notify(`${created.length} trimestre(s) généré(s) pour ${year}.`);
  };

  const handleActivateTrimester = (trimesterId: string) => {
    if (!guardWrite(perms.canManageAcademicCalendar)) return;
    setState((prev) => {
      const target = (prev.trimestres ?? []).find((t) => t.id === trimesterId);
      if (!target) return prev;
      return {
        ...prev,
        trimestres: (prev.trimestres ?? []).map((t) =>
          t.id === target.id
            ? { ...t, statut: 'En cours' as const }
            : t.anneeAcademique === target.anneeAcademique && t.statut === 'En cours'
            ? { ...t, statut: 'Planifié' as const }
            : t
        ),
        settings: {
          ...prev.settings,
          anneeAcademique: target.anneeAcademique,
          trimestreActifId: target.id,
        },
      };
    });
    const target = (state.trimestres ?? []).find((t) => t.id === trimesterId);
    if (target) {
      notify(`Trimestre actif : ${target.code} — ${target.nom} (${target.anneeAcademique}).`);
    }
  };

  const handleDeleteTrimester = (trimesterId: string) => {
    if (!guardWrite(perms.canManagePlanningAndTrimesters)) return;
    setState((prev) => ({
      ...prev,
      trimestres: (prev.trimestres ?? []).filter((t) => t.id !== trimesterId),
      settings:
        prev.settings.trimestreActifId === trimesterId
          ? { ...prev.settings, trimestreActifId: undefined }
          : prev.settings,
    }));
    notify('Trimestre supprimé.');
  };

  const executeResetDemo = async () => {
    if (!guardWrite(perms.canManageSystemSettings)) return;
    try {
      if (csrfToken) {
        const res = await fetch('/api/security/reset-demo', {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': csrfToken },
        });
        if (res.ok) {
          const data = (await res.json()) as { state?: CerecState };
          if (data.state) {
            skipNextSyncRef.current = true;
            setState(normalizeHydratedState(data.state));
          }
        } else {
          notify('Réinitialisation refusée par le serveur de sécurité.');
          return;
        }
      } else {
        setState(createInitialSeedData());
      }
      setConfirmResetOpen(false);
      notify('Données de démonstration CEREC-ISCOM réinitialisées et rechiffrées.');
    } catch {
      notify('Erreur réseau lors de la réinitialisation.');
    }
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[#0b1f3f] text-white select-none">
      {/* Brand Header */}
      <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
        <img
          src={CEREC_LOGO_URL}
          alt="Logo Groupe CEREC-ISCOM"
          referrerPolicy="no-referrer"
          className="w-11 h-11 object-contain rounded-lg bg-white p-1 shrink-0"
        />
        <div className="min-w-0">
          <h1 className="font-serif text-base font-bold tracking-tight text-white truncate">
            CEREC-ISCOM
          </h1>
          <p className="text-[11px] text-[#eab33a] font-medium truncate">
            Gestion Académique LMD
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const active = activeModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                navigateTo(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#e0a526] text-[#07142b] font-bold'
                  : 'text-slate-300 hover:bg-[#143263] hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#07142b]' : 'text-[#eab33a]'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Quick Role Switcher & Session Controls in Sidebar Footer */}
      <div className="p-4 border-t border-white/10 bg-[#07142b]/60 space-y-2.5">
        {authSession && (
          <div className="pb-2 border-b border-white/10">
            <p className="text-xs font-semibold text-white truncate">
              {authSession.displayName}
            </p>
            <p className="text-[11px] text-slate-400 truncate">{authSession.email}</p>
          </div>
        )}
        {authSession?.role === 'admin' ? (
          <div className="space-y-1">
            <label
              htmlFor="role-switcher"
              className="block text-[11px] text-slate-400 font-medium"
            >
              Espace actif (Admin)
            </label>
            <select
              id="role-switcher"
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as UserRole)}
              className="w-full px-2.5 py-2 rounded-lg bg-[#143263] border border-white/15 text-xs font-medium text-white focus:outline-none focus:border-[#e0a526]"
            >
              {ORDERED_ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="rounded-lg bg-[#143263]/70 border border-white/10 px-3 py-2 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Profil & Mission
              </span>
              {perms.readOnly && (
                <span className="px-1.5 py-0.5 rounded bg-[#e0a526]/20 border border-[#e0a526]/40 text-[10px] font-semibold text-[#eab33a]">
                  Lecture seule
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-white truncate">{roleDef.label}</p>
            <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
              {roleDef.mission}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-red-950/60 hover:border-red-400/40 text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 text-[#eab33a]" />
          Déconnexion
        </button>
        <p className="text-[11px] text-slate-400 truncate">
          Pointe-Noire & Brazzaville · Congo
        </p>
      </div>
    </div>
  );

  if (authChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#07142b] text-white gap-4 px-4">
        <img
          src={CEREC_LOGO_URL}
          alt="Logo Groupe CEREC-ISCOM"
          referrerPolicy="no-referrer"
          className="w-16 h-16 object-contain rounded-xl bg-white p-1.5 shadow-lg"
        />
        <div className="text-center space-y-1">
          <p className="font-serif text-lg font-bold tracking-tight">Groupe CEREC-ISCOM</p>
          <p className="text-xs text-[#eab33a]">
            Vérification de session chiffrée en cours…
          </p>
        </div>
      </div>
    );
  }

  if (!authSession) {
    return (
      <LoginPage
        activeAcademicYear={state.settings.anneeAcademique}
        onLogin={handleLogin}
      />
    );
  }

  const activeYearTrimesters = (state.trimestres ?? [])
    .filter((t) => t.anneeAcademique === state.settings.anneeAcademique)
    .sort((a, b) => a.code.localeCompare(b.code));

  const activeTrimesterObj =
    activeYearTrimesters.find((t) => t.id === state.settings.trimestreActifId) ??
    activeYearTrimesters[0];

  return (
    <div className="min-h-screen flex bg-[#f8f9fb] text-[#161e2e] overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#07142b]/70"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[82vw] h-full z-10">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Fermer le menu"
              className="absolute top-4 right-3 p-1.5 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Workspace Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Workspace Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-[#e3e7ef] px-3 sm:px-6 py-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Ouvrir le menu"
                className="lg:hidden p-2 rounded-lg border border-[#e3e7ef] text-[#0b1f3f] hover:bg-slate-50 shrink-0 cursor-pointer"
              >
                <Menu className="w-4 h-4" />
              </button>
              {(activeModule !== 'dash' || moduleHistory.length > 0) && (
                <button
                  type="button"
                  onClick={handleBack}
                  title="Revenir à l'écran précédent"
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#e3e7ef] hover:border-[#0b1f3f] bg-[#f8f9fb] hover:bg-slate-100 text-[#0b1f3f] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline sm:inline">Retour</span>
                </button>
              )}
              <div className="min-w-0">
                <h2 className="text-sm sm:text-lg font-bold text-[#0b1f3f] truncate">
                  {currentMeta.label}
                </h2>
                <p className="text-xs text-slate-500 truncate hidden md:block">
                  {currentMeta.subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <NotificationCenter
                notifications={state.notifications ?? []}
                activeRole={activeRole}
                campusFilter={campusFilter}
                onMarkRead={handleMarkNotificationRead}
                onMarkAllRead={handleMarkAllNotificationsRead}
                onNavigate={navigateTo}
              />
              <div className="hidden md:flex items-center gap-2 shrink-0">
              {perms.canManageAcademicCalendar ? (
                <select
                  value={state.settings.anneeAcademique}
                  onChange={(e) => handleChangeActiveYear(e.target.value)}
                  aria-label="Année académique active"
                  title="Année académique en cours"
                  className="px-2.5 py-2 text-xs font-mono font-semibold border border-[#e3e7ef] rounded-lg bg-[#f8f9fb] text-[#0b1f3f] focus:outline-none focus:border-[#0b1f3f]"
                >
                  {getAvailableAcademicYears(state).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="px-2.5 py-2 text-xs font-mono font-semibold border border-[#e3e7ef] rounded-lg bg-[#f8f9fb] text-[#0b1f3f] whitespace-nowrap">
                  {state.settings.anneeAcademique}
                </span>
              )}

              {perms.canCreateAcademicYear && (
                <button
                  type="button"
                  onClick={() => setCreateYearOpen(true)}
                  title="Créer une nouvelle année académique"
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Nouvelle année</span>
                </button>
              )}

              {activeYearTrimesters.length > 0 &&
                (perms.canManageAcademicCalendar ? (
                  <select
                    value={state.settings.trimestreActifId ?? activeYearTrimesters[0]?.id ?? ''}
                    onChange={(e) => handleActivateTrimester(e.target.value)}
                    aria-label="Trimestre actif"
                    title="Trimestre actif"
                    className="px-2.5 py-2 text-xs font-semibold border border-[#e3e7ef] rounded-lg bg-[#f8f9fb] text-[#0b1f3f] focus:outline-none focus:border-[#0b1f3f]"
                  >
                    {activeYearTrimesters.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} · {t.nom}
                      </option>
                    ))}
                  </select>
                ) : (
                  activeTrimesterObj && (
                    <span className="px-2.5 py-2 text-xs font-semibold border border-[#e3e7ef] rounded-lg bg-[#f8f9fb] text-[#0b1f3f] whitespace-nowrap">
                      {activeTrimesterObj.code} · {activeTrimesterObj.nom}
                    </span>
                  )
                ))}

              {perms.canManagePlanningAndTrimesters && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTrimester(null);
                    setCreateTrimesterOpen(true);
                  }}
                  title="Créer un trimestre"
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[#0b1f3f]/25 hover:border-[#0b1f3f] bg-white text-[#0b1f3f] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <CalendarRange className="w-3.5 h-3.5 text-[#c58b12]" />
                  <span className="hidden xl:inline">Trimestre</span>
                </button>
              )}

              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value as Campus | 'Tous')}
                aria-label="Filtrer par campus"
                className="px-2.5 py-2 text-xs font-semibold border border-[#e3e7ef] rounded-lg bg-[#f8f9fb] text-[#0b1f3f] focus:outline-none focus:border-[#0b1f3f]"
              >
                <option value="Tous">Tous campus</option>
                <option value="Pointe-Noire">Pointe-Noire</option>
                <option value="Brazzaville">Brazzaville</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  exportCerecToExcel(state, { scope: 'all' });
                  notify('Export Excel classé par année académique (.xlsx) téléchargé.');
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#eab33a]" />
                <span className="hidden lg:inline">Exporter Excel</span>
              </button>
              </div>
            </div>
          </div>

          {/* Mobile & Small Tablet Quick Controls Bar */}
          <div className="flex md:hidden flex-wrap items-center gap-2 pt-2 border-t border-[#e3e7ef]">
            {perms.canManageAcademicCalendar ? (
              <select
                value={state.settings.anneeAcademique}
                onChange={(e) => handleChangeActiveYear(e.target.value)}
                aria-label="Année académique active mobile"
                className="flex-1 min-w-[110px] px-2.5 py-1.5 text-xs font-mono font-semibold border border-[#e3e7ef] rounded-lg bg-[#f8f9fb] text-[#0b1f3f]"
              >
                {getAvailableAcademicYears(state).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            ) : (
              <span className="px-2.5 py-1.5 text-xs font-mono font-semibold border border-[#e3e7ef] rounded-lg bg-[#f8f9fb] text-[#0b1f3f]">
                {state.settings.anneeAcademique}
              </span>
            )}

            {activeYearTrimesters.length > 0 &&
              (perms.canManageAcademicCalendar ? (
                <select
                  value={state.settings.trimestreActifId ?? activeYearTrimesters[0]?.id ?? ''}
                  onChange={(e) => handleActivateTrimester(e.target.value)}
                  aria-label="Trimestre actif mobile"
                  className="flex-1 min-w-[110px] px-2.5 py-1.5 text-xs font-semibold border border-[#e3e7ef] rounded-lg bg-[#f8f9fb] text-[#0b1f3f]"
                >
                  {activeYearTrimesters.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} · {t.nom}
                    </option>
                  ))}
                </select>
              ) : (
                activeTrimesterObj && (
                  <span className="px-2.5 py-1.5 text-xs font-semibold border border-[#e3e7ef] rounded-lg bg-[#f8f9fb] text-[#0b1f3f]">
                    {activeTrimesterObj.code}
                  </span>
                )
              ))}

            <select
              value={campusFilter}
              onChange={(e) => setCampusFilter(e.target.value as Campus | 'Tous')}
              aria-label="Filtrer par campus mobile"
              className="flex-1 min-w-[115px] px-2.5 py-1.5 text-xs font-semibold border border-[#e3e7ef] rounded-lg bg-[#f8f9fb] text-[#0b1f3f]"
            >
              <option value="Tous">Tous campus</option>
              <option value="Pointe-Noire">Pointe-Noire</option>
              <option value="Brazzaville">Brazzaville</option>
            </select>

            <div className="flex items-center gap-1.5 shrink-0">
              {perms.canCreateAcademicYear && (
                <button
                  type="button"
                  onClick={() => setCreateYearOpen(true)}
                  title="Nouvelle année académique"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#e0a526] text-[#07142b] text-xs font-bold cursor-pointer"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  Année
                </button>
              )}
              {perms.canManagePlanningAndTrimesters && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTrimester(null);
                    setCreateTrimesterOpen(true);
                  }}
                  title="Créer un trimestre"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#e3e7ef] bg-white text-[#0b1f3f] text-xs font-semibold cursor-pointer"
                >
                  <CalendarRange className="w-3.5 h-3.5 text-[#c58b12]" />
                  Trim.
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  exportCerecToExcel(state, { scope: 'all' });
                  notify('Export Excel (.xlsx) téléchargé.');
                }}
                title="Exporter Excel"
                aria-label="Exporter Excel"
                className="inline-flex items-center justify-center p-1.5 rounded-lg bg-[#0b1f3f] text-white cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#eab33a]" />
              </button>
            </div>
          </div>
        </header>

        {/* Active Module Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto space-y-5">
          {perms.readOnly && (
            <div className="bg-white border border-[#e3e7ef] border-t-2 border-t-[#e0a526] rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-[#161e2e]">
                <strong className="text-[#0b1f3f]">{roleDef.label}</strong> — Vue globale sur toute
                la plateforme ({visibleNav.length} rubriques) sans droit de modification.
              </div>
              <span className="px-2 py-0.5 rounded border border-[#e0a526]/50 bg-[#fff4d6] text-[#6b4e07] font-semibold">
                Lecture seule
              </span>
            </div>
          )}

          {activeModule === 'dash' && (
            <DashboardView
              state={state}
              campusFilter={campusFilter}
              activeRole={activeRole}
              onNavigate={navigateTo}
              onNotify={notify}
              onMarkNotificationRead={handleMarkNotificationRead}
              onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
            />
          )}
          {activeModule === 'etu' && (
            <StudentsView
              state={state}
              campusFilter={campusFilter}
              canManageStudents={perms.canManageStudents}
              canCollectPayments={perms.canCollectPayments}
              canViewGrades={perms.canViewStudentGrades}
              onAddStudent={handleAddStudent}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onAddPayment={handleAddPayment}
              onNotify={notify}
            />
          )}
          {activeModule === 'aca' && (
            <AcademicView
              state={state}
              campusFilter={campusFilter}
              canManageFilieresAndUes={perms.canManageFilieresAndUes}
              canManagePlanningAndTrimesters={perms.canManagePlanningAndTrimesters}
              onAddFiliere={handleAddFiliere}
              onUpdateFiliere={handleUpdateFiliere}
              onDeleteFiliere={handleDeleteFiliere}
              onAddUe={handleAddUe}
              onUpdateUe={handleUpdateUe}
              onDeleteUe={handleDeleteUe}
              onAddSchedule={handleAddSchedule}
              onUpdateSchedule={handleUpdateSchedule}
              onDeleteSchedule={handleDeleteSchedule}
              onOpenCreateTrimester={() => {
                if (!guardWrite(perms.canManagePlanningAndTrimesters)) return;
                setEditingTrimester(null);
                setCreateTrimesterOpen(true);
              }}
              onEditTrimester={(t) => {
                if (!guardWrite(perms.canManagePlanningAndTrimesters)) return;
                setEditingTrimester(t);
                setCreateTrimesterOpen(true);
              }}
              onActivateTrimester={handleActivateTrimester}
              onDeleteTrimester={handleDeleteTrimester}
            />
          )}
          {activeModule === 'pres' && (
            <AttendanceView
              state={state}
              campusFilter={campusFilter}
              canMarkAttendance={perms.canMarkAttendance}
              onSetAttendance={handleSetAttendance}
              onBulkAttendance={handleBulkAttendance}
              onClearAttendance={handleClearAttendance}
            />
          )}
          {activeModule === 'notes' && (
            <GradesView
              state={state}
              campusFilter={campusFilter}
              canEditGrades={perms.canEditGrades}
              onUpsertGrade={handleUpsertGrade}
              onBulkUpsertGrades={handleBulkUpsertGrades}
              onDeleteGrade={handleDeleteGrade}
              onNotify={notify}
            />
          )}
          {activeModule === 'exam' && (
            <ExamsView
              state={state}
              campusFilter={campusFilter}
              canDeliberateAndRattrapage={perms.canDeliberateAndRattrapage}
              onUpsertGrade={handleUpsertGrade}
              onBulkUpsertGrades={handleBulkUpsertGrades}
              onNotify={notify}
            />
          )}
          {activeModule === 'fin' && (
            <FinanceView
              state={state}
              campusFilter={campusFilter}
              activeRole={activeRole}
              canCollectPayments={perms.canCollectPayments}
              onAddPayment={handleAddPayment}
              onDeletePayment={handleDeletePayment}
              onMarkNotificationRead={handleMarkNotificationRead}
              onNotify={notify}
            />
          )}
          {activeModule === 'ens' && (
            <FacultyView
              state={state}
              campusFilter={campusFilter}
              canManageFaculty={perms.canManageFaculty}
              onAddLecturer={handleAddLecturer}
              onUpdateLecturer={handleUpdateLecturer}
              onDeleteLecturer={handleDeleteLecturer}
            />
          )}
          {activeModule === 'surv' && (
            <SurveillanceView
              state={state}
              campusFilter={campusFilter}
              canOperateGate={perms.canOperateGate}
              operatorName={authSession?.displayName ?? roleDef.label}
              onAddGateLog={handleAddGateLog}
              onMarkExit={handleMarkExit}
              onCloseAllGateLogs={() => handleCloseAllGateLogs(campusFilter)}
              onDeleteGateLog={handleDeleteGateLog}
            />
          )}
          {activeModule === 'com' && (
            <CommunicationView
              state={state}
              campusFilter={campusFilter}
              activeRole={activeRole}
              canPublish={perms.canPublishAnnouncementsAndMissions}
              canUpdateMissionStatus={perms.canUpdateMissionStatus}
              onAddAnnouncement={handleAddAnnouncement}
              onUpdateAnnouncement={handleUpdateAnnouncement}
              onDeleteAnnouncement={handleDeleteAnnouncement}
              onAddMission={handleAddMission}
              onUpdateMission={handleUpdateMission}
              onUpdateMissionStatus={handleUpdateMissionStatus}
              onDeleteMission={handleDeleteMission}
            />
          )}
          {activeModule === 'par' && (
            <SettingsView
              state={state}
              activeRole={activeRole}
              csrfToken={csrfToken}
              canSwitchRoles={authSession.role === 'admin'}
              canManageSettings={perms.canManageSystemSettings}
              canCreateAcademicYear={perms.canCreateAcademicYear}
              canManageTrimesters={perms.canManagePlanningAndTrimesters}
              onChangeRole={(nextRole) => {
                if (authSession.role !== 'admin') return;
                setActiveRole(nextRole);
              }}
              onUpdateSettings={handleUpdateSettings}
              onImportState={handleImportState}
              onOpenCreateYear={() => {
                if (!guardWrite(perms.canCreateAcademicYear)) return;
                setCreateYearOpen(true);
              }}
              onOpenCreateTrimester={() => {
                if (!guardWrite(perms.canManagePlanningAndTrimesters)) return;
                setEditingTrimester(null);
                setCreateTrimesterOpen(true);
              }}
              onActivateYear={handleChangeActiveYear}
              onActivateTrimester={handleActivateTrimester}
              onResetDemo={() => {
                if (!guardWrite(perms.canManageSystemSettings)) return;
                setConfirmResetOpen(true);
              }}
              onNotify={notify}
            />
          )}
        </main>
      </div>

      {/* Create New Academic Year Modal */}
      {perms.canCreateAcademicYear && createYearOpen && (
        <CreateAcademicYearModal
          state={state}
          onClose={() => setCreateYearOpen(false)}
          onCreated={handleAcademicYearCreated}
        />
      )}

      {/* Create / Edit Trimester Modal */}
      {perms.canManagePlanningAndTrimesters && createTrimesterOpen && (
        <CreateTrimesterModal
          state={state}
          editing={editingTrimester}
          onClose={() => {
            setCreateTrimesterOpen(false);
            setEditingTrimester(null);
          }}
          onSaveSingle={handleSaveTrimester}
          onGenerateBatch={handleGenerateTrimesterBatch}
        />
      )}

      {/* In-App Confirmation Modal for Demo Reset (avoids window.confirm) */}
      {perms.canManageSystemSettings && confirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142b]/70 p-4">
          <div className="bg-white border border-[#e3e7ef] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#161e2e]">
              Réinitialiser les données CEREC-ISCOM ?
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Cette action remplacera vos saisies locales actuelles par le jeu de données initial de
              démonstration (Pointe-Noire & Brazzaville).
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#e3e7ef] text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={executeResetDemo}
                className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer"
              >
                Confirmer la réinitialisation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#0b1f3f] text-white border border-[#e0a526] px-4 py-3 rounded-lg shadow-lg text-xs font-medium">
          {toast}
        </div>
      )}
    </div>
  );
}
