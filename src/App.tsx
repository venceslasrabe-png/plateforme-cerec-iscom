import {
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  CalendarPlus,
  CheckSquare,
  CreditCard,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  Megaphone,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { CreateAcademicYearModal } from './components/CreateAcademicYearModal';
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
  UE,
  UserRole,
} from './types/cerec';
import {
  CreateAcademicYearResult,
  exportCerecToExcel,
  getAvailableAcademicYears,
} from './utils/lmd';

const STORAGE_KEY = 'cerec_iscom_lmd_state_v1';
const ROLE_KEY = 'cerec_iscom_active_role_v1';

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

const ROLE_ALLOWED_MODULES: Record<UserRole, ModuleId[]> = {
  admin: ['dash', 'etu', 'aca', 'pres', 'notes', 'exam', 'fin', 'ens', 'surv', 'com', 'par'],
  direction: ['dash', 'etu', 'aca', 'notes', 'exam', 'ens', 'com', 'par'],
  scolarite: ['dash', 'etu', 'aca', 'pres', 'notes', 'exam', 'com', 'par'],
  caisse: ['dash', 'etu', 'fin', 'com', 'par'],
  enseignant: ['dash', 'aca', 'pres', 'notes', 'com', 'par'],
  surveillance: ['dash', 'surv', 'etu', 'pres', 'com', 'par'],
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur Général',
  direction: 'Direction Académique',
  scolarite: 'Scolarité & Examens',
  caisse: 'Caisse & Comptabilité',
  enseignant: 'Corps Enseignant',
  surveillance: 'Surveillance Guérite',
};

