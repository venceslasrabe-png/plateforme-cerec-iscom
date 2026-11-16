import { Campus, ModuleId, UserRole } from '../types/cerec';

export interface RolePermissions {
  readOnly: boolean;
  canAccessFinanceData: boolean;
  canAccessGateLogs: boolean;
  canManageAcademicCalendar: boolean;
  canCreateAcademicYear: boolean;
  canManageStudents: boolean;
  canViewStudentGrades: boolean;
  canCollectPayments: boolean;
  canManageFilieresAndUes: boolean;
  canManagePlanningAndTrimesters: boolean;
  canMarkAttendance: boolean;
  canEditGrades: boolean;
  canDeliberateAndRattrapage: boolean;
  canManageFaculty: boolean;
  canOperateGate: boolean;
  canPublishAnnouncementsAndMissions: boolean;
  canUpdateMissionStatus: boolean;
  canManageSystemSettings: boolean;
  canSwitchRoles: boolean;
}

export interface RoleDefinition {
  id: UserRole;
  label: string;
  shortLabel: string;
  mission: string;
  defaultEmail: string;
  defaultCampus: Campus | 'Tous';
  assignedMissionService?: string;
  allowedModules: ModuleId[];
  permissions: RolePermissions;
}

export interface CompartmentAccountInfo {
  id: string;
  compartment: string;
  role: UserRole;
  campus: Campus | 'Tous';
  email: string;
  displayName: string;
  scopeSummary: string;
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  dg: {
    id: 'dg',
    label: 'Directeur Général',
    shortLabel: 'Directeur Général',
    mission:
      'Supervision globale en lecture seule sur toute la plateforme (Pointe-Noire & Brazzaville), sans aucune modification.',
    defaultEmail: 'dg@cerec-iscom.cg',
    defaultCampus: 'Tous',
    allowedModules: [
      'dash',
      'etu',
      'aca',
      'pres',
      'notes',
      'exam',
      'fin',
      'ens',
      'surv',
      'com',
      'par',
    ],
    permissions: {
      readOnly: true,
      canAccessFinanceData: true,
      canAccessGateLogs: true,
      canManageAcademicCalendar: false,
      canCreateAcademicYear: false,
      canManageStudents: false,
      canViewStudentGrades: true,
      canCollectPayments: false,
      canManageFilieresAndUes: false,
      canManagePlanningAndTrimesters: false,
      canMarkAttendance: false,
      canEditGrades: false,
      canDeliberateAndRattrapage: false,
      canManageFaculty: false,
      canOperateGate: false,
      canPublishAnnouncementsAndMissions: false,
      canUpdateMissionStatus: false,
      canManageSystemSettings: false,
      canSwitchRoles: false,
    },
  },
  admin: {
    id: 'admin',
    label: 'Administrateur Général',
    shortLabel: 'Admin Général',
    mission:
      'Administration complète : gestion système, exercices académiques, seuils LMD et droits sur tous les services.',
    defaultEmail: 'admin@cerec-iscom.cg',
    defaultCampus: 'Tous',
    allowedModules: [
      'dash',
      'etu',
      'aca',
      'pres',
      'notes',
      'exam',
      'fin',
      'ens',
      'surv',
      'com',
      'par',
    ],
    permissions: {
      readOnly: false,
      canAccessFinanceData: true,
      canAccessGateLogs: true,
      canManageAcademicCalendar: true,
      canCreateAcademicYear: true,
      canManageStudents: true,
      canViewStudentGrades: true,
      canCollectPayments: true,
      canManageFilieresAndUes: true,
      canManagePlanningAndTrimesters: true,
      canMarkAttendance: true,
      canEditGrades: true,
      canDeliberateAndRattrapage: true,
      canManageFaculty: true,
      canOperateGate: true,
      canPublishAnnouncementsAndMissions: true,
      canUpdateMissionStatus: true,
      canManageSystemSettings: true,
      canSwitchRoles: true,
    },
  },
  direction: {
    id: 'direction',
    label: 'Direction Académique',
    shortLabel: 'Direction',
    mission:
      'Maquettes LMD, emplois du temps, trimestres, corps professoral, délibérations, jurys et notes de service.',
    defaultEmail: 'direction@cerec-iscom.cg',
    defaultCampus: 'Tous',
    assignedMissionService: 'Direction Académique',
    allowedModules: ['dash', 'etu', 'aca', 'pres', 'notes', 'exam', 'ens', 'com'],
    permissions: {
      readOnly: false,
      canAccessFinanceData: false,
      canAccessGateLogs: false,
      canManageAcademicCalendar: true,
      canCreateAcademicYear: true,
      canManageStudents: false,
      canViewStudentGrades: true,
      canCollectPayments: false,
      canManageFilieresAndUes: true,
      canManagePlanningAndTrimesters: true,
      canMarkAttendance: false,
      canEditGrades: true,
      canDeliberateAndRattrapage: true,
      canManageFaculty: true,
      canOperateGate: false,
      canPublishAnnouncementsAndMissions: true,
      canUpdateMissionStatus: true,
      canManageSystemSettings: false,
      canSwitchRoles: false,
    },
  },
  scolarite: {
    id: 'scolarite',
    label: 'Scolarité & Examens',
    shortLabel: 'Scolarité',
    mission:
      'Inscriptions, dossiers étudiants, cartes PVC, emplois du temps, feuilles de présences, relevés et PV.',
    defaultEmail: 'scolarite@cerec-iscom.cg',
    defaultCampus: 'Pointe-Noire',
    assignedMissionService: 'Service Scolarité & Examens',
    allowedModules: ['dash', 'etu', 'aca', 'pres', 'notes', 'exam', 'com'],
    permissions: {
      readOnly: false,
      canAccessFinanceData: false,
      canAccessGateLogs: false,
      canManageAcademicCalendar: true,
      canCreateAcademicYear: false,
      canManageStudents: true,
      canViewStudentGrades: true,
      canCollectPayments: false,
      canManageFilieresAndUes: false,
      canManagePlanningAndTrimesters: true,
      canMarkAttendance: true,
      canEditGrades: true,
      canDeliberateAndRattrapage: true,
      canManageFaculty: false,
      canOperateGate: false,
      canPublishAnnouncementsAndMissions: true,
      canUpdateMissionStatus: true,
      canManageSystemSettings: false,
      canSwitchRoles: false,
    },
  },
  caisse: {
    id: 'caisse',
    label: 'Caisse & Comptabilité',
    shortLabel: 'Caisse',
    mission:
      'Encaissements FCFA, reçus officiels, suivi des tranches de scolarité, recouvrement et relances tuteurs.',
    defaultEmail: 'caisse@cerec-iscom.cg',
    defaultCampus: 'Pointe-Noire',
    assignedMissionService: 'Caisse & Comptabilité',
    allowedModules: ['dash', 'etu', 'fin', 'com'],
    permissions: {
      readOnly: false,
      canAccessFinanceData: true,
      canAccessGateLogs: false,
      canManageAcademicCalendar: false,
      canCreateAcademicYear: false,
      canManageStudents: false,
      canViewStudentGrades: false,
      canCollectPayments: true,
      canManageFilieresAndUes: false,
      canManagePlanningAndTrimesters: false,
      canMarkAttendance: false,
      canEditGrades: false,
      canDeliberateAndRattrapage: false,
      canManageFaculty: false,
      canOperateGate: false,
      canPublishAnnouncementsAndMissions: false,
      canUpdateMissionStatus: true,
      canManageSystemSettings: false,
      canSwitchRoles: false,
    },
  },
  enseignant: {
    id: 'enseignant',
    label: 'Corps Enseignant',
    shortLabel: 'Enseignant',
    mission:
      'Consultation des maquettes et emplois du temps, appel numérique en salle et saisie des notes CC/Examen.',
    defaultEmail: 'enseignant@cerec-iscom.cg',
    defaultCampus: 'Tous',
    allowedModules: ['dash', 'aca', 'pres', 'notes', 'com'],
    permissions: {
      readOnly: false,
      canAccessFinanceData: false,
      canAccessGateLogs: false,
      canManageAcademicCalendar: false,
      canCreateAcademicYear: false,
      canManageStudents: false,
      canViewStudentGrades: true,
      canCollectPayments: false,
      canManageFilieresAndUes: false,
      canManagePlanningAndTrimesters: false,
      canMarkAttendance: true,
      canEditGrades: true,
      canDeliberateAndRattrapage: false,
      canManageFaculty: false,
      canOperateGate: false,
      canPublishAnnouncementsAndMissions: false,
      canUpdateMissionStatus: true,
      canManageSystemSettings: false,
      canSwitchRoles: false,
    },
  },
  surveillance: {
    id: 'surveillance',
    label: 'Surveillance & Guérite',
    shortLabel: 'Guérite',
    mission:
      'Contrôle des badges QR au portail, registre des visiteurs, pointage des présences et vérification des dossiers.',
    defaultEmail: 'guerite@cerec-iscom.cg',
    defaultCampus: 'Pointe-Noire',
    assignedMissionService: 'Surveillance & Guérite',
    allowedModules: ['dash', 'surv', 'pres', 'etu', 'com'],
    permissions: {
      readOnly: false,
      canAccessFinanceData: false,
      canAccessGateLogs: true,
      canManageAcademicCalendar: false,
      canCreateAcademicYear: false,
      canManageStudents: false,
      canViewStudentGrades: false,
      canCollectPayments: false,
      canManageFilieresAndUes: false,
      canManagePlanningAndTrimesters: false,
      canMarkAttendance: true,
      canEditGrades: false,
      canDeliberateAndRattrapage: false,
      canManageFaculty: false,
      canOperateGate: true,
      canPublishAnnouncementsAndMissions: false,
      canUpdateMissionStatus: true,
      canManageSystemSettings: false,
      canSwitchRoles: false,
    },
  },
};

