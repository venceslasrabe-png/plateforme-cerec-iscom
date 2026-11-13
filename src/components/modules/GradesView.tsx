import {
  AlertCircle,
  CheckCircle2,
  Download,
  Printer,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { Campus, CerecState, GradeRecord, Student } from '../../types/cerec';
import {
  computeUeAverage,
  exportGradesTemplateToExcel,
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

interface GradesViewProps {
  state: CerecState;
  campusFilter: Campus | 'Tous';
  onUpsertGrade: (grade: GradeRecord) => void;
  onBulkUpsertGrades: (records: GradeRecord[]) => void;
  onDeleteGrade: (studentId: string, ueId: string) => void;
  onNotify: (msg: string) => void;
}

export function GradesView({
  state,
  campusFilter,
  onUpsertGrade,
  onBulkUpsertGrades,
  onDeleteGrade,
  onNotify,
}: GradesViewProps) {
  const [selectedUeId, setSelectedUeId] = useState(state.ues[0]?.id ?? '');
  const [transcriptStudent, setTranscriptStudent] = useState<Student | null>(null);
  const [printBatch, setPrintBatch] = useState(false);
  const [transcriptSemestre, setTranscriptSemestre] = useState<string>('Tous');
  const [printGrid, setPrintGrid] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<GradeImportResult | null>(null);

  const selectedUe = state.ues.find((u) => u.id === selectedUeId) ?? state.ues[0];
  const periodOptions = getAvailablePeriodOptions(state);

  const classStudents = state.students.filter((s) => {
    if (s.anneeAcademique !== state.settings.anneeAcademique) return false;
    if (campusFilter !== 'Tous' && s.campus !== campusFilter) return false;
    if (!selectedUe) return true;
    return ueMatchesStudent(selectedUe, s);
  });

  const handleGradeChange = (
    studentId: string,
    field: 'cc' | 'td' | 'tp' | 'examen' | 'rattrapage',
    raw: string
  ) => {
    if (!selectedUe) return;
    const existing = state.grades.find(
      (g) => g.studentId === studentId && g.ueId === selectedUe.id
    );
    const val = raw.trim() === '' ? null : Math.min(20, Math.max(0, Number(raw)));
    const next: GradeRecord = {
      id: existing?.id ?? `gr-${studentId}-${selectedUe.id}`,
      studentId,
      ueId: selectedUe.id,
      cc: existing?.cc ?? null,
      td: existing?.td ?? null,
      tp: existing?.tp ?? null,
      examen: existing?.examen ?? null,
      rattrapage: existing?.rattrapage ?? null,
      [field]: Number.isNaN(val) ? null : val,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    onUpsertGrade(next);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImporting(true);
    setImportError(null);
    try {
      const result = await importGradesFromFile(file, state, selectedUe?.id);
      setImportPreview(result);
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : "Impossible d'importer ce relevé de notes."
      );
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = () => {
    if (!importPreview) return;
    onBulkUpsertGrades(importPreview.records);
    onNotify(
      `Relevé importé : ${importPreview.records.length} note(s) enregistrée(s) (${importPreview.matchedUes.join(', ')}).`
    );
    setImportPreview(null);
  };

  return (
    <div className="space-y-5">
      {/* UE Selector & Actions */}
      <div className="bg-white border border-[#e3e7ef] rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1 max-w-xl">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Élément constitutif (ECUE / Matière) pour saisie des notes
          </label>
          <select
            value={selectedUe?.id ?? ''}
            onChange={(e) => setSelectedUeId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white text-[#161e2e]"
          >
            {state.ues.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} — {u.intitule} ({u.filiereCode} · {u.option || 'Tronc commun'} · {u.niveau} ·{' '}
                {u.semestre})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportFile}
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#0b1f3f] bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-[#0b1f3f] cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            {importing ? 'Analyse…' : 'Importer relevé de notes'}
          </button>
          {selectedUe && (
            <button
              type="button"
              onClick={() => {
                exportGradesTemplateToExcel(state, selectedUe, classStudents);
                onNotify(`Modèle Excel ${selectedUe.code} téléchargé.`);
              }}
              title="Télécharger le modèle Excel pré-rempli pour cette matière"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Modèle (.xlsx)
            </button>
          )}
          <button
            type="button"
            disabled={classStudents.length === 0}
            onClick={() => {
              setTranscriptSemestre(selectedUe?.semestre ?? 'Tous');
              if (classStudents.length === 1) {
                setTranscriptStudent(classStudents[0]);
              } else {
                setPrintBatch(true);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] disabled:opacity-50 text-[#07142b] text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimer relevé de notes ({classStudents.length})
          </button>
          <button
            type="button"
            onClick={() => setPrintGrid(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-semibold text-[#0b1f3f] cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimer la grille
          </button>
          <button
            type="button"
            onClick={() =>
              onNotify(
                `Notes de ${selectedUe?.code ?? 'la matière'} validées et enregistrées.`
              )
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#eab33a]" />
            Valider la saisie
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

      {/* Inline Grade Matrix */}
      <div className="bg-white border border-[#e3e7ef] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e3e7ef] bg-[#f8f9fb] flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#161e2e]">
            Grille de saisie LMD · {selectedUe?.code} · {selectedUe?.filiereCode} (
            {selectedUe?.option || 'Tronc commun'}) — {classStudents.length} étudiants
          </h3>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            Classe: {Math.round(state.settings.poidsCC * 100)}% · Exam:{' '}
            {Math.round(state.settings.poidsExamen * 100)}% · Coef: {selectedUe?.coefficient} ·
            Seuil: {state.settings.seuilValidation}/20
          </span>
        </div>

        {/* Mobile Grade Entry Cards */}
        <div className="md:hidden divide-y divide-[#e3e7ef]">
          {classStudents.map((s) => {
            const grade = state.grades.find(
              (g) => g.studentId === s.id && g.ueId === selectedUe?.id
            );
            const calc = computeUeAverage(grade, state.settings);
            const needsRat =
              calc.moyenneNormale !== null &&
              calc.moyenneNormale < state.settings.seuilValidation;

            return (
              <div key={s.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-[#0b1f3f]">{s.matricule}</p>
                    <p className="font-semibold text-sm text-[#161e2e] truncate">
                      {s.nom} {s.prenom}
                    </p>
                    <p className="text-[11px] text-slate-500">{s.campus}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                        calc.statut === 'Validé'
                          ? 'bg-emerald-50 text-emerald-700'
                          : calc.statut === 'Rattrapage'
                          ? 'bg-amber-50 text-amber-800'
                          : calc.statut === 'Non validé'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {calc.statut}
                    </span>
                    <p className="font-mono text-sm font-bold text-[#161e2e] tabular-nums">
                      Moy. {calc.moyenneFinale !== null ? calc.moyenneFinale.toFixed(2) : '—'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-0.5">
                      Classe
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min={0}
                      max={20}
                      value={grade?.cc ?? ''}
                      onChange={(e) => handleGradeChange(s.id, 'cc', e.target.value)}
                      className="w-full px-2 py-1.5 text-center font-mono text-xs border border-[#e3e7ef] rounded tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-0.5">
                      TD
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min={0}
                      max={20}
                      placeholder="—"
                      value={grade?.td ?? ''}
                      onChange={(e) => handleGradeChange(s.id, 'td', e.target.value)}
                      className="w-full px-2 py-1.5 text-center font-mono text-xs border border-[#e3e7ef] rounded tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-0.5">
                      TP
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min={0}
                      max={20}
                      placeholder="—"
                      value={grade?.tp ?? ''}
                      onChange={(e) => handleGradeChange(s.id, 'tp', e.target.value)}
                      className="w-full px-2 py-1.5 text-center font-mono text-xs border border-[#e3e7ef] rounded tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-0.5">
                      Examen
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min={0}
                      max={20}
                      value={grade?.examen ?? ''}
                      onChange={(e) => handleGradeChange(s.id, 'examen', e.target.value)}
                      className="w-full px-2 py-1.5 text-center font-mono text-xs border border-[#e3e7ef] rounded tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-0.5">
                      Rattrap.
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min={0}
                      max={20}
                      disabled={!needsRat && grade?.rattrapage == null}
                      placeholder={needsRat ? 'Saisir' : '—'}
                      value={grade?.rattrapage ?? ''}
                      onChange={(e) => handleGradeChange(s.id, 'rattrapage', e.target.value)}
                      className="w-full px-2 py-1.5 text-center font-mono text-xs border border-[#e3e7ef] rounded disabled:bg-slate-50 disabled:text-slate-400 tabular-nums"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <span className="text-[10px] font-semibold uppercase text-slate-500 mb-0.5">
                      Moy. Cl.
                    </span>
                    <div className="px-2 py-1.5 text-center font-mono text-xs bg-[#f8f9fb] border border-[#e3e7ef] rounded text-slate-700 tabular-nums">
                      {calc.moyClasse !== null ? calc.moyClasse.toFixed(2) : '—'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      const sem =
                        selectedUe?.semestre && selectedUe.semestre !== 'Tous'
                          ? selectedUe.semestre
                          : undefined;
                      const fileName = await downloadBulletinPdf(s, state, sem);
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
                      setTranscriptSemestre(selectedUe?.semestre ?? 'Tous');
                      setTranscriptStudent(s);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#e3e7ef] text-xs font-semibold text-[#0b1f3f] cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Relevé
                  </button>
                  {grade && selectedUe && (
                    <button
                      type="button"
                      onClick={() => onDeleteGrade(s.id, selectedUe.id)}
                      aria-label={`Effacer notes ${s.nom}`}
                      className="p-1.5 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {classStudents.length === 0 && (
            <div className="py-8 px-4 text-center text-sm text-slate-500">
              Aucun étudiant dans ce parcours pour le campus sélectionné.
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e3e7ef] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3">Matricule</th>
                <th className="py-3 px-3">Étudiant</th>
                <th className="py-3 px-2 text-center">Classe</th>
                <th className="py-3 px-2 text-center">TD</th>
                <th className="py-3 px-2 text-center">TP</th>
                <th className="py-3 px-2 text-right">Moy. Cl.</th>
                <th className="py-3 px-2 text-center">Examen</th>
                <th className="py-3 px-2 text-center">Rattrap.</th>
                <th className="py-3 px-3 text-right">Moy. Gén</th>
                <th className="py-3 px-3">Statut</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e7ef]">
              {classStudents.map((s) => {
                const grade = state.grades.find(
                  (g) => g.studentId === s.id && g.ueId === selectedUe?.id
                );
                const calc = computeUeAverage(grade, state.settings);
                const needsRat =
                  calc.moyenneNormale !== null &&
                  calc.moyenneNormale < state.settings.seuilValidation;

                return (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono text-xs font-semibold text-[#0b1f3f] whitespace-nowrap">
                      {s.matricule}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-medium text-[#161e2e] whitespace-nowrap">
                        {s.nom} {s.prenom}
                      </p>
                      <p className="text-[11px] text-slate-500">{s.campus}</p>
                    </td>
                    <td className="py-2.5 px-1.5 text-center">
                      <input
                        type="number"
                        step="0.25"
                        min={0}
                        max={20}
                        value={grade?.cc ?? ''}
                        onChange={(e) => handleGradeChange(s.id, 'cc', e.target.value)}
                        aria-label={`Note Classe ${s.nom}`}
                        className="w-16 px-1.5 py-1.5 text-center font-mono text-xs border border-[#e3e7ef] rounded focus:outline-none focus:border-[#0b1f3f] tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 px-1.5 text-center">
                      <input
                        type="number"
                        step="0.25"
                        min={0}
                        max={20}
                        value={grade?.td ?? ''}
                        onChange={(e) => handleGradeChange(s.id, 'td', e.target.value)}
                        aria-label={`Note TD ${s.nom}`}
                        placeholder="—"
                        className="w-14 px-1.5 py-1.5 text-center font-mono text-xs border border-[#e3e7ef] rounded focus:outline-none focus:border-[#0b1f3f] tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 px-1.5 text-center">
                      <input
                        type="number"
                        step="0.25"
                        min={0}
                        max={20}
                        value={grade?.tp ?? ''}
                        onChange={(e) => handleGradeChange(s.id, 'tp', e.target.value)}
                        aria-label={`Note TP ${s.nom}`}
                        placeholder="—"
                        className="w-14 px-1.5 py-1.5 text-center font-mono text-xs border border-[#e3e7ef] rounded focus:outline-none focus:border-[#0b1f3f] tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-xs text-slate-600 tabular-nums">
                      {calc.moyClasse !== null ? calc.moyClasse.toFixed(2) : '—'}
                    </td>
                    <td className="py-2.5 px-1.5 text-center">
                      <input
                        type="number"
                        step="0.25"
                        min={0}
                        max={20}
                        value={grade?.examen ?? ''}
                        onChange={(e) => handleGradeChange(s.id, 'examen', e.target.value)}
                        aria-label={`Note Examen ${s.nom}`}
                        className="w-16 px-1.5 py-1.5 text-center font-mono text-xs border border-[#e3e7ef] rounded focus:outline-none focus:border-[#0b1f3f] tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 px-1.5 text-center">
                      <input
                        type="number"
                        step="0.25"
                        min={0}
                        max={20}
                        disabled={!needsRat && grade?.rattrapage == null}
                        value={grade?.rattrapage ?? ''}
                        onChange={(e) => handleGradeChange(s.id, 'rattrapage', e.target.value)}
                        aria-label={`Note Rattrapage ${s.nom}`}
                        placeholder={needsRat ? 'Saisir' : '—'}
                        className="w-16 px-1.5 py-1.5 text-center font-mono text-xs border border-[#e3e7ef] rounded focus:outline-none focus:border-[#0b1f3f] disabled:bg-slate-50 disabled:text-slate-400 tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-[#161e2e] tabular-nums">
                      {calc.moyenneFinale !== null ? calc.moyenneFinale.toFixed(2) : '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                          calc.statut === 'Validé'
                            ? 'bg-emerald-50 text-emerald-700'
                            : calc.statut === 'Rattrapage'
                            ? 'bg-amber-50 text-amber-800'
                            : calc.statut === 'Non validé'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {calc.statut}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            const sem =
                              selectedUe?.semestre && selectedUe.semestre !== 'Tous'
                                ? selectedUe.semestre
                                : undefined;
                            const fileName = await downloadBulletinPdf(s, state, sem);
                            onNotify(`PDF téléchargé : ${fileName}`);
                          }}
                          title="Télécharger directement le relevé de notes en PDF"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold cursor-pointer whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTranscriptSemestre(selectedUe?.semestre ?? 'Tous');
                            setTranscriptStudent(s);
                          }}
                          title="Aperçu et impression du relevé de notes LMD"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-semibold text-[#0b1f3f] cursor-pointer whitespace-nowrap"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Relevé
                        </button>
                        {grade && selectedUe && (
                          <button
                            type="button"
                            onClick={() => onDeleteGrade(s.id, selectedUe.id)}
                            title="Effacer les notes de cette ligne"
                            aria-label={`Effacer notes ${s.nom}`}
                            className="p-1.5 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {classStudents.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-sm text-slate-500">
                    Aucun étudiant dans ce parcours pour le campus sélectionné.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Official Bulletin Modal */}
      {transcriptStudent && (
        <PrintModal
          title={`Relevé de notes — ${transcriptStudent.nom} ${transcriptStudent.prenom}`}
          subtitle={`${transcriptStudent.matricule} · ${transcriptStudent.filiereCode} ${transcriptStudent.niveau} · ${transcriptStudent.anneeAcademique}`}
          printLabel="Imprimer"
          pdfButtonLabel="Télécharger le relevé PDF"
          onDownloadPdf={async () => {
            const sem = transcriptSemestre === 'Tous' ? undefined : transcriptSemestre;
            const fileName = await downloadBulletinPdf(transcriptStudent, state, sem);
            onNotify(`Relevé PDF téléchargé : ${fileName}`);
          }}
          toolbarExtra={
            <select
              value={transcriptSemestre}
              onChange={(e) => setTranscriptSemestre(e.target.value)}
              aria-label="Période du relevé"
              className="px-2.5 py-1.5 text-xs font-semibold border border-[#e3e7ef] rounded-lg bg-white text-[#0b1f3f]"
            >
              <option value="Tous">Toutes périodes</option>
              {Array.from(
                new Set(
                  state.ues
                    .filter((u) => ueMatchesStudent(u, transcriptStudent))
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
          onClose={() => setTranscriptStudent(null)}
        >
          <BulletinReleve
            student={transcriptStudent}
            state={state}
            semestre={transcriptSemestre === 'Tous' ? undefined : transcriptSemestre}
          />
        </PrintModal>
      )}

      {/* Batch Printable Official Bulletins for Class */}
      {printBatch && classStudents.length > 0 && (
        <PrintModal
          title={`Relevés de notes — ${selectedUe?.filiereCode ?? ''} ${selectedUe?.niveau ?? ''}`}
          subtitle={`${classStudents.length} étudiant(s) · Année ${state.settings.anneeAcademique}`}
          printLabel="Imprimer tout"
          pdfButtonLabel={`Télécharger PDF (${classStudents.length})`}
          onDownloadPdf={async () => {
            const sem = transcriptSemestre === 'Tous' ? undefined : transcriptSemestre;
            const label = `${selectedUe?.filiereCode ?? 'Classe'}_${selectedUe?.niveau ?? ''}`;
            const fileName = await downloadBatchBulletinsPdf(
              classStudents,
              state,
              sem,
              label
            );
            onNotify(`Relevés PDF téléchargés : ${fileName}`);
          }}
          toolbarExtra={
            <select
              value={transcriptSemestre}
              onChange={(e) => setTranscriptSemestre(e.target.value)}
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
          onClose={() => setPrintBatch(false)}
        >
          <div className="space-y-8">
            {classStudents.map((st, idx) => (
              <div
                key={st.id}
                className={
                  idx < classStudents.length - 1
                    ? 'pb-8 border-b-2 border-dashed border-slate-300 print:border-none print:pb-0 print:break-after-page'
                    : ''
                }
              >
                <BulletinReleve
                  student={st}
                  state={state}
                  semestre={transcriptSemestre === 'Tous' ? undefined : transcriptSemestre}
                />
              </div>
            ))}
          </div>
        </PrintModal>
      )}

      {/* Printable Class Grade Sheet */}
      {printGrid && selectedUe && (
        <PrintModal
          title={`Grille de notes — ${selectedUe.code}`}
          subtitle={selectedUe.intitule}
          onClose={() => setPrintGrid(false)}
        >
          <div className="space-y-4 text-xs">
            <OfficialDocumentHeader
              campus={campusFilter === 'Tous' ? 'Pointe-Noire & Brazzaville' : campusFilter}
              docTitle="Fiche de Notes par Matière"
              docRef={selectedUe.code}
              academicYear={state.settings.anneeAcademique}
            />
            <p className="text-slate-700">
              ECUE : <strong>{selectedUe.code} — {selectedUe.intitule}</strong> ({selectedUe.filiereCode}{' '}
              {selectedUe.niveau} · {selectedUe.semestre})
            </p>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left border-collapse border border-[#e3e7ef]">
                <thead>
                  <tr className="bg-[#0b1f3f] text-white text-[11px] uppercase">
                    <th className="py-2 px-3">Matricule</th>
                    <th className="py-2 px-3">Étudiant</th>
                    <th className="py-2 px-2 text-right">Moy. Classe</th>
                    <th className="py-2 px-2 text-right">Examen</th>
                    <th className="py-2 px-2 text-right">Rattrapage</th>
                    <th className="py-2 px-2 text-right">Moy. Gén</th>
                    <th className="py-2 px-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e7ef]">
                  {classStudents.map((s) => {
                    const grade = state.grades.find(
                      (g) => g.studentId === s.id && g.ueId === selectedUe.id
                    );
                    const calc = computeUeAverage(grade, state.settings);
                    return (
                      <tr key={s.id}>
                        <td className="py-2 px-3 font-mono">{s.matricule}</td>
                        <td className="py-2 px-3 font-medium">
                          {s.nom} {s.prenom}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums">
                          {calc.moyClasse?.toFixed(2) ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums">
                          {grade?.examen?.toFixed(2) ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums">
                          {grade?.rattrapage?.toFixed(2) ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold tabular-nums">
                          {calc.moyenneFinale?.toFixed(2) ?? '—'}
                        </td>
                        <td className="py-2 px-3">{calc.statut}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </PrintModal>
      )}

      {importPreview && (
        <ImportGradesModal
          result={importPreview}
          onCancel={() => setImportPreview(null)}
          onConfirm={handleConfirmImport}
        />
      )}
    </div>
  );
}
