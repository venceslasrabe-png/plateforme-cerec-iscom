import {
  AlertCircle,
  Award,
  Download,
  Edit3,
  Printer,
  Upload,
  X,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { Campus, CerecState, GradeRecord, Student } from '../../types/cerec';
import {
  computeCohortRank,
  computeStudentSemesterSummary,
  formatOrdinalFr,
  getAvailablePeriodOptions,
  GradeImportResult,
  importGradesFromFile,
  isTrimesterCode,
  ueMatchesStudent,
} from '../../utils/lmd';
import {
  downloadBatchBulletinsPdf,
  downloadBulletinPdf,
} from '../../utils/bulletinPdf';
import { BulletinReleve } from '../BulletinReleve';
import { ImportGradesModal } from '../ImportGradesModal';
import { OfficialDocumentHeader, PrintModal } from '../PrintModal';
import { QrCodeSvg } from '../QrCodeSvg';

interface ExamsViewProps {
  state: CerecState;
  campusFilter: Campus | 'Tous';
  canDeliberateAndRattrapage?: boolean;
  onUpsertGrade: (grade: GradeRecord) => void;
  onBulkUpsertGrades: (records: GradeRecord[]) => void;
  onNotify: (msg: string) => void;
}

export function ExamsView({
  state,
  campusFilter,
  canDeliberateAndRattrapage = true,
  onUpsertGrade,
  onBulkUpsertGrades,
  onNotify,
}: ExamsViewProps) {
  const [filiereFilter, setFiliereFilter] = useState(state.filieres[0]?.code ?? 'GCF');
  const [optionFilter, setOptionFilter] = useState('Toutes');
  const [niveauFilter, setNiveauFilter] = useState('L1');
  const [decisionFilter, setDecisionFilter] = useState('Toutes');
  const [pvOpen, setPvOpen] = useState(false);
  const [bulletinStudent, setBulletinStudent] = useState<Student | null>(null);
  const [printBatchBulletins, setPrintBatchBulletins] = useState(false);
  const [bulletinSemestre, setBulletinSemestre] = useState<string>('Tous');
  const [rattrapageStudent, setRattrapageStudent] = useState<Student | null>(null);
  const [rattrapageInputs, setRattrapageInputs] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<GradeImportResult | null>(null);

  const periodOptions = getAvailablePeriodOptions(state);

  const availableOptions =
    filiereFilter === 'Toutes'
      ? Array.from(new Set(state.filieres.flatMap((f) => f.options ?? [])))
      : state.filieres.find((f) => f.code === filiereFilter)?.options ?? [];

  const cohortStudents = state.students.filter((s) => {
    if (s.anneeAcademique !== state.settings.anneeAcademique) return false;
    if (campusFilter !== 'Tous' && s.campus !== campusFilter) return false;
    if (filiereFilter !== 'Toutes' && s.filiereCode !== filiereFilter) return false;
    if (optionFilter !== 'Toutes' && s.option !== optionFilter) return false;
    if (niveauFilter !== 'Tous' && s.niveau !== niveauFilter) return false;
    return true;
  });

  const allRows = cohortStudents.map((student) => ({
    student,
    summary: computeStudentSemesterSummary(
      student,
      state.ues,
      state.grades,
      state.settings
    ),
    rank: computeCohortRank(
      student,
      state.students,
      state.ues,
      state.grades,
      state.settings
    ),
  }));

  const rows = allRows.filter(
    (r) => decisionFilter === 'Toutes' || r.summary.decision === decisionFilter
  );

  const admitted = allRows.filter(
    (r) =>
      r.summary.decision === 'Admis' || r.summary.decision === 'Admis par compensation'
  ).length;
  const rattrapage = allRows.filter((r) => r.summary.decision === 'Rattrapage').length;
  const ajourne = allRows.filter((r) => r.summary.decision === 'Ajourné').length;

  const openRattrapageModal = (student: Student) => {
    if (!canDeliberateAndRattrapage) return;
    const summary = computeStudentSemesterSummary(
      student,
      state.ues,
      state.grades,
      state.settings
    );
    const initial: Record<string, string> = {};
    summary.details.forEach((d) => {
      if ((d.moyenneNormale ?? 20) < state.settings.seuilValidation) {
        initial[d.ue.id] =
          d.grade?.rattrapage !== null && d.grade?.rattrapage !== undefined
            ? String(d.grade.rattrapage)
            : '';
      }
    });
    setRattrapageInputs(initial);
    setRattrapageStudent(student);
  };

  const handleSaveRattrapage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDeliberateAndRattrapage || !rattrapageStudent) return;
    Object.entries(rattrapageInputs).forEach(([ueId, raw]) => {
      const existing = state.grades.find(
        (g) => g.studentId === rattrapageStudent.id && g.ueId === ueId
      );
      const val = raw.trim() === '' ? null : Math.min(20, Math.max(0, Number(raw)));
      onUpsertGrade({
        id: existing?.id ?? `gr-${rattrapageStudent.id}-${ueId}`,
        studentId: rattrapageStudent.id,
        ueId,
        cc: existing?.cc ?? null,
        td: existing?.td ?? null,
        tp: existing?.tp ?? null,
        examen: existing?.examen ?? null,
        rattrapage: val !== null && !Number.isNaN(val) ? val : null,
        updatedAt: new Date().toISOString().slice(0, 10),
      });
    });
    onNotify(`Notes de rattrapage enregistrées pour ${rattrapageStudent.nom}.`);
    setRattrapageStudent(null);
  };

  return (
    <div className="space-y-5">
      {/* Cohort & Deliberation Toolbar */}
      <div className="bg-white border border-[#e3e7ef] rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2.5 flex-1">
          <select
            value={filiereFilter}
            onChange={(e) => {
              setFiliereFilter(e.target.value);
              setOptionFilter('Toutes');
            }}
            aria-label="Filière délibération"
            className="w-full lg:w-auto px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white text-[#161e2e]"
          >
            <option value="Toutes">Toutes les filières</option>
            {state.filieres.map((f) => (
              <option key={f.id} value={f.code}>
                {f.code} — {f.nom}
              </option>
            ))}
          </select>

          <select
            value={optionFilter}
            onChange={(e) => setOptionFilter(e.target.value)}
            aria-label="Option délibération"
            className="w-full lg:w-auto px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white text-[#161e2e]"
          >
            <option value="Toutes">Toutes les options</option>
            {availableOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          <select
            value={niveauFilter}
            onChange={(e) => setNiveauFilter(e.target.value)}
            aria-label="Niveau délibération"
            className="w-full lg:w-auto px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white text-[#161e2e]"
          >
            <option value="Tous">Tous niveaux</option>
            {['L1', 'L2', 'L3', 'M1', 'M2', 'FQ'].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <select
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value)}
            aria-label="Filtrer par décision"
            className="w-full lg:w-auto px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white text-[#161e2e]"
          >
            <option value="Toutes">Toutes décisions</option>
            <option value="Admis">Admis</option>
            <option value="Admis par compensation">Admis par compensation</option>
            <option value="Rattrapage">Rattrapage</option>
            <option value="Ajourné">Ajourné</option>
            <option value="En cours">En cours</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {canDeliberateAndRattrapage && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setImporting(true);
                  setImportError(null);
                  try {
                    const res = await importGradesFromFile(file, state);
                    setImportPreview(res);
                  } catch (err) {
                    setImportError(
                      err instanceof Error
                        ? err.message
                        : "Impossible d'importer ce relevé de notes."
                    );
                  } finally {
                    setImporting(false);
                  }
                }}
                className="hidden"
                aria-label="Importer un relevé de notes Excel ou CSV"
              />
              <button
                type="button"
                disabled={importing}
                onClick={() => {
                  setImportError(null);
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#0b1f3f] bg-white hover:bg-slate-50 disabled:opacity-50 text-[#0b1f3f] text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                {importing ? 'Analyse…' : 'Importer relevé de notes'}
              </button>
            </>
          )}
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={() => {
              setBulletinSemestre('Tous');
              if (rows.length === 1) {
                setBulletinStudent(rows[0].student);
              } else {
                setPrintBatchBulletins(true);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] disabled:opacity-50 text-[#07142b] text-xs font-bold whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimer relevés de notes ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setPvOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#eab33a]" />
            Générer le PV de Délibération
          </button>
        </div>
      </div>

      {importError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1 leading-relaxed">{importError}</span>
          <button
            type="button"
            onClick={() => setImportError(null)}
            aria-label="Fermer l'alerte d'importation"
            className="text-red-500 hover:text-red-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Deliberation Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#e3e7ef] rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Admis / Compensation LMD</p>
            <p className="font-mono text-xl font-bold text-emerald-700 mt-1 tabular-nums">
              {admitted}
            </p>
          </div>
          <Award className="w-5 h-5 text-emerald-700" />
        </div>
        <div className="bg-white border border-[#e3e7ef] rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Session de Rattrapage</p>
            <p className="font-mono text-xl font-bold text-amber-700 mt-1 tabular-nums">
              {rattrapage}
            </p>
          </div>
          <span className="font-mono text-xs text-amber-700 font-semibold">UE &lt; 10</span>
        </div>
        <div className="bg-white border border-[#e3e7ef] rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Ajournés / En cours</p>
            <p className="font-mono text-xl font-bold text-[#161e2e] mt-1 tabular-nums">
              {ajourne + (allRows.length - admitted - rattrapage - ajourne)}
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500">Cohorte: {allRows.length}</span>
        </div>
      </div>

      {/* Deliberation Mobile Cards & Desktop Table */}
      <div className="bg-white border border-[#e3e7ef] rounded-lg overflow-hidden">
        <div className="md:hidden divide-y divide-[#e3e7ef]">
          {rows.map(({ student, summary, rank }) => (
            <div key={student.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-[#0b1f3f]">
                    {student.matricule}
                  </p>
                  <p className="font-semibold text-sm text-[#161e2e] truncate">
                    {student.nom} {student.prenom}
                  </p>
                  <p className="text-xs text-slate-500">
                    {student.filiereCode} · {student.niveau}
                    {student.option ? ` · ${student.option}` : ''} · {student.campus}
                  </p>
                </div>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium shrink-0 ${
                    summary.decision === 'Admis' ||
                    summary.decision === 'Admis par compensation'
                      ? 'bg-emerald-50 text-emerald-700'
                      : summary.decision === 'Rattrapage'
                      ? 'bg-amber-50 text-amber-800'
                      : summary.decision === 'Ajourné'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {summary.decision}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs bg-[#f8f9fb] border border-[#e3e7ef] rounded-lg p-2.5">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Moyenne</span>
                  <span className="font-mono font-bold text-[#161e2e] tabular-nums">
                    {summary.moyenneGenerale !== null ? `${summary.moyenneGenerale.toFixed(2)}/20` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">ECTS</span>
                  <span className="font-mono font-semibold text-slate-700 tabular-nums">
                    {summary.creditsAcquis}/{summary.creditsTotaux}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Rang</span>
                  <span className="font-mono text-slate-700 tabular-nums">
                    {rank.rang ? `${formatOrdinalFr(rank.rang)} / ${rank.totalCandidats}` : '—'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-600">
                  Mention : <strong className="text-[#161e2e]">{summary.mention}</strong>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {canDeliberateAndRattrapage &&
                    (summary.decision === 'Rattrapage' || summary.decision === 'Ajourné') && (
                      <button
                        type="button"
                        onClick={() => openRattrapageModal(student)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Rattrapage
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={async () => {
                      const fileName = await downloadBulletinPdf(student, state);
                      onNotify(`PDF téléchargé : ${fileName}`);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulletinSemestre('Tous');
                      setBulletinStudent(student);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#e3e7ef] text-xs font-semibold text-[#0b1f3f] cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Relevé
                  </button>
                </div>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="py-8 px-4 text-center text-sm text-slate-500">
              Aucun étudiant dans cette sélection de jury.
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#f8f9fb] border-b border-[#e3e7ef] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Matricule</th>
                <th className="py-3 px-4">Étudiant</th>
                <th className="py-3 px-4">Parcours</th>
                <th className="py-3 px-4 text-right">Crédits ECTS</th>
                <th className="py-3 px-4 text-right">Moyenne</th>
                <th className="py-3 px-4 text-center">Rang</th>
                <th className="py-3 px-4">Mention</th>
                <th className="py-3 px-4">Décision du Jury</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e7ef]">
              {rows.map(({ student, summary, rank }) => (
                <tr key={student.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-[#0b1f3f]">
                    {student.matricule}
                  </td>
                  <td className="py-3 px-4 font-medium text-[#161e2e]">
                    {student.nom} {student.prenom}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    <p className="font-medium text-[#161e2e]">
                      {student.filiereCode} · {student.niveau}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {student.option ? `${student.option} · ` : ''}
                      {student.campus}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    {summary.creditsAcquis} / {summary.creditsTotaux}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                    {summary.moyenneGenerale !== null
                      ? summary.moyenneGenerale.toFixed(2)
                      : '—'}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-xs text-slate-700 tabular-nums">
                    {rank.rang ? `${formatOrdinalFr(rank.rang)} / ${rank.totalCandidats}` : '—'}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700">{summary.mention}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        summary.decision === 'Admis' ||
                        summary.decision === 'Admis par compensation'
                          ? 'bg-emerald-50 text-emerald-700'
                          : summary.decision === 'Rattrapage'
                          ? 'bg-amber-50 text-amber-800'
                          : summary.decision === 'Ajourné'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {summary.decision}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {canDeliberateAndRattrapage &&
                        (summary.decision === 'Rattrapage' || summary.decision === 'Ajourné') && (
                          <button
                            type="button"
                            onClick={() => openRattrapageModal(student)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold cursor-pointer whitespace-nowrap"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Rattrapage
                          </button>
                        )}
                      <button
                        type="button"
                        onClick={async () => {
                          const fileName = await downloadBulletinPdf(student, state);
                          onNotify(`PDF téléchargé : ${fileName}`);
                        }}
                        title="Télécharger le relevé de notes en PDF"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold cursor-pointer whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBulletinSemestre('Tous');
                          setBulletinStudent(student);
                        }}
                        title="Aperçu et impression du relevé de notes officiel"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-semibold text-[#0b1f3f] cursor-pointer whitespace-nowrap"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Relevé
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-sm text-slate-500">
                    Aucun étudiant dans cette sélection de jury.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inline Rattrapage Entry Modal */}
      {canDeliberateAndRattrapage && rattrapageStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142b]/70 p-3 sm:p-4">
          <div className="bg-white border border-[#e3e7ef] rounded-xl w-full max-w-md shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#e3e7ef] bg-[#f8f9fb] shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[#161e2e]">
                  Saisie Session de Rattrapage
                </h3>
                <p className="text-xs text-slate-500 truncate">
                  {rattrapageStudent.nom} {rattrapageStudent.prenom} · {rattrapageStudent.matricule}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRattrapageStudent(null)}
                className="p-1 text-slate-500 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveRattrapage} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {Object.keys(rattrapageInputs).map((ueId) => {
                const ue = state.ues.find((u) => u.id === ueId);
                return (
                  <div key={ueId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#0b1f3f] truncate">
                        {ue?.code} — {ue?.intitule}
                      </p>
                    </div>
                    <input
                      type="number"
                      step="0.25"
                      min={0}
                      max={20}
                      value={rattrapageInputs[ueId]}
                      onChange={(e) =>
                        setRattrapageInputs({
                          ...rattrapageInputs,
                          [ueId]: e.target.value,
                        })
                      }
                      placeholder="/20"
                      className="w-full sm:w-24 px-2.5 py-1.5 text-center font-mono text-sm border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                );
              })}
              <div className="flex justify-end gap-3 pt-3 border-t border-[#e3e7ef]">
                <button
                  type="button"
                  onClick={() => setRattrapageStudent(null)}
                  className="px-4 py-2 rounded-lg border border-[#e3e7ef] text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0b1f3f] text-white text-xs font-semibold cursor-pointer"
                >
                  Enregistrer le rattrapage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Individual Bulletin */}
      {bulletinStudent && (
        <PrintModal
          title={`Relevé de notes — ${bulletinStudent.nom} ${bulletinStudent.prenom}`}
          subtitle={`${bulletinStudent.matricule} · ${bulletinStudent.filiereCode} ${bulletinStudent.niveau} · ${bulletinStudent.anneeAcademique}`}
          printLabel="Imprimer"
          pdfButtonLabel="Télécharger le relevé PDF"
          onDownloadPdf={async () => {
            const sem = bulletinSemestre === 'Tous' ? undefined : bulletinSemestre;
            const fileName = await downloadBulletinPdf(bulletinStudent, state, sem);
            onNotify(`Relevé PDF téléchargé : ${fileName}`);
          }}
          toolbarExtra={
            <select
              value={bulletinSemestre}
              onChange={(e) => setBulletinSemestre(e.target.value)}
              aria-label="Période du relevé"
              className="px-2.5 py-1.5 text-xs font-semibold border border-[#e3e7ef] rounded-lg bg-white text-[#0b1f3f]"
            >
              <option value="Tous">Toutes périodes</option>
              {Array.from(
                new Set(
                  state.ues
                    .filter((u) => ueMatchesStudent(u, bulletinStudent))
                    .map((u) => u.semestre)
                )
              )
                .sort()
                .map((sem) => (
                  <option key={sem} value={sem}>
                    {isTrimesterCode(sem) ? `Trimestre ${sem}` : `Semestre ${sem}`}
                  </option>
                ))}
            </select>
          }
          onClose={() => setBulletinStudent(null)}
        >
          <BulletinReleve
            student={bulletinStudent}
            state={state}
            semestre={bulletinSemestre === 'Tous' ? undefined : bulletinSemestre}
          />
        </PrintModal>
      )}

      {/* Batch Printable Cohort Bulletins */}
      {printBatchBulletins && rows.length > 0 && (
        <PrintModal
          title={`Relevés de notes — ${filiereFilter} ${niveauFilter}`}
          subtitle={`${rows.length} étudiant(s) · Année ${state.settings.anneeAcademique}`}
          printLabel="Imprimer tout"
          pdfButtonLabel={`Télécharger PDF (${rows.length})`}
          onDownloadPdf={async () => {
            const sem = bulletinSemestre === 'Tous' ? undefined : bulletinSemestre;
            const fileName = await downloadBatchBulletinsPdf(
              rows.map((r) => r.student),
              state,
              sem,
              `${filiereFilter}_${niveauFilter}`
            );
            onNotify(`Relevés PDF téléchargés : ${fileName}`);
          }}
          toolbarExtra={
            <select
              value={bulletinSemestre}
              onChange={(e) => setBulletinSemestre(e.target.value)}
              aria-label="Période des relevés"
              className="px-2.5 py-1.5 text-xs font-semibold border border-[#e3e7ef] rounded-lg bg-white text-[#0b1f3f]"
            >
              <option value="Tous">Toutes périodes</option>
              {periodOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          }
          onClose={() => setPrintBatchBulletins(false)}
        >
          <div className="space-y-8">
            {rows.map(({ student }, idx) => (
              <div
                key={student.id}
                className={
                  idx < rows.length - 1
                    ? 'pb-8 border-b-2 border-dashed border-slate-300 print:border-none print:pb-0 print:break-after-page'
                    : ''
                }
              >
                <BulletinReleve
                  student={student}
                  state={state}
                  semestre={bulletinSemestre === 'Tous' ? undefined : bulletinSemestre}
                />
              </div>
            ))}
          </div>
        </PrintModal>
      )}

      {/* Printable PV de Délibération */}
      {pvOpen && (
        <PrintModal
          title="Procès-Verbal de Délibération du Jury LMD"
          subtitle={`Filière : ${filiereFilter} · Niveau : ${niveauFilter}`}
          onClose={() => setPvOpen(false)}
        >
          <div className="space-y-5 text-xs">
            <OfficialDocumentHeader
              campus={campusFilter === 'Tous' ? 'Pointe-Noire & Brazzaville' : campusFilter}
              docTitle="Procès-Verbal de Délibération"
              docRef={`PV-${filiereFilter}-${niveauFilter}-${state.settings.anneeAcademique.slice(0, 4)}`}
              academicYear={state.settings.anneeAcademique}
            />

            <p className="text-slate-700 leading-relaxed">
              Le Jury académique du Groupe CEREC-ISCOM, réuni en session de délibération LMD pour la
              filière <strong>{filiereFilter}</strong> ({niveauFilter}), arrête les résultats
              ci-dessous conformément au règlement des études (validation à{' '}
              {state.settings.seuilValidation}/20 et compensation semestrielle) :
            </p>

            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left border-collapse border border-[#e3e7ef]">
                <thead>
                  <tr className="bg-[#0b1f3f] text-white text-[11px] uppercase">
                    <th className="py-2 px-3">Matricule</th>
                    <th className="py-2 px-3">Nom & Prénom</th>
                    <th className="py-2 px-3 text-center">Crédits</th>
                    <th className="py-2 px-3 text-right">Moyenne</th>
                    <th className="py-2 px-3 text-center">Rang</th>
                    <th className="py-2 px-3">Mention</th>
                    <th className="py-2 px-3">Décision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e7ef]">
                  {rows.map(({ student, summary, rank }) => (
                    <tr key={student.id}>
                      <td className="py-2 px-3 font-mono">{student.matricule}</td>
                      <td className="py-2 px-3 font-semibold">
                        {student.nom} {student.prenom}
                      </td>
                      <td className="py-2 px-3 text-center font-mono tabular-nums">
                        {summary.creditsAcquis}/{summary.creditsTotaux}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold tabular-nums">
                        {summary.moyenneGenerale?.toFixed(2) ?? '—'}
                      </td>
                      <td className="py-2 px-3 text-center font-mono">
                        {rank.rang ? formatOrdinalFr(rank.rang) : '—'}
                      </td>
                      <td className="py-2 px-3">{summary.mention}</td>
                      <td className="py-2 px-3 font-semibold">{summary.decision}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row print:flex-row items-center sm:items-end print:items-end justify-between gap-6 pt-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-6 w-full flex-1 text-center">
                <div>
                  <p className="font-semibold">Le Président du Jury</p>
                  <div className="h-12 border-b border-dashed border-slate-300 mx-4" />
                </div>
                <div>
                  <p className="font-semibold">Le Directeur Académique</p>
                  <div className="h-12 border-b border-dashed border-slate-300 mx-4" />
                </div>
                <div>
                  <p className="font-semibold">Le Service Scolarité</p>
                  <div className="h-12 border-b border-dashed border-slate-300 mx-4" />
                </div>
              </div>
              <QrCodeSvg
                value={`CEREC-ISCOM|PV-JURY|${filiereFilter}|${niveauFilter}|${state.settings.anneeAcademique}|ADMIS:${admitted}/${allRows.length}`}
                size={68}
              />
            </div>
          </div>
        </PrintModal>
      )}

      {canDeliberateAndRattrapage && importPreview && (
        <ImportGradesModal
          result={importPreview}
          onCancel={() => setImportPreview(null)}
          onConfirm={() => {
            onBulkUpsertGrades(importPreview.records);
            onNotify(
              `Relevé importé : ${importPreview.records.length} note(s) enregistrée(s) (${importPreview.matchedUes.join(', ')}).`
            );
            setImportPreview(null);
          }}
        />
      )}
    </div>
  );
}