export const ORDERED_ROLES: RoleDefinition[] = [
  ROLE_DEFINITIONS.dg,
  ROLE_DEFINITIONS.admin,
  ROLE_DEFINITIONS.direction,
  ROLE_DEFINITIONS.scolarite,
  ROLE_DEFINITIONS.caisse,
  ROLE_DEFINITIONS.enseignant,
  ROLE_DEFINITIONS.surveillance,
];

export const COMPARTMENT_ACCOUNTS: CompartmentAccountInfo[] = [
  {
    id: 'acc-dg',
    compartment: 'Direction Générale (Supervision)',
    role: 'dg',
    campus: 'Tous',
    email: ROLE_DEFINITIONS.dg.defaultEmail,
    displayName: 'Directeur Général',
    scopeSummary: '11 rubriques en lecture seule · Notifications globales',
  },
  {
    id: 'acc-admin',
    compartment: 'Administration Générale & Paramètres',
    role: 'admin',
    campus: 'Tous',
    email: ROLE_DEFINITIONS.admin.defaultEmail,
    displayName: 'Administrateur Général',
    scopeSummary: 'Accès total (11 rubriques) · Configuration LMD & Rôles',
  },
  {
    id: 'acc-direction',
    compartment: 'Direction Académique',
    role: 'direction',
    campus: 'Tous',
    email: ROLE_DEFINITIONS.direction.defaultEmail,
    displayName: 'Direction Académique',
    scopeSummary: 'Maquettes LMD, Planning, Trimestres, Notes, Jurys, Enseignants',
  },
  {
    id: 'acc-scolarite-pn',
    compartment: 'Scolarité & Examens (Pointe-Noire)',
    role: 'scolarite',
    campus: 'Pointe-Noire',
    email: ROLE_DEFINITIONS.scolarite.defaultEmail,
    displayName: 'Scolarité Pointe-Noire',
    scopeSummary: 'Inscriptions, Reçus PDF, Cartes PVC, Présences, Relevés, PV',
  },
  {
    id: 'acc-scolarite-bz',
    compartment: 'Scolarité & Examens (Brazzaville)',
    role: 'scolarite',
    campus: 'Brazzaville',
    email: 'scolarite.bz@cerec-iscom.cg',
    displayName: 'Scolarité Brazzaville',
    scopeSummary: 'Inscriptions, Reçus PDF, Cartes PVC, Présences, Relevés, PV',
  },
  {
    id: 'acc-caisse-pn',
    compartment: 'Caisse & Comptabilité (Pointe-Noire)',
    role: 'caisse',
    campus: 'Pointe-Noire',
    email: ROLE_DEFINITIONS.caisse.defaultEmail,
    displayName: 'Caisse Pointe-Noire',
    scopeSummary: 'Encaissements FCFA, Reçus PDF, Recouvrement, Notifications',
  },
  {
    id: 'acc-caisse-bz',
    compartment: 'Caisse & Comptabilité (Brazzaville)',
    role: 'caisse',
    campus: 'Brazzaville',
    email: 'caisse.bz@cerec-iscom.cg',
    displayName: 'Caisse Brazzaville',
    scopeSummary: 'Encaissements FCFA, Reçus PDF, Recouvrement, Notifications',
  },
  {
    id: 'acc-enseignant',
    compartment: 'Corps Enseignant',
    role: 'enseignant',
    campus: 'Tous',
    email: ROLE_DEFINITIONS.enseignant.defaultEmail,
    displayName: 'Corps Enseignant',
    scopeSummary: 'Emploi du temps, Appel numérique, Saisie des notes CC/Examen',
  },
  {
    id: 'acc-guerite-pn',
    compartment: 'Surveillance & Guérite (Pointe-Noire)',
    role: 'surveillance',
    campus: 'Pointe-Noire',
    email: ROLE_DEFINITIONS.surveillance.defaultEmail,
    displayName: 'Guérite Pointe-Noire',
    scopeSummary: 'Contrôle QR portail, Visiteurs, Présences, Dossiers',
  },
  {
    id: 'acc-guerite-bz',
    compartment: 'Surveillance & Guérite (Brazzaville)',
    role: 'surveillance',
    campus: 'Brazzaville',
    email: 'guerite.bz@cerec-iscom.cg',
    displayName: 'Guérite Brazzaville',
    scopeSummary: 'Contrôle QR portail, Visiteurs, Présences, Dossiers',
  },
];

export function getRoleDefinition(role: UserRole): RoleDefinition {
  return ROLE_DEFINITIONS[role] ?? ROLE_DEFINITIONS.admin;
}

export function getRolePermissions(role: UserRole): RolePermissions {
  return getRoleDefinition(role).permissions;
}

export function canAccessModule(role: UserRole, moduleId: ModuleId): boolean {
  return getRoleDefinition(role).allowedModules.includes(moduleId);
}
