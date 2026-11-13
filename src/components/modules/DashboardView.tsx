import {
  ArrowRight,
  BookOpen,
  CreditCard,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { Campus, CerecState, ModuleId, UserRole } from '../../types/cerec';
import {
  computeStudentFinance,
  computeStudentSemesterSummary,
  formatFCFA,
  getPaymentAcademicYear,
} from '../../utils/lmd';

interface DashboardViewProps {
  state: CerecState;
  campusFilter: Campus | 'Tous';
  activeRole: UserRole;
  onNavigate: (module: ModuleId) => void;
}

export function DashboardView({
  state,
  campusFilter,
  activeRole,
  onNavigate,
}: DashboardViewProps) {
  const activeYear = state.settings.anneeAcademique;
  const students = state.students.filter(
    (s) =>
      s.anneeAcademique === activeYear &&
      (campusFilter === 'Tous' || s.campus === campusFilter)
  );
  const payments = state.payments.filter(
    (p) =>
      getPaymentAcademicYear(p, state.students) === activeYear &&
      (campusFilter === 'Tous' || p.campus === campusFilter)
  );
  const gateLogs = state.gateLogs.filter(
    (g) => campusFilter === 'Tous' || g.campus === campusFilter
  );

  // Financial aggregates
  let totalExpected = 0;
  let totalCollected = 0;
  let studentsInArrears = 0;
  students.forEach((s) => {
    const fin = computeStudentFinance(s, state.filieres, state.payments);
    totalExpected += fin.totalDu;
    totalCollected += fin.totalPaye;
    if (fin.statutFinancier === 'Retard critique') studentsInArrears += 1;
  });
  const recoveryPct =
    totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  // Academic averages
  const studentSummaries = students.map((s) =>
    computeStudentSemesterSummary(s, state.ues, state.grades, state.settings)
  );
  const graded = studentSummaries.filter((x) => x.moyenneGenerale !== null);
  const globalGpa =
    graded.length > 0
      ? (
          graded.reduce((acc, x) => acc + (x.moyenneGenerale ?? 0), 0) /
          graded.length
        ).toFixed(2)
      : '—';
  const admittedCount = graded.filter(
    (x) => x.decision === 'Admis' || x.decision === 'Admis par compensation'
  ).length;
  const passRate =
    graded.length > 0 ? Math.round((admittedCount / graded.length) * 100) : 0;

  // Attendance today
  const today = state.attendance[0]?.date ?? '2026-11-12';
  const todayAtt = state.attendance.filter((a) => {
    const st = students.find((s) => s.id === a.studentId);
    return st && a.date === today;
  });
  const presentToday = todayAtt.filter(
    (a) => a.statut === 'Présent' || a.statut === 'Retard'
  ).length;
  const attendancePct =
    todayAtt.length > 0 ? Math.round((presentToday / todayAtt.length) * 100) : 100;

  // Filiere breakdown
  const filiereStats = state.filieres.map((f) => {
    const fStudents = students.filter((s) => s.filiereCode === f.code);
    let expected = 0;
    let paid = 0;
    fStudents.forEach((s) => {
      const fin = computeStudentFinance(s, state.filieres, state.payments);
      expected += fin.totalDu;
      paid += fin.totalPaye;
    });
    return {
      ...f,
      count: fStudents.length,
      pct: expected > 0 ? Math.round((paid / expected) * 100) : 0,
      paid,
    };
  });

  const recentPayments = [...payments]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const gateAlerts = gateLogs.filter((g) => g.statutAcces !== 'Autorisé');

  const roleLabels: Record<UserRole, string> = {
    admin: 'Vue Direction & Administration Générale',
    direction: 'Vue Direction Académique & LMD',
    scolarite: 'Vue Scolarité, Inscriptions & Examens',
    caisse: 'Vue Caisse Centrale & Recouvrement',
    enseignant: 'Vue Corps Professoral',
    surveillance: 'Vue Surveillance & Contrôle Guérite',
  };

  return (
    <div className="space-y-6">
      {/* Contextual Hero Strip */}
      <div className="bg-[#0b1f3f] text-white rounded-lg p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 sm:gap-6 border border-[#143263]">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-[#eab33a]">
            {roleLabels[activeRole]} · Année académique {state.settings.anneeAcademique}
          </p>
          <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-white">
            Pilotage Académique & Administratif CEREC-ISCOM
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Suivi consolidé des effectifs LMD, des encaissements FCFA, des délibérations et du contrôle d’accès pour{' '}
            {campusFilter === 'Tous' ? 'Pointe-Noire et Brazzaville' : `le campus de ${campusFilter}`}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('etu')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Inscrire un étudiant
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('fin')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#143263] hover:bg-[#1a3e78] text-white border border-white/15 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Encaisser un règlement
          </button>
        </div>
      </div>

      {/* 4-Column KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-[#e3e7ef] rounded-lg p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Effectif inscrit</span>
            <Users className="w-4 h-4 text-[#143263]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-[#161e2e] tabular-nums">
            {students.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {students.filter((s) => s.campus === 'Pointe-Noire').length} Pointe-Noire ·{' '}
            {students.filter((s) => s.campus === 'Brazzaville').length} Brazzaville
          </p>
        </div>

        <div className="bg-white border border-[#e3e7ef] rounded-lg p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Recouvrement scolarité</span>
            <CreditCard className="w-4 h-4 text-[#c58b12]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-[#161e2e] tabular-nums">
            {recoveryPct}%
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {formatFCFA(totalCollected)} encaissés
          </p>
        </div>

        <div className="bg-white border border-[#e3e7ef] rounded-lg p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Moyenne & Réussite LMD</span>
            <BookOpen className="w-4 h-4 text-[#143263]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-[#161e2e] tabular-nums">
            {globalGpa} <span className="text-sm font-normal text-slate-500">/ 20</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {passRate}% de validation · {graded.length} dossiers évalués
          </p>
        </div>

        <div className="bg-white border border-[#e3e7ef] rounded-lg p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Assiduité & Guérite</span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-[#161e2e] tabular-nums">
            {attendancePct}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {studentsInArrears} retards financiers · {gateAlerts.length} alerte(s) accès
          </p>
        </div>
      </div>

      {/* Main 2-Column Operational Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Filières & Recouvrement */}
        <div className="lg:col-span-7 bg-white border border-[#e3e7ef] rounded-lg p-5">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#e3e7ef]">
            <div>
              <h3 className="text-sm font-semibold text-[#161e2e]">
                Répartition par Filière & Taux de Recouvrement
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Effectifs inscrits et progression des paiements par parcours LMD
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('aca')}
              className="text-xs font-semibold text-[#0e2447] hover:text-[#c58b12] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Voir les maquettes
            </button>
          </div>

          <div className="divide-y divide-[#e3e7ef] mt-2">
            {filiereStats.map((f) => (
              <div key={f.id} className="py-3.5 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 text-sm">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold text-[#0b1f3f] mr-2">
                      {f.code}
                    </span>
                    <span className="font-medium text-[#161e2e]">{f.nom}</span>
                    <span className="text-xs text-slate-500 ml-2">· {f.cycle}</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-xs font-mono tabular-nums">
                    <span className="text-slate-600">{f.count} étud.</span>
                    <span className="font-semibold text-[#0b1f3f]">{f.pct}%</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-[#0e2447] transition-all duration-300"
                    style={{ width: `${Math.max(f.pct, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Derniers Encaissements & Notes de service */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#e3e7ef] rounded-lg p-5">
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#e3e7ef]">
              <h3 className="text-sm font-semibold text-[#161e2e]">
                Derniers Encaissements Caisse
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('fin')}
                className="text-xs font-semibold text-[#0e2447] hover:text-[#c58b12] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Journal complet
              </button>
            </div>
            <div className="divide-y divide-[#e3e7ef] mt-1">
              {recentPayments.map((p) => {
                const st = state.students.find((s) => s.id === p.studentId);
                return (
                  <div
                    key={p.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[#161e2e] truncate">
                        {st ? `${st.nom} ${st.prenom}` : p.studentId}
                      </p>
                      <p className="text-slate-500 mt-0.5 truncate">
                        {p.motif} · {p.mode} · {p.date}
                      </p>
                    </div>
                    <span className="font-mono font-semibold text-emerald-700 tabular-nums shrink-0">
                      +{formatFCFA(p.montant)}
                    </span>
                  </div>
                );
              })}
              {recentPayments.length === 0 && (
                <p className="py-4 text-xs text-slate-500 text-center">
                  Aucun encaissement enregistré pour ce campus.
                </p>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#e3e7ef] rounded-lg p-5">
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#e3e7ef]">
              <h3 className="text-sm font-semibold text-[#161e2e]">
                Notes de service & Alertes
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('com')}
                className="text-xs font-semibold text-[#0e2447] hover:text-[#c58b12] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Diffusions
              </button>
            </div>
            <div className="divide-y divide-[#e3e7ef] mt-1">
              {state.announcements.slice(0, 3).map((ann) => (
                <div key={ann.id} className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#161e2e] line-clamp-1">
                      {ann.titre}
                    </span>
                    <span
                      className={`text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                        ann.priorite === 'Urgente'
                          ? 'bg-red-50 text-red-700'
                          : ann.priorite === 'Importante'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {ann.priorite}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {ann.cible} · {ann.campus} · {ann.date}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