export default function App() {
  const [state, setState] = useState<CerecState>(() => {
    const seed = createInitialSeedData();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CerecState;
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
        return { ...seed, ...parsed, filieres, ues, students };
      }
    } catch {
      // ignore storage errors
    }
    return seed;
  });

  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem(ROLE_KEY) as UserRole | null;
    return saved && ROLE_ALLOWED_MODULES[saved] ? saved : 'admin';
  });

  const [activeModule, setActiveModule] = useState<ModuleId>('dash');
  const [moduleHistory, setModuleHistory] = useState<ModuleId[]>([]);
  const [campusFilter, setCampusFilter] = useState<Campus | 'Tous'>('Tous');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [createYearOpen, setCreateYearOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [state]);

  useEffect(() => {
    localStorage.setItem(ROLE_KEY, activeRole);
    const allowed = ROLE_ALLOWED_MODULES[activeRole];
    if (!allowed.includes(activeModule)) {
      setActiveModule(allowed[0] ?? 'dash');
    }
    setModuleHistory((prev) => prev.filter((id) => allowed.includes(id)));
  }, [activeRole, activeModule]);

  const navigateTo = (next: ModuleId) => {
    if (next === activeModule) return;
    setModuleHistory((prev) => [...prev.slice(-19), activeModule]);
    setActiveModule(next);
  };

  const handleBack = () => {
    const allowed = ROLE_ALLOWED_MODULES[activeRole];
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

  const visibleNav = NAV_ITEMS.filter((item) =>
    ROLE_ALLOWED_MODULES[activeRole].includes(item.id)
  );
  const currentMeta = NAV_ITEMS.find((n) => n.id === activeModule) ?? NAV_ITEMS[0];

  // State Mutations
  const handleAddStudent = (student: Student) => {
    setState((prev) => ({ ...prev, students: [student, ...prev.students] }));
    notify(`Étudiant inscrit : ${student.nom} ${student.prenom} (${student.matricule})`);
  };

  const handleUpdateStudent = (student: Student) => {
    setState((prev) => ({
      ...prev,
      students: prev.students.map((s) => (s.id === student.id ? student : s)),
    }));
    notify(`Dossier mis à jour : ${student.nom} ${student.prenom}`);
  };

  const handleDeleteStudent = (id: string) => {
    setState((prev) => ({
      ...prev,
      students: prev.students.filter((s) => s.id !== id),
    }));
    notify('Dossier étudiant supprimé.');
  };

  const handleAddFiliere = (filiere: Filiere) => {
    setState((prev) => ({ ...prev, filieres: [...prev.filieres, filiere] }));
    notify(`Filière ${filiere.code} ajoutée.`);
  };

  const handleUpdateFiliere = (filiere: Filiere) => {
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
    setState((prev) => ({
      ...prev,
      filieres: prev.filieres.filter((f) => f.id !== id),
    }));
    notify('Filière supprimée.');
  };

  const handleAddUe = (ue: UE) => {
    setState((prev) => ({ ...prev, ues: [...prev.ues, ue] }));
    notify(`UE ${ue.code} ajoutée à la maquette LMD.`);
  };

  const handleUpdateUe = (ue: UE) => {
    setState((prev) => ({
      ...prev,
      ues: prev.ues.map((u) => (u.id === ue.id ? ue : u)),
    }));
    notify(`UE ${ue.code} mise à jour.`);
  };

  const handleDeleteUe = (id: string) => {
    setState((prev) => ({ ...prev, ues: prev.ues.filter((u) => u.id !== id) }));
    notify('UE retirée de la maquette.');
  };

  const handleAddSchedule = (slot: ScheduleSlot) => {
    setState((prev) => ({ ...prev, schedule: [...prev.schedule, slot] }));
    notify('Séance ajoutée à l’emploi du temps.');
  };

  const handleUpdateSchedule = (slot: ScheduleSlot) => {
    setState((prev) => ({
      ...prev,
      schedule: prev.schedule.map((s) => (s.id === slot.id ? slot : s)),
    }));
    notify('Séance mise à jour dans le planning.');
  };

  const handleDeleteSchedule = (id: string) => {
    setState((prev) => ({
      ...prev,
      schedule: prev.schedule.filter((s) => s.id !== id),
    }));
    notify('Séance retirée du planning.');
  };

  const handleSetAttendance = (record: AttendanceRecord) => {
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
    setState((prev) => ({
      ...prev,
      attendance: prev.attendance.filter(
        (a) => !(a.date === date && a.ueId === ueId && studentIds.includes(a.studentId))
      ),
    }));
    notify('Feuille d’appel réinitialisée pour cette séance.');
  };

  const handleUpsertGrade = (grade: GradeRecord) => {
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
    setState((prev) => {
      const map = new Map(prev.grades.map((g) => [`${g.studentId}__${g.ueId}`, g]));
      records.forEach((rec) => {
        map.set(`${rec.studentId}__${rec.ueId}`, rec);
      });
      return { ...prev, grades: Array.from(map.values()) };
    });
  };

  const handleDeleteGrade = (studentId: string, ueId: string) => {
    setState((prev) => ({
      ...prev,
      grades: prev.grades.filter(
        (g) => !(g.studentId === studentId && g.ueId === ueId)
      ),
    }));
    notify('Notes réinitialisées pour cet étudiant.');
  };

  const handleAddPayment = (payment: Payment) => {
    setState((prev) => ({ ...prev, payments: [payment, ...prev.payments] }));
    notify(`Encaissement validé : ${payment.numeroRecu}`);
  };

  const handleDeletePayment = (id: string) => {
    setState((prev) => ({
      ...prev,
      payments: prev.payments.filter((p) => p.id !== id),
    }));
    notify('Reçu annulé et retiré du journal de caisse.');
  };

  const handleAddLecturer = (lecturer: Lecturer) => {
    setState((prev) => ({ ...prev, lecturers: [...prev.lecturers, lecturer] }));
    notify(`Enseignant ajouté : ${lecturer.nom}`);
  };

  const handleUpdateLecturer = (lecturer: Lecturer) => {
    setState((prev) => ({
      ...prev,
      lecturers: prev.lecturers.map((l) => (l.id === lecturer.id ? lecturer : l)),
    }));
    notify(`Fiche enseignant mise à jour : ${lecturer.nom}`);
  };

  const handleDeleteLecturer = (id: string) => {
    setState((prev) => ({
      ...prev,
      lecturers: prev.lecturers.filter((l) => l.id !== id),
    }));
    notify('Enseignant retiré de l’annuaire.');
  };

  const handleAddGateLog = (log: GateLog) => {
    setState((prev) => ({ ...prev, gateLogs: [log, ...prev.gateLogs] }));
  };

  const handleMarkExit = (id: string) => {
    const now = new Date().toTimeString().slice(0, 5);
    setState((prev) => ({
      ...prev,
      gateLogs: prev.gateLogs.map((g) =>
        g.id === id ? { ...g, heureSortie: now } : g
      ),
    }));
    notify(`Sortie enregistrée à ${now}.`);
  };

  const handleCloseAllGateLogs = (campus: Campus | 'Tous') => {
    const now = new Date().toTimeString().slice(0, 5);
    setState((prev) => ({
      ...prev,
      gateLogs: prev.gateLogs.map((g) =>
        !g.heureSortie && (campus === 'Tous' || g.campus === campus)
          ? { ...g, heureSortie: now }
          : g
      ),
    }));
    notify(`Toutes les sorties ouvertes pointées à ${now}.`);
  };

  const handleDeleteGateLog = (id: string) => {
    setState((prev) => ({
      ...prev,
      gateLogs: prev.gateLogs.filter((g) => g.id !== id),
    }));
    notify('Mouvement retiré de la main courante.');
  };

  const handleAddAnnouncement = (ann: Announcement) => {
    setState((prev) => ({
      ...prev,
      announcements: [ann, ...prev.announcements],
    }));
    notify('Note de service publiée.');
  };

  const handleUpdateAnnouncement = (ann: Announcement) => {
    setState((prev) => ({
      ...prev,
      announcements: prev.announcements.map((a) => (a.id === ann.id ? ann : a)),
    }));
    notify('Note de service mise à jour.');
  };

  const handleDeleteAnnouncement = (id: string) => {
    setState((prev) => ({
      ...prev,
      announcements: prev.announcements.filter((a) => a.id !== id),
    }));
    notify('Note de service supprimée.');
  };

  const handleAddMission = (task: MissionTask) => {
    setState((prev) => ({ ...prev, missions: [task, ...prev.missions] }));
    notify('Mission assignée.');
  };

  const handleUpdateMission = (task: MissionTask) => {
    setState((prev) => ({
      ...prev,
      missions: prev.missions.map((m) => (m.id === task.id ? task : m)),
    }));
    notify('Mission mise à jour.');
  };

  const handleUpdateMissionStatus = (id: string, statut: MissionTask['statut']) => {
    setState((prev) => ({
      ...prev,
      missions: prev.missions.map((m) => (m.id === id ? { ...m, statut } : m)),
    }));
  };

  const handleDeleteMission = (id: string) => {
    setState((prev) => ({
      ...prev,
      missions: prev.missions.filter((m) => m.id !== id),
    }));
    notify('Mission supprimée.');
  };

  const handleUpdateSettings = (settings: LmdSettings) => {
    setState((prev) => ({ ...prev, settings }));
  };

  const handleImportState = (nextState: CerecState) => {
    setState(nextState);
  };

  const handleChangeActiveYear = (year: string) => {
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
    setState(result.nextState);
    setCreateYearOpen(false);
    const details =
      result.totalCreated > 0
        ? ` — ${result.totalCreated} étudiant(s) reconduit(s) (${result.promotedCount} promu(s), ${result.repeatedCount} redoublant(s)/reconduit(s))`
        : ' — exercice vierge prêt pour les inscriptions';
    notify(`Année académique ${result.year} créée${details}.`);
  };

  const executeResetDemo = () => {
    const fresh = createInitialSeedData();
    setState(fresh);
    setConfirmResetOpen(false);
    notify('Données de démonstration CEREC-ISCOM réinitialisées.');
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

      {/* Quick Role Switcher in Sidebar Footer */}
      <div className="p-4 border-t border-white/10 bg-[#07142b]/60 space-y-2">
        <label
          htmlFor="role-switcher"
          className="block text-[11px] text-slate-400 font-medium"
        >
          Espace actif
        </label>
        <select
          id="role-switcher"
          value={activeRole}
          onChange={(e) => setActiveRole(e.target.value as UserRole)}
          className="w-full px-2.5 py-2 rounded-lg bg-[#143263] border border-white/15 text-xs font-medium text-white focus:outline-none focus:border-[#e0a526]"
        >
          {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-slate-400 truncate">
          Pointe-Noire & Brazzaville · Congo
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#f8f9fb] text-[#161e2e]">
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
          <aside className="relative w-64 max-w-[80vw] h-full z-10">
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
        <header className="sticky top-0 z-30 bg-white border-b border-[#e3e7ef] px-4 sm:px-6 py-3.5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Ouvrir le menu"
              className="lg:hidden p-2 rounded-lg border border-[#e3e7ef] text-[#0b1f3f] hover:bg-slate-50 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            {(activeModule !== 'dash' || moduleHistory.length > 0) && (
              <button
                type="button"
                onClick={handleBack}
                title="Revenir à l'écran précédent"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e3e7ef] hover:border-[#0b1f3f] bg-[#f8f9fb] hover:bg-slate-100 text-[#0b1f3f] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Retour
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[#0b1f3f] truncate">
                {currentMeta.label}
              </h2>
              <p className="text-xs text-slate-500 truncate hidden sm:block">
                {currentMeta.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-1.5">
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
              <button
                type="button"
                onClick={() => setCreateYearOpen(true)}
                title="Créer une nouvelle année académique"
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Nouvelle année</span>
              </button>
            </div>

            <select
              value={campusFilter}
              onChange={(e) => setCampusFilter(e.target.value as Campus | 'Tous')}
              aria-label="Filtrer par campus"
              className="px-3 py-2 text-xs font-semibold border border-[#e3e7ef] rounded-lg bg-[#f8f9fb] text-[#0b1f3f] focus:outline-none focus:border-[#0b1f3f]"
            >
              <option value="Tous">Tous les campus</option>
              <option value="Pointe-Noire">Campus Pointe-Noire</option>
              <option value="Brazzaville">Campus Brazzaville</option>
            </select>

            <button
              type="button"
              onClick={() => {
                exportCerecToExcel(state, { scope: 'all' });
                notify('Export Excel classé par année académique (.xlsx) téléchargé.');
              }}
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#eab33a]" />
              Exporter Excel
            </button>
          </div>
        </header>

        {/* Active Module Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">
          {activeModule === 'dash' && (
            <DashboardView
              state={state}
              campusFilter={campusFilter}
              activeRole={activeRole}
              onNavigate={navigateTo}
            />
          )}
          {activeModule === 'etu' && (
            <StudentsView
              state={state}
              campusFilter={campusFilter}
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
              onAddFiliere={handleAddFiliere}
              onUpdateFiliere={handleUpdateFiliere}
              onDeleteFiliere={handleDeleteFiliere}
              onAddUe={handleAddUe}
              onUpdateUe={handleUpdateUe}
              onDeleteUe={handleDeleteUe}
              onAddSchedule={handleAddSchedule}
              onUpdateSchedule={handleUpdateSchedule}
              onDeleteSchedule={handleDeleteSchedule}
            />
          )}
          {activeModule === 'pres' && (
            <AttendanceView
              state={state}
              campusFilter={campusFilter}
              onSetAttendance={handleSetAttendance}
              onBulkAttendance={handleBulkAttendance}
              onClearAttendance={handleClearAttendance}
            />
          )}
          {activeModule === 'notes' && (
            <GradesView
              state={state}
              campusFilter={campusFilter}
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
              onUpsertGrade={handleUpsertGrade}
              onBulkUpsertGrades={handleBulkUpsertGrades}
              onNotify={notify}
            />
          )}
          {activeModule === 'fin' && (
            <FinanceView
              state={state}
              campusFilter={campusFilter}
              onAddPayment={handleAddPayment}
              onDeletePayment={handleDeletePayment}
              onNotify={notify}
            />
          )}
          {activeModule === 'ens' && (
            <FacultyView
              state={state}
              campusFilter={campusFilter}
              onAddLecturer={handleAddLecturer}
              onUpdateLecturer={handleUpdateLecturer}
              onDeleteLecturer={handleDeleteLecturer}
            />
          )}
          {activeModule === 'surv' && (
            <SurveillanceView
              state={state}
              campusFilter={campusFilter}
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
              onChangeRole={setActiveRole}
              onUpdateSettings={handleUpdateSettings}
              onImportState={handleImportState}
              onOpenCreateYear={() => setCreateYearOpen(true)}
              onActivateYear={handleChangeActiveYear}
              onResetDemo={() => setConfirmResetOpen(true)}
              onNotify={notify}
            />
          )}
        </main>
      </div>

      {/* Create New Academic Year Modal */}
      {createYearOpen && (
        <CreateAcademicYearModal
          state={state}
          onClose={() => setCreateYearOpen(false)}
          onCreated={handleAcademicYearCreated}
        />
      )}

      {/* In-App Confirmation Modal for Demo Reset (avoids window.confirm) */}
      {confirmResetOpen && (
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
