import * as XLSX from 'xlsx';
import {
  Campus,
  CerecState,
  Filiere,
  GradeRecord,
  LmdSettings,
  Niveau,
  Payment,
  PaymentMode,
  PaymentMotif,
  Student,
  UE,
} from '../types/cerec';

export function formatFCFA(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

export function computeMoyenneClasse(grade: GradeRecord | undefined): number | null {
  if (!grade) return null;
  const parts = [grade.cc, grade.td, grade.tp].filter(
    (v): v is number => v !== null && v !== undefined && !Number.isNaN(v)
  );
  if (parts.length === 0) return null;
  const avg = parts.reduce((sum, v) => sum + v, 0) / parts.length;
  return Number(avg.toFixed(2));
}

export function computeUeAverage(
  grade: GradeRecord | undefined,
  settings: LmdSettings
): {
  moyClasse: number | null;
  moyenneNormale: number | null;
  moyenneFinale: number | null;
  statut: 'Validé' | 'Rattrapage' | 'Non validé' | 'En attente';
  session: 'Normale' | 'Rattrapage' | '—';
} {
  const moyClasse = computeMoyenneClasse(grade);
  if (!grade || (moyClasse === null && grade.examen === null)) {
    return {
      moyClasse: null,
      moyenneNormale: null,
      moyenneFinale: null,
      statut: 'En attente',
      session: '—',
    };
  }

  const cc = moyClasse ?? 0;
  const ex = grade.examen ?? 0;
  const moyenneNormale = Number(
    (cc * settings.poidsCC + ex * settings.poidsExamen).toFixed(2)
  );

  if (moyenneNormale >= settings.seuilValidation) {
    return {
      moyClasse,
      moyenneNormale,
      moyenneFinale: moyenneNormale,
      statut: 'Validé',
      session: 'Normale',
    };
  }

  if (grade.rattrapage !== null && grade.rattrapage !== undefined) {
    const moyenneRat = Number(
      Math.max(
        moyenneNormale,
        cc * settings.poidsCC + grade.rattrapage * settings.poidsExamen
      ).toFixed(2)
    );
    return {
      moyClasse,
      moyenneNormale,
      moyenneFinale: moyenneRat,
      statut: moyenneRat >= settings.seuilValidation ? 'Validé' : 'Non validé',
      session: 'Rattrapage',
    };
  }

  return {
    moyClasse,
    moyenneNormale,
    moyenneFinale: moyenneNormale,
    statut: 'Rattrapage',
    session: 'Normale',
  };
}

export function getMention(moyenne: number | null): string {
  if (moyenne === null) return '—';
  if (moyenne >= 16) return 'Très Bien';
  if (moyenne >= 14) return 'Bien';
  if (moyenne >= 12) return 'Assez Bien';
  if (moyenne >= 10) return 'Passable';
  return 'Insuffisant';
}

export function ueMatchesStudent(ue: UE, student: Student): boolean {
  if (ue.filiereCode !== student.filiereCode || ue.niveau !== student.niveau) {
    return false;
  }
  const ueOpt = ue.option?.trim();
  if (!ueOpt || ueOpt === 'Tronc commun') return true;
  if (!student.option?.trim()) return true;
  return ueOpt === student.option.trim();
}

export function computeStudentSemesterSummary(
  student: Student,
  ues: UE[],
  grades: GradeRecord[],
  settings: LmdSettings,
  semestre?: string
) {
  const studentUes = ues.filter(
    (u) => ueMatchesStudent(u, student) && (!semestre || u.semestre === semestre)
  );

  let totalWeighted = 0;
  let totalCoef = 0;
  let creditsTotaux = 0;
  let creditsAcquis = 0;
  let hasPending = false;
  let hasFailedUe = false;

  const details = studentUes.map((ue) => {
    const grade = grades.find((g) => g.studentId === student.id && g.ueId === ue.id);
    const res = computeUeAverage(grade, settings);
    creditsTotaux += ue.credits;

    if (res.moyenneFinale !== null) {
      totalWeighted += res.moyenneFinale * ue.coefficient;
      totalCoef += ue.coefficient;
      if (res.moyenneFinale >= settings.seuilValidation) {
        creditsAcquis += ue.credits;
      } else {
        hasFailedUe = true;
      }
    } else {
      hasPending = true;
    }

    return { ue, grade, ...res };
  });

  // Group details by Unité d'Enseignement (uniteParent or intitule)
  const groupMap = new Map<string, typeof details>();
  details.forEach((d) => {
    const groupKey = d.ue.uniteParent?.trim() || d.ue.intitule;
    const list = groupMap.get(groupKey) ?? [];
    list.push(d);
    groupMap.set(groupKey, list);
  });

  const ueGroups = Array.from(groupMap.entries()).map(([uniteNom, rows]) => {
    let gWeighted = 0;
    let gCoef = 0;
    let gCredits = 0;
    rows.forEach((r) => {
      gCredits += r.ue.credits;
      if (r.moyenneFinale !== null) {
        gWeighted += r.moyenneFinale * r.ue.coefficient;
        gCoef += r.ue.coefficient;
      }
    });
    const moyenneUe = gCoef > 0 ? Number((gWeighted / gCoef).toFixed(2)) : null;
    return {
      uniteNom,
      moyenneUe,
      creditsUe: gCredits,
      rows,
    };
  });

  // Compute semester average weighted by UE credits (LMD standard when UE groups exist), fallback to coef
  let semWeighted = 0;
  let semCreditsWeight = 0;
  ueGroups.forEach((g) => {
    if (g.moyenneUe !== null && g.creditsUe > 0) {
      semWeighted += g.moyenneUe * g.creditsUe;
      semCreditsWeight += g.creditsUe;
    }
  });

  const moyenneGenerale =
    semCreditsWeight > 0
      ? Number((semWeighted / semCreditsWeight).toFixed(2))
      : totalCoef > 0
      ? Number((totalWeighted / totalCoef).toFixed(2))
      : null;

  // LMD compensation: if overall average >= 10, all credits in the semester are acquired by compensation
  let decision: 'Admis' | 'Admis par compensation' | 'Rattrapage' | 'Ajourné' | 'En cours' =
    'En cours';
  if (!hasPending && moyenneGenerale !== null) {
    if (moyenneGenerale >= settings.seuilValidation && !hasFailedUe) {
      decision = 'Admis';
    } else if (moyenneGenerale >= settings.seuilValidation && hasFailedUe) {
      decision = 'Admis par compensation';
      creditsAcquis = creditsTotaux;
    } else if (
      details.some((d) => d.grade?.rattrapage === null && (d.moyenneNormale ?? 20) < 10)
    ) {
      decision = 'Rattrapage';
    } else {
      decision = 'Ajourné';
    }
  }

  return {
    details,
    ueGroups,
    moyenneGenerale,
    creditsAcquis,
    creditsTotaux,
    mention: getMention(moyenneGenerale),
    decision,
  };
}

export function computeCohortRank(
  student: Student,
  allStudents: Student[],
  ues: UE[],
  grades: GradeRecord[],
  settings: LmdSettings,
  semestre?: string
): { rang: number | null; totalCandidats: number } {
  const cohort = allStudents.filter(
    (s) =>
      s.anneeAcademique === student.anneeAcademique &&
      s.filiereCode === student.filiereCode &&
      s.niveau === student.niveau &&
      (!student.option || !s.option || s.option === student.option)
  );
  const scored = cohort
    .map((s) => ({
      id: s.id,
      moy: computeStudentSemesterSummary(s, ues, grades, settings, semestre).moyenneGenerale,
    }))
    .filter((x): x is { id: string; moy: number } => x.moy !== null)
    .sort((a, b) => b.moy - a.moy);

  const idx = scored.findIndex((x) => x.id === student.id);
  return {
    rang: idx >= 0 ? idx + 1 : null,
    totalCandidats: cohort.length,
  };
}

export function formatOrdinalFr(n: number | null): string {
  if (n === null) return '—';
  return n === 1 ? '1 er' : `${n} ème`;
}

export function computeStudentFinance(
  student: Student,
  filieres: Filiere[],
  payments: Payment[]
) {
  const filiere = filieres.find((f) => f.code === student.filiereCode);
  const inscriptionDue = filiere?.fraisInscription ?? 75000;
  const scolariteBrute = filiere?.scolariteAnnuelle ?? 450000;
  const reduction = Math.round((scolariteBrute * (student.boursePct || 0)) / 100);
  const totalDu = inscriptionDue + (scolariteBrute - reduction);

  const studentPayments = payments.filter((p) => p.studentId === student.id);
  const totalPaye = studentPayments.reduce((sum, p) => sum + p.montant, 0);
  const resteAPayer = Math.max(0, totalDu - totalPaye);
  const tauxCouverture =
    totalDu > 0 ? Math.min(100, Math.round((totalPaye / totalDu) * 100)) : 100;

  let statutFinancier: 'Soldé' | 'En cours' | 'Retard critique' = 'En cours';
  if (resteAPayer === 0) {
    statutFinancier = 'Soldé';
  } else if (tauxCouverture < 35) {
    statutFinancier = 'Retard critique';
  }

  return {
    totalDu,
    totalPaye,
    resteAPayer,
    tauxCouverture,
    statutFinancier,
    studentPayments,
  };
}

export function inferAcademicYearFromDate(dateStr?: string): string {
  if (!dateStr || dateStr.length < 7) return '2025-2026';
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  if (Number.isNaN(year) || Number.isNaN(month)) return '2025-2026';
  return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

export function getPaymentAcademicYear(payment: Payment, students: Student[]): string {
  if (payment.anneeAcademique?.trim()) return payment.anneeAcademique.trim();
  const st = students.find((s) => s.id === payment.studentId);
  if (st?.anneeAcademique?.trim()) return st.anneeAcademique.trim();
  return inferAcademicYearFromDate(payment.date);
}

export function getAvailableAcademicYears(state: CerecState): string[] {
  const years = new Set<string>();
  (state.academicYears ?? []).forEach((y) => {
    if (y?.trim()) years.add(y.trim());
  });
  if (state.settings.anneeAcademique?.trim()) {
    years.add(state.settings.anneeAcademique.trim());
  }
  state.students.forEach((s) => {
    if (s.anneeAcademique?.trim()) years.add(s.anneeAcademique.trim());
  });
  state.payments.forEach((p) => {
    years.add(getPaymentAcademicYear(p, state.students));
  });
  return Array.from(years).sort((a, b) => a.localeCompare(b));
}

export function computeAcademicYearStats(state: CerecState, year: string) {
  const yearStudents = state.students.filter((s) => s.anneeAcademique === year);
  const yearPayments = state.payments.filter(
    (p) => getPaymentAcademicYear(p, state.students) === year
  );

  let totalDu = 0;
  let totalPayeEtudiants = 0;
  let reste = 0;

  yearStudents.forEach((s) => {
    const fin = computeStudentFinance(s, state.filieres, yearPayments);
    totalDu += fin.totalDu;
    totalPayeEtudiants += fin.totalPaye;
    reste += fin.resteAPayer;
  });

  const totalEncaisseCaisse = yearPayments.reduce((sum, p) => sum + p.montant, 0);
  const summaries = yearStudents.map((s) =>
    computeStudentSemesterSummary(s, state.ues, state.grades, state.settings)
  );
  const graded = summaries.filter((x) => x.moyenneGenerale !== null);
  const moyenneGenerale =
    graded.length > 0
      ? Number(
          (
            graded.reduce((sum, x) => sum + (x.moyenneGenerale ?? 0), 0) / graded.length
          ).toFixed(2)
        )
      : null;
  const admis = graded.filter(
    (x) => x.decision === 'Admis' || x.decision === 'Admis par compensation'
  ).length;
  const tauxReussite = graded.length > 0 ? Math.round((admis / graded.length) * 100) : 0;
  const tauxRecouvrement =
    totalDu > 0 ? Math.min(100, Math.round((totalPayeEtudiants / totalDu) * 100)) : 100;

  return {
    year,
    studentCount: yearStudents.length,
    paymentCount: yearPayments.length,
    totalDu,
    totalEncaisseCaisse,
    reste,
    tauxRecouvrement,
    moyenneGenerale,
    admis,
    tauxReussite,
  };
}

function safeSheetName(prefix: string, year: string): string {
  const cleanYear = year.replace(/[\\/:*?[\]]/g, '-');
  return `${prefix}_${cleanYear}`.slice(0, 31);
}

export function exportCerecToExcel(
  state: CerecState,
  options?: {
    scope?: 'all' | 'prior' | 'single';
    targetYear?: string;
  }
) {
  const wb = XLSX.utils.book_new();
  const scope = options?.scope ?? 'all';
  const allYears = getAvailableAcademicYears(state);
  const currentYear = state.settings.anneeAcademique;

  let selectedYears: string[];
  if (scope === 'prior') {
    selectedYears = allYears.filter((y) => y !== currentYear && y < currentYear);
    if (selectedYears.length === 0) {
      selectedYears = allYears.filter((y) => y !== currentYear);
    }
  } else if (scope === 'single' && options?.targetYear) {
    selectedYears = [options.targetYear];
  } else {
    selectedYears = allYears;
  }

  // 1. Synthesis sheet across selected years
  const summaryRows = selectedYears.map((year) => {
    const st = computeAcademicYearStats(state, year);
    return {
      'Année Académique': year,
      Statut: year === currentYear ? 'Année en cours' : 'Archive antérieure',
      'Effectif Étudiants': st.studentCount,
      'Admis LMD': st.admis,
      'Taux Réussite (%)': st.tauxReussite,
      'Moyenne Cohorte (/20)': st.moyenneGenerale ?? '—',
      'Reçus Caisse': st.paymentCount,
      'Total Attendu (FCFA)': st.totalDu,
      'Total Encaissé (FCFA)': st.totalEncaisseCaisse,
      'Reste à Recouvrer (FCFA)': st.reste,
      'Recouvrement (%)': st.tauxRecouvrement,
    };
  });

  const summarySheetName =
    scope === 'prior'
      ? 'Synthèse_Antérieures'
      : scope === 'single' && options?.targetYear
      ? safeSheetName('Synthèse', options.targetYear)
      : 'Synthèse_Années';
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      summaryRows.length > 0
        ? summaryRows
        : [{ Information: 'Aucune donnée disponible pour la période sélectionnée.' }]
    ),
    summarySheetName
  );

  // 2. Sheets classified by Academic Year (Students, Grades, Cash Payments)
  selectedYears.forEach((year) => {
    const yearStudents = state.students
      .filter((s) => s.anneeAcademique === year)
      .sort(
        (a, b) =>
          a.filiereCode.localeCompare(b.filiereCode) ||
          a.niveau.localeCompare(b.niveau) ||
          a.nom.localeCompare(b.nom)
      );

    const yearPayments = state.payments
      .filter((p) => getPaymentAcademicYear(p, state.students) === year)
      .sort((a, b) => a.date.localeCompare(b.date));

    const studentRows = yearStudents.map((s) => {
      const fin = computeStudentFinance(s, state.filieres, yearPayments);
      const acad = computeStudentSemesterSummary(s, state.ues, state.grades, state.settings);
      return {
        'Année Académique': s.anneeAcademique,
        Matricule: s.matricule,
        Nom: s.nom,
        Prénom: s.prenom,
        Campus: s.campus,
        Filière: s.filiereCode,
        Option: s.option ?? '—',
        Niveau: s.niveau,
        Téléphone: s.telephone,
        Dossier: s.statutDossier,
        'Moyenne LMD': acad.moyenneGenerale ?? '—',
        Mention: acad.mention,
        'Crédits Acquis': `${acad.creditsAcquis}/${acad.creditsTotaux}`,
        'Décision Jury': acad.decision,
        'Total Dû (FCFA)': fin.totalDu,
        'Total Payé (FCFA)': fin.totalPaye,
        'Reste à Payer (FCFA)': fin.resteAPayer,
        'Statut Financier': fin.statutFinancier,
      };
    });

    const gradeRows: Record<string, string | number>[] = [];
    yearStudents.forEach((s) => {
      const acad = computeStudentSemesterSummary(s, state.ues, state.grades, state.settings);
      acad.details.forEach((d) => {
        if (!d.grade && d.moyenneFinale === null) return;
        gradeRows.push({
          'Année Académique': year,
          Matricule: s.matricule,
          Étudiant: `${s.nom} ${s.prenom}`,
          Filière: s.filiereCode,
          Option: s.option ?? '—',
          Niveau: s.niveau,
          'Code UE': d.ue.code,
          Matière: d.ue.intitule,
          'Moy. Classe': d.moyClasse ?? '—',
          Examen: d.grade?.examen ?? '—',
          Rattrapage: d.grade?.rattrapage ?? '—',
          'Moy. Finale': d.moyenneFinale ?? '—',
          Statut: d.statut,
        });
      });
    });

    const paymentRows = yearPayments.map((p) => {
      const st = state.students.find((s) => s.id === p.studentId);
      return {
        'Année Académique': year,
        'N° Reçu': p.numeroRecu,
        Date: p.date,
        Campus: p.campus,
        Matricule: st?.matricule ?? '—',
        Étudiant: st ? `${st.nom} ${st.prenom}` : '—',
        Filière: st?.filiereCode ?? '—',
        Option: st?.option ?? '—',
        Motif: p.motif,
        Mode: p.mode,
        'Montant (FCFA)': p.montant,
        Caissier: p.caissier,
        Observation: p.observation ?? '',
      };
    });

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        studentRows.length > 0
          ? studentRows
          : [{ 'Année Académique': year, Information: 'Aucun étudiant enregistré' }]
      ),
      safeSheetName('Étud', year)
    );

    if (gradeRows.length > 0 || scope !== 'all') {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          gradeRows.length > 0
            ? gradeRows
            : [{ 'Année Académique': year, Information: 'Aucune note enregistrée' }]
        ),
        safeSheetName('Notes', year)
      );
    }

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        paymentRows.length > 0
          ? paymentRows
          : [{ 'Année Académique': year, Information: 'Aucun encaissement enregistré' }]
      ),
      safeSheetName('Caisse', year)
    );
  });

  // 3. Maquette LMD reference sheet
  const ueRows = state.ues.map((u) => {
    const ens = state.lecturers.find((l) => l.id === u.enseignantId);
    return {
      Code: u.code,
      'Unité d’enseignement': u.uniteParent ?? u.intitule,
      'Élément constitutif': u.intitule,
      Filière: u.filiereCode,
      Option: u.option ?? 'Tronc commun',
      Niveau: u.niveau,
      Semestre: u.semestre,
      Crédits: u.credits,
      Coefficient: u.coefficient,
      'Volume Horaire': u.volumeHoraire,
      Enseignant: ens?.nom ?? 'Non affecté',
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ueRows), 'Maquette_LMD');

  const dateTag = new Date().toISOString().slice(0, 10);
  const fileName =
    scope === 'prior'
      ? `CEREC-ISCOM_Annees_Anterieures_${dateTag}.xlsx`
      : scope === 'single' && options?.targetYear
      ? `CEREC-ISCOM_Archive_${options.targetYear}_${dateTag}.xlsx`
      : `CEREC-ISCOM_Export_Par_Annee_${dateTag}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

export interface ArchiveImportResult {
  fileName: string;
  studentsAdded: number;
  studentsUpdated: number;
  paymentsAdded: number;
  gradesAdded: number;
  uesAdded: number;
  yearsImported: string[];
  nextState: CerecState;
}

function normalizeHeaderKey(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function pickField(row: Record<string, unknown>, candidates: string[]): string {
  const normalizedEntries = Object.entries(row).map(([k, v]) => [
    normalizeHeaderKey(k),
    v,
  ] as const);
  for (const cand of candidates) {
    const target = normalizeHeaderKey(cand);
    const match = normalizedEntries.find(([k]) => k === target);
    if (match && match[1] !== undefined && match[1] !== null) {
      const str = String(match[1]).trim();
      if (str !== '' && str !== '—') return str;
    }
  }
  return '';
}

function parseNullableScore(raw: string): number | null {
  if (!raw || raw === '—') return null;
  const cleaned = raw.replace(',', '.').replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return Math.min(20, Math.max(0, num));
}

function parseAmount(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const num = Number(cleaned);
  return Number.isNaN(num) ? 0 : Math.max(0, Math.round(num));
}

function extractYearFromSheetName(name: string): string {
  const m = name.match(/(20\d{2})[-_/](\d{4})/);
  return m ? `${m[1]}-${m[2]}` : '';
}

function normalizeCampus(raw: string): Campus {
  return raw.toLowerCase().includes('braz') ? 'Brazzaville' : 'Pointe-Noire';
}

function normalizeNiveau(raw: string): Niveau {
  const upper = raw.toUpperCase().trim();
  if (upper === 'L1' || upper === 'L2' || upper === 'L3' || upper === 'M1' || upper === 'M2' || upper === 'FQ') {
    return upper;
  }
  return 'L1';
}

function normalizeMotif(raw: string): PaymentMotif {
  const allowed: PaymentMotif[] = [
    'Inscription',
    'Tranche 1',
    'Tranche 2',
    'Tranche 3',
    'Soutenance',
    'Certificat',
  ];
  return allowed.find((m) => m.toLowerCase() === raw.toLowerCase()) ?? 'Tranche 1';
}

function normalizeMode(raw: string): PaymentMode {
  const allowed: PaymentMode[] = [
    'Espèces',
    'MTN MoMo',
    'Airtel Money',
    'Virement',
    'Chèque',
  ];
  return allowed.find((m) => m.toLowerCase() === raw.toLowerCase()) ?? 'Espèces';
}

export async function importArchivesFromFile(
  file: File,
  currentState: CerecState
): Promise<ArchiveImportResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const nextFilieres = currentState.filieres.map((f) => ({
    ...f,
    options: [...(f.options ?? [])],
  }));
  const nextUes = [...currentState.ues];
  const nextStudents = [...currentState.students];
  const nextGrades = [...currentState.grades];
  const nextPayments = [...currentState.payments];

  let studentsAdded = 0;
  let studentsUpdated = 0;
  let paymentsAdded = 0;
  let gradesAdded = 0;
  let uesAdded = 0;
  const yearsSet = new Set<string>();

  const ensureFiliereOption = (filiereCode: string, optionName?: string) => {
    if (!filiereCode || !optionName || optionName === 'Tronc commun' || optionName === '—') return;
    const fil = nextFilieres.find((f) => f.code.toUpperCase() === filiereCode.toUpperCase());
    if (fil && !fil.options.includes(optionName)) {
      fil.options.push(optionName);
    }
  };

  // Pass 1: Maquette UEs
  wb.SheetNames.forEach((sheetName) => {
    const normName = normalizeHeaderKey(sheetName);
    if (!normName.includes('maquette') && !normName.includes('ue')) return;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);
    rows.forEach((row, idx) => {
      const code = pickField(row, ['Code', 'Code UE']).toUpperCase();
      const intitule = pickField(row, ['Élément constitutif', 'Element constitutif', 'Intitulé', 'Matière']);
      if (!code || !intitule) return;
      if (nextUes.some((u) => u.code.toUpperCase() === code)) return;

      const filiereCode = pickField(row, ['Filière', 'Filiere']).toUpperCase() || nextFilieres[0]?.code || 'GCF';
      const option = pickField(row, ['Option']) || 'Tronc commun';
      ensureFiliereOption(filiereCode, option);

      nextUes.push({
        id: `ue-imp-${Date.now()}-${idx}`,
        code,
        intitule,
        uniteParent: pickField(row, ['Unité d’enseignement', 'Unite d enseignement']) || undefined,
        filiereCode,
        option,
        niveau: normalizeNiveau(pickField(row, ['Niveau'])),
        semestre: pickField(row, ['Semestre']) || 'S1',
        credits: Number(pickField(row, ['Crédits', 'Credits'])) || 4,
        coefficient: Number(pickField(row, ['Coefficient', 'Coef'])) || 2,
        volumeHoraire: Number(pickField(row, ['Volume Horaire'])) || 36,
        enseignantId: currentState.lecturers[0]?.id ?? '',
      });
      uesAdded += 1;
    });
  });

  // Pass 2: Students sheets
  wb.SheetNames.forEach((sheetName) => {
    const normName = normalizeHeaderKey(sheetName);
    if (!normName.startsWith('etud')) return;
    const sheetYear = extractYearFromSheetName(sheetName);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);

    rows.forEach((row, idx) => {
      const matricule = pickField(row, ['Matricule']);
      const nom = pickField(row, ['Nom']);
      const prenom = pickField(row, ['Prénom', 'Prenom']);
      if (!matricule || !nom) return;

      const anneeAcademique =
        pickField(row, ['Année Académique', 'Annee Academique', 'Année']) ||
        sheetYear ||
        '2024-2025';
      const filiereCode =
        pickField(row, ['Filière', 'Filiere']).toUpperCase() || nextFilieres[0]?.code || 'GCF';
      const option = pickField(row, ['Option']) || undefined;
      ensureFiliereOption(filiereCode, option);

      yearsSet.add(anneeAcademique);

      const existingIdx = nextStudents.findIndex(
        (s) =>
          s.matricule.toLowerCase() === matricule.toLowerCase() &&
          s.anneeAcademique === anneeAcademique
      );

      if (existingIdx >= 0) {
        const cur = nextStudents[existingIdx];
        nextStudents[existingIdx] = {
          ...cur,
          nom: nom.toUpperCase(),
          prenom: prenom || cur.prenom,
          campus: pickField(row, ['Campus']) ? normalizeCampus(pickField(row, ['Campus'])) : cur.campus,
          filiereCode,
          option: option ?? cur.option,
          niveau: pickField(row, ['Niveau']) ? normalizeNiveau(pickField(row, ['Niveau'])) : cur.niveau,
          telephone: pickField(row, ['Téléphone', 'Telephone']) || cur.telephone,
        };
        studentsUpdated += 1;
      } else {
        const campus = normalizeCampus(pickField(row, ['Campus']) || (matricule.includes('-BZ-') ? 'Brazzaville' : 'Pointe-Noire'));
        const startYear = anneeAcademique.slice(0, 4) || '2024';
        nextStudents.push({
          id: `st-imp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          matricule,
          nom: nom.toUpperCase(),
          prenom: prenom || '—',
          sexe: 'M',
          dateNaissance: '2002-01-15',
          lieuNaissance: campus,
          telephone: pickField(row, ['Téléphone', 'Telephone']) || '+242 06 000 00 00',
          email: `${(prenom || 'etudiant').toLowerCase().replace(/\s+/g, '.')}.${nom.toLowerCase().replace(/\s+/g, '.')}@etudiant.cerec-iscom.cg`,
          tuteurNom: 'Archive importée',
          tuteurTel: '',
          campus,
          filiereCode,
          option,
          niveau: normalizeNiveau(pickField(row, ['Niveau'])),
          anneeAcademique,
          boursePct: 0,
          statutDossier:
            (pickField(row, ['Dossier']) as Student['statutDossier']) || 'Complet',
          dateInscription: `${startYear}-10-15`,
        });
        studentsAdded += 1;
      }
    });
  });

  const findStudent = (matricule: string, year?: string): Student | undefined => {
    if (!matricule) return undefined;
    if (year) {
      const exact = nextStudents.find(
        (s) => s.matricule.toLowerCase() === matricule.toLowerCase() && s.anneeAcademique === year
      );
      if (exact) return exact;
    }
    return nextStudents.find((s) => s.matricule.toLowerCase() === matricule.toLowerCase());
  };

  // Pass 3: Grades sheets
  wb.SheetNames.forEach((sheetName) => {
    const normName = normalizeHeaderKey(sheetName);
    if (!normName.startsWith('notes')) return;
    const sheetYear = extractYearFromSheetName(sheetName);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);

    rows.forEach((row) => {
      const matricule = pickField(row, ['Matricule']);
      const codeUe = pickField(row, ['Code UE', 'Code']).toUpperCase();
      if (!matricule || !codeUe) return;
      const year =
        pickField(row, ['Année Académique', 'Annee Academique', 'Année']) || sheetYear;
      const student = findStudent(matricule, year);
      const ue = nextUes.find((u) => u.code.toUpperCase() === codeUe);
      if (!student || !ue) return;

      if (year) yearsSet.add(year);

      const cc = parseNullableScore(pickField(row, ['Note Classe', 'Moy. Classe', 'CC', 'Classe']));
      const td = parseNullableScore(pickField(row, ['TD']));
      const tp = parseNullableScore(pickField(row, ['TP']));
      const examen = parseNullableScore(pickField(row, ['Examen']));
      const rattrapage = parseNullableScore(pickField(row, ['Rattrapage']));
      if (cc === null && td === null && tp === null && examen === null && rattrapage === null) return;

      const existingIdx = nextGrades.findIndex(
        (g) => g.studentId === student.id && g.ueId === ue.id
      );
      const record: GradeRecord = {
        id: existingIdx >= 0 ? nextGrades[existingIdx].id : `gr-imp-${student.id}-${ue.id}`,
        studentId: student.id,
        ueId: ue.id,
        cc,
        td,
        tp,
        examen,
        rattrapage,
        updatedAt: new Date().toISOString().slice(0, 10),
      };
      if (existingIdx >= 0) {
        nextGrades[existingIdx] = record;
      } else {
        nextGrades.push(record);
        gradesAdded += 1;
      }
    });
  });

  // Pass 4: Caisse / Payments sheets
  wb.SheetNames.forEach((sheetName) => {
    const normName = normalizeHeaderKey(sheetName);
    if (!normName.startsWith('caisse') && !normName.includes('paiement')) return;
    const sheetYear = extractYearFromSheetName(sheetName);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);

    rows.forEach((row, idx) => {
      const numeroRecu = pickField(row, ['N° Reçu', 'No Recu', 'Numero Recu', 'Recu']);
      const montant = parseAmount(pickField(row, ['Montant (FCFA)', 'Montant']));
      if (!numeroRecu || montant <= 0) return;
      if (nextPayments.some((p) => p.numeroRecu.toLowerCase() === numeroRecu.toLowerCase())) {
        return;
      }

      const date = pickField(row, ['Date']) || `${(sheetYear || '2024').slice(0, 4)}-10-20`;
      const year =
        pickField(row, ['Année Académique', 'Annee Academique', 'Année']) ||
        sheetYear ||
        inferAcademicYearFromDate(date);
      const matricule = pickField(row, ['Matricule']);
      const student = findStudent(matricule, year);

      yearsSet.add(year);

      nextPayments.push({
        id: `pay-imp-${Date.now()}-${idx}`,
        numeroRecu,
        studentId: student?.id ?? matricule,
        montant,
        motif: normalizeMotif(pickField(row, ['Motif'])),
        mode: normalizeMode(pickField(row, ['Mode'])),
        date,
        anneeAcademique: year,
        caissier: pickField(row, ['Caissier']) || 'Archive Importée',
        campus: normalizeCampus(pickField(row, ['Campus']) || student?.campus || 'Pointe-Noire'),
        observation: pickField(row, ['Observation']) || `Import archive ${year}`,
      });
      paymentsAdded += 1;
    });
  });

  if (
    studentsAdded === 0 &&
    studentsUpdated === 0 &&
    paymentsAdded === 0 &&
    gradesAdded === 0 &&
    uesAdded === 0
  ) {
    throw new Error(
      "Aucune nouvelle donnée d'archive exploitable n'a été détectée dans ce fichier (vérifiez qu'il s'agit d'un classeur CEREC-ISCOM .xlsx contenant les onglets Étud_*, Notes_* ou Caisse_*)."
    );
  }

  const mergedYears = Array.from(
    new Set([
      ...(currentState.academicYears ?? []),
      currentState.settings.anneeAcademique,
      ...Array.from(yearsSet),
    ].filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  return {
    fileName: file.name,
    studentsAdded,
    studentsUpdated,
    paymentsAdded,
    gradesAdded,
    uesAdded,
    yearsImported: Array.from(yearsSet).sort(),
    nextState: {
      ...currentState,
      academicYears: mergedYears,
      filieres: nextFilieres,
      ues: nextUes,
      students: nextStudents,
      grades: nextGrades,
      payments: nextPayments,
    },
  };
}

export type CreateAcademicYearMode = 'empty' | 'promote_admitted' | 'copy_all';

export interface CreateAcademicYearOptions {
  newYear: string;
  sourceYear: string;
  mode: CreateAcademicYearMode;
  includeRepeating: boolean;
  includeL3ToM1: boolean;
  setAsActive: boolean;
}

export interface CreateAcademicYearResult {
  year: string;
  promotedCount: number;
  repeatedCount: number;
  graduatedSkipped: number;
  alreadyPresentSkipped: number;
  totalCreated: number;
  nextState: CerecState;
}

export function isValidAcademicYear(year: string): boolean {
  const match = year.trim().match(/^(\d{4})-(\d{4})$/);
  if (!match) return false;
  return Number(match[2]) === Number(match[1]) + 1;
}

export function suggestNextAcademicYear(
  currentYear: string,
  existingYears: string[]
): string {
  const all = [...existingYears, currentYear].filter((y) => isValidAcademicYear(y));
  const maxStart = all.reduce((max, y) => {
    const start = Number(y.slice(0, 4));
    return Number.isNaN(start) ? max : Math.max(max, start);
  }, 2025);
  return `${maxStart + 1}-${maxStart + 2}`;
}

export function getPromotedNiveau(
  niveau: Niveau,
  includeL3ToM1: boolean
): { nextNiveau: Niveau | null; graduated: boolean } {
  switch (niveau) {
    case 'L1':
      return { nextNiveau: 'L2', graduated: false };
    case 'L2':
      return { nextNiveau: 'L3', graduated: false };
    case 'L3':
      return includeL3ToM1
        ? { nextNiveau: 'M1', graduated: false }
        : { nextNiveau: null, graduated: true };
    case 'M1':
      return { nextNiveau: 'M2', graduated: false };
    case 'M2':
    case 'FQ':
      return { nextNiveau: null, graduated: true };
  }
}

export function createNewAcademicYear(
  currentState: CerecState,
  options: CreateAcademicYearOptions
): CreateAcademicYearResult {
  const cleanYear = options.newYear.trim();
  if (!isValidAcademicYear(cleanYear)) {
    throw new Error(
      "Format d'année académique invalide. Utilisez le format AAAA-AAAA consécutif (ex. 2026-2027)."
    );
  }

  const startYear = cleanYear.slice(0, 4);
  const existingTargetMatricules = new Set(
    currentState.students
      .filter((s) => s.anneeAcademique === cleanYear)
      .map((s) => s.matricule.toLowerCase())
  );

  const newStudents: Student[] = [];
  let promotedCount = 0;
  let repeatedCount = 0;
  let graduatedSkipped = 0;
  let alreadyPresentSkipped = 0;

  if (options.mode !== 'empty') {
    const sourceStudents = currentState.students.filter(
      (s) => s.anneeAcademique === options.sourceYear
    );

    sourceStudents.forEach((st, idx) => {
      if (existingTargetMatricules.has(st.matricule.toLowerCase())) {
        alreadyPresentSkipped += 1;
        return;
      }

      if (options.mode === 'copy_all') {
        newStudents.push({
          ...st,
          id: `st-ay-${startYear}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          anneeAcademique: cleanYear,
          statutDossier: 'En attente',
          dateInscription: `${startYear}-10-05`,
        });
        repeatedCount += 1;
        return;
      }

      const summary = computeStudentSemesterSummary(
        st,
        currentState.ues,
        currentState.grades,
        currentState.settings
      );
      const isAdmitted =
        summary.decision === 'Admis' || summary.decision === 'Admis par compensation';

      if (isAdmitted) {
        const promo = getPromotedNiveau(st.niveau, options.includeL3ToM1);
        if (promo.graduated || !promo.nextNiveau) {
          graduatedSkipped += 1;
          return;
        }
        newStudents.push({
          ...st,
          id: `st-ay-${startYear}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          niveau: promo.nextNiveau,
          anneeAcademique: cleanYear,
          statutDossier: 'Complet',
          dateInscription: `${startYear}-10-05`,
        });
        promotedCount += 1;
      } else if (options.includeRepeating) {
        newStudents.push({
          ...st,
          id: `st-ay-${startYear}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          anneeAcademique: cleanYear,
          statutDossier: 'En attente',
          dateInscription: `${startYear}-10-05`,
        });
        repeatedCount += 1;
      }
    });
  }

  const nextAcademicYears = Array.from(
    new Set([...getAvailableAcademicYears(currentState), cleanYear])
  ).sort((a, b) => a.localeCompare(b));

  return {
    year: cleanYear,
    promotedCount,
    repeatedCount,
    graduatedSkipped,
    alreadyPresentSkipped,
    totalCreated: newStudents.length,
    nextState: {
      ...currentState,
      academicYears: nextAcademicYears,
      students: [...currentState.students, ...newStudents],
      settings: options.setAsActive
        ? { ...currentState.settings, anneeAcademique: cleanYear }
        : currentState.settings,
    },
  };
}

export function exportGradesTemplateToExcel(
  state: CerecState,
  ue: UE,
  students: Student[]
) {
  const wb = XLSX.utils.book_new();
  const rows = students.map((s) => {
    const grade = state.grades.find((g) => g.studentId === s.id && g.ueId === ue.id);
    return {
      Matricule: s.matricule,
      Nom: s.nom,
      Prénom: s.prenom,
      Campus: s.campus,
      'Année Académique': s.anneeAcademique,
      'Code UE': ue.code,
      'Élément constitutif': ue.intitule,
      'Note Classe': grade?.cc ?? '',
      TD: grade?.td ?? '',
      TP: grade?.tp ?? '',
      Examen: grade?.examen ?? '',
      Rattrapage: grade?.rattrapage ?? '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName('Notes', ue.code));
  XLSX.writeFile(
    wb,
    `CEREC-ISCOM_Releve_${ue.code}_${state.settings.anneeAcademique}.xlsx`
  );
}

export interface GradeImportPreviewRow {
  matricule: string;
  studentName: string;
  ueCode: string;
  ueTitle: string;
  cc: number | null;
  td: number | null;
  tp: number | null;
  examen: number | null;
  rattrapage: number | null;
  isNew: boolean;
}

export interface GradeImportResult {
  fileName: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  matchedUes: string[];
  matchedStudents: number;
  previewRows: GradeImportPreviewRow[];
  records: GradeRecord[];
}

export async function importGradesFromFile(
  file: File,
  state: CerecState,
  fallbackUeId?: string
): Promise<GradeImportResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const mergedByKey = new Map<string, GradeRecord>();
  const previewByKey = new Map<string, GradeImportPreviewRow>();
  const ueCodesSet = new Set<string>();
  const studentIdsSet = new Set<string>();
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  const fallbackUe =
    (fallbackUeId ? state.ues.find((u) => u.id === fallbackUeId) : undefined) ??
    state.ues[0];

  const findStudentInState = (
    matriculeRaw: string,
    fullNameRaw: string,
    yearRaw: string
  ): Student | undefined => {
    const targetYear = yearRaw.trim() || state.settings.anneeAcademique;
    if (matriculeRaw.trim()) {
      const m = matriculeRaw.trim().toLowerCase();
      return (
        state.students.find(
          (s) => s.matricule.toLowerCase() === m && s.anneeAcademique === targetYear
        ) ?? state.students.find((s) => s.matricule.toLowerCase() === m)
      );
    }
    if (fullNameRaw.trim()) {
      const normName = normalizeHeaderKey(fullNameRaw);
      return (
        state.students.find(
          (s) =>
            s.anneeAcademique === targetYear &&
            normalizeHeaderKey(`${s.nom} ${s.prenom}`) === normName
        ) ??
        state.students.find(
          (s) => normalizeHeaderKey(`${s.nom} ${s.prenom}`) === normName
        )
      );
    }
    return undefined;
  };

  const findUeInState = (codeRaw: string, titleRaw: string): UE | undefined => {
    if (codeRaw.trim()) {
      const c = codeRaw.trim().toUpperCase();
      const byCode = state.ues.find((u) => u.code.toUpperCase() === c);
      if (byCode) return byCode;
    }
    if (titleRaw.trim()) {
      const t = normalizeHeaderKey(titleRaw);
      const byTitle = state.ues.find((u) => normalizeHeaderKey(u.intitule) === t);
      if (byTitle) return byTitle;
    }
    return undefined;
  };

  wb.SheetNames.forEach((sheetName) => {
    const normSheet = normalizeHeaderKey(sheetName);
    if (
      normSheet.startsWith('synthese') ||
      normSheet.startsWith('etud') ||
      normSheet.startsWith('caisse') ||
      normSheet.startsWith('maquette')
    ) {
      return;
    }

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: '',
    });
    if (matrix.length === 0) return;

    // Detect optional single-student matricule in top banner cells (e.g. student transcript file)
    let sheetDefaultStudent: Student | undefined;
    for (let r = 0; r < Math.min(8, matrix.length); r++) {
      for (const cell of matrix[r] ?? []) {
        const text = String(cell ?? '').trim();
        if (!text) continue;
        const found = state.students.find((s) =>
          text.toLowerCase().includes(s.matricule.toLowerCase())
        );
        if (found) {
          sheetDefaultStudent = found;
          break;
        }
      }
      if (sheetDefaultStudent) break;
    }

    // Find the header row (contains Matricule, Code UE, Examen, Note Classe, CC, or Element constitutif)
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(15, matrix.length); r++) {
      const cells = (matrix[r] ?? []).map((c) => normalizeHeaderKey(String(c ?? '')));
      const hasMarker = cells.some(
        (k) =>
          k === 'matricule' ||
          k === 'codeue' ||
          k === 'examen' ||
          k === 'noteclasse' ||
          k === 'elementconstitutif'
      );
      if (hasMarker) {
        headerRowIdx = r;
        break;
      }
    }

    if (headerRowIdx < 0) return;

    const headers = (matrix[headerRowIdx] ?? []).map((h) => String(h ?? '').trim());
    const sheetYear = extractYearFromSheetName(sheetName);

    for (let r = headerRowIdx + 1; r < matrix.length; r++) {
      const line = matrix[r] ?? [];
      if (line.every((c) => String(c ?? '').trim() === '')) continue;

      const rowObj: Record<string, unknown> = {};
      headers.forEach((h, colIdx) => {
        if (h) rowObj[h] = line[colIdx];
      });

      const matricule = pickField(rowObj, ['Matricule', 'Étudiant', 'Etudiant']);
      const nom = pickField(rowObj, ['Nom']);
      const prenom = pickField(rowObj, ['Prénom', 'Prenom']);
      const fullName =
        nom && prenom
          ? `${nom} ${prenom}`
          : pickField(rowObj, ['Nom & Prénom', 'Nom complet', 'Étudiant', 'Etudiant']);
      const year =
        pickField(rowObj, ['Année Académique', 'Annee Academique', 'Année']) || sheetYear;

      const student =
        findStudentInState(matricule, fullName, year) ??
        (!matricule && !fullName ? sheetDefaultStudent : undefined);

      const codeUe = pickField(rowObj, ['Code UE', 'Code', 'UE']);
      const ueTitle = pickField(rowObj, [
        'Élément constitutif',
        'Element constitutif',
        'Matière',
        'Intitulé',
      ]);
      const ue = findUeInState(codeUe, ueTitle) ?? (!codeUe && !ueTitle ? fallbackUe : undefined);

      const hasAnyScoreCol =
        pickField(rowObj, ['Note Classe', 'CC', 'Classe', 'Moy. Classe', 'Moy Classe']) !== '' ||
        pickField(rowObj, ['TD']) !== '' ||
        pickField(rowObj, ['TP']) !== '' ||
        pickField(rowObj, ['Examen', 'Exam']) !== '' ||
        pickField(rowObj, ['Rattrapage', 'Rat']) !== '';

      if (!student || !ue) {
        if (matricule || codeUe || hasAnyScoreCol) skippedCount += 1;
        continue;
      }

      const cc = parseNullableScore(
        pickField(rowObj, ['Note Classe', 'CC', 'Classe', 'Moy. Classe', 'Moy Classe'])
      );
      const td = parseNullableScore(pickField(rowObj, ['TD']));
      const tp = parseNullableScore(pickField(rowObj, ['TP']));
      const examen = parseNullableScore(pickField(rowObj, ['Examen', 'Exam']));
      const rattrapage = parseNullableScore(pickField(rowObj, ['Rattrapage', 'Rat']));

      if (cc === null && td === null && tp === null && examen === null && rattrapage === null) {
        continue;
      }

      const key = `${student.id}__${ue.id}`;
      const existing =
        mergedByKey.get(key) ??
        state.grades.find((g) => g.studentId === student.id && g.ueId === ue.id);

      const nextRecord: GradeRecord = {
        id: existing?.id ?? `gr-imp-${student.id}-${ue.id}`,
        studentId: student.id,
        ueId: ue.id,
        cc: cc !== null ? cc : existing?.cc ?? null,
        td: td !== null ? td : existing?.td ?? null,
        tp: tp !== null ? tp : existing?.tp ?? null,
        examen: examen !== null ? examen : existing?.examen ?? null,
        rattrapage: rattrapage !== null ? rattrapage : existing?.rattrapage ?? null,
        updatedAt: new Date().toISOString().slice(0, 10),
      };

      const isNew = !state.grades.some(
        (g) => g.studentId === student.id && g.ueId === ue.id
      );
      if (!mergedByKey.has(key)) {
        if (isNew) createdCount += 1;
        else updatedCount += 1;
      }

      mergedByKey.set(key, nextRecord);
      ueCodesSet.add(ue.code);
      studentIdsSet.add(student.id);
      previewByKey.set(key, {
        matricule: student.matricule,
        studentName: `${student.nom} ${student.prenom}`,
        ueCode: ue.code,
        ueTitle: ue.intitule,
        cc: nextRecord.cc,
        td: nextRecord.td ?? null,
        tp: nextRecord.tp ?? null,
        examen: nextRecord.examen,
        rattrapage: nextRecord.rattrapage,
        isNew,
      });
    }
  });

  const records = Array.from(mergedByKey.values());
  if (records.length === 0) {
    throw new Error(
      "Aucune note valide détectée dans ce fichier. Utilisez un fichier Excel (.xlsx) ou CSV contenant les colonnes Matricule (ou Nom), Code UE (optionnel) et Note Classe / TD / TP / Examen / Rattrapage."
    );
  }

  return {
    fileName: file.name,
    createdCount,
    updatedCount,
    skippedCount,
    matchedUes: Array.from(ueCodesSet).sort(),
    matchedStudents: studentIdsSet.size,
    previewRows: Array.from(previewByKey.values()),
    records,
  };
}
