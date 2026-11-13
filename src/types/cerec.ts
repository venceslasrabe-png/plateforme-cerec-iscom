export type Campus = 'Pointe-Noire' | 'Brazzaville';

export type Cycle = 'BTS' | 'Licence' | 'Master' | 'Qualifiant';

export type Niveau = 'L1' | 'L2' | 'L3' | 'M1' | 'M2' | 'FQ';

export type UserRole =
  | 'admin'
  | 'direction'
  | 'scolarite'
  | 'caisse'
  | 'enseignant'
  | 'surveillance';

export type ModuleId =
  | 'dash'
  | 'etu'
  | 'aca'
  | 'pres'
  | 'notes'
  | 'exam'
  | 'fin'
  | 'ens'
  | 'surv'
  | 'com'
  | 'par';

export interface Filiere {
  id: string;
  code: string;
  nom: string;
  cycle: Cycle;
  departement: string;
  options: string[]; // Options / spécialités rattachées à la filière
  fraisInscription: number;
  scolariteAnnuelle: number;
}

export interface UE {
  id: string;
  code: string;
  intitule: string;
  uniteParent?: string; // Nom de l'Unité d'Enseignement regroupant cet ECUE
  filiereCode: string;
  option?: string; // Option de la filière ou 'Tronc commun'
  niveau: Niveau;
  semestre: string; // e.g., 'S1', 'S2'
  credits: number;
  coefficient: number;
  volumeHoraire: number;
  enseignantId: string;
}

export interface Student {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  sexe: 'M' | 'F';
  dateNaissance: string;
  lieuNaissance: string;
  telephone: string;
  email: string;
  tuteurNom: string;
  tuteurTel: string;
  campus: Campus;
  filiereCode: string;
  option?: string;
  niveau: Niveau;
  anneeAcademique: string;
  boursePct: number; // 0 to 100
  statutDossier: 'Complet' | 'En attente' | 'Suspendu';
  dateInscription: string;
  photoUrl?: string;
}

export interface GradeRecord {
  id: string;
  studentId: string;
  ueId: string;
  cc: number | null; // Note Classe /20
  td?: number | null; // TD /20
  tp?: number | null; // TP /20
  examen: number | null; // /20
  rattrapage: number | null; // /20
  updatedAt: string;
}

export type PaymentMotif =
  | 'Inscription'
  | 'Tranche 1'
  | 'Tranche 2'
  | 'Tranche 3'
  | 'Soutenance'
  | 'Certificat';

export type PaymentMode = 'Espèces' | 'MTN MoMo' | 'Airtel Money' | 'Virement' | 'Chèque';

export interface Payment {
  id: string;
  numeroRecu: string;
  studentId: string;
  montant: number;
  motif: PaymentMotif;
  mode: PaymentMode;
  date: string;
  anneeAcademique?: string;
  caissier: string;
  campus: Campus;
  observation?: string;
}

export type AttendanceStatus = 'Présent' | 'Retard' | 'Absent' | 'Justifié';

export interface AttendanceRecord {
  id: string;
  date: string;
  ueId: string;
  studentId: string;
  statut: AttendanceStatus;
  heurePointage?: string;
}

export interface ScheduleSlot {
  id: string;
  campus: Campus;
  filiereCode: string;
  option?: string;
  niveau: Niveau;
  jour: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi';
  heureDebut: string;
  heureFin: string;
  ueId: string;
  salle: string;
}

export interface Lecturer {
  id: string;
  nom: string;
  grade: string;
  specialite: string;
  campus: Campus;
  telephone: string;
  email: string;
  tauxHoraire: number;
  heuresEffectuees: number;
}

export interface GateLog {
  id: string;
  campus: Campus;
  typePersonne: 'Étudiant' | 'Visiteur' | 'Personnel';
  studentId?: string;
  nomComplet: string;
  reference: string; // Matricule or CNI
  motif: string;
  heureEntree: string;
  heureSortie?: string;
  statutAcces: 'Autorisé' | 'Alerte Scolarité' | 'Refusé';
  date: string;
  anneeAcademique?: string;
}

export interface Announcement {
  id: string;
  titre: string;
  contenu: string;
  cible: 'Tous' | 'Étudiants' | 'Enseignants' | 'Caisse' | 'Scolarité';
  campus: Campus | 'Tous';
  priorite: 'Normale' | 'Importante' | 'Urgente';
  auteur: string;
  date: string;
}

export interface MissionTask {
  id: string;
  titre: string;
  description: string;
  assigneA: string;
  echeance: string;
  priorite: 'Haute' | 'Moyenne' | 'Normale';
  statut: 'À faire' | 'En cours' | 'Terminé';
}

export interface LmdSettings {
  anneeAcademique: string;
  seuilValidation: number; // 10
  poidsCC: number; // 0.4
  poidsExamen: number; // 0.6
  seuilAbsencesAlerte: number; // 3
  seuilBlocagePortailPct: number; // e.g. 25% minimum paid
}

export interface CerecState {
  filieres: Filiere[];
  ues: UE[];
  students: Student[];
  grades: GradeRecord[];
  payments: Payment[];
  attendance: AttendanceRecord[];
  schedule: ScheduleSlot[];
  lecturers: Lecturer[];
  gateLogs: GateLog[];
  announcements: Announcement[];
  missions: MissionTask[];
  settings: LmdSettings;
  academicYears?: string[];
}
