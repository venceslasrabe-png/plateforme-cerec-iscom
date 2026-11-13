import { AlertCircle, CalendarRange, CheckCircle2, Layers, X } from 'lucide-react';
import React, { useState } from 'react';
import { CerecState, Trimester, TrimesterStatus } from '../types/cerec';
import { createTrimesterBatchForYear, getAvailableAcademicYears } from '../utils/lmd';

interface CreateTrimesterModalProps {
  state: CerecState;
  editing?: Trimester | null;
  onClose: () => void;
  onSaveSingle: (trimester: Trimester, activate: boolean) => void;
  onGenerateBatch: (trimesters: Trimester[], year: string, activateFirst: boolean) => void;
}

export function CreateTrimesterModal({
  state,
  editing,
  onClose,
  onSaveSingle,
  onGenerateBatch,
}: CreateTrimesterModalProps) {
  const existingYears = getAvailableAcademicYears(state);
  const existingTrimesters = state.trimestres ?? [];

  const [creationMode, setCreationMode] = useState<'single' | 'batch'>('single');
  const [anneeAcademique, setAnneeAcademique] = useState(
    editing?.anneeAcademique || state.settings.anneeAcademique
  );

  // Suggest next T code for selected year
  const suggestCodeForYear = (year: string) => {
    const used = new Set(
      existingTrimesters
        .filter((t) => t.anneeAcademique === year)
        .map((t) => t.code.toUpperCase())
    );
    if (!used.has('T1')) return { code: 'T1', nom: '1er Trimestre' };
    if (!used.has('T2')) return { code: 'T2', nom: '2ème Trimestre' };
    if (!used.has('T3')) return { code: 'T3', nom: '3ème Trimestre' };
    const nextNum = used.size + 1;
    return { code: `T${nextNum}`, nom: `${nextNum}ème Trimestre` };
  };

  const initialSuggested = suggestCodeForYear(state.settings.anneeAcademique);
  const [code, setCode] = useState(editing?.code ?? initialSuggested.code);
  const [nom, setNom] = useState(editing?.nom ?? initialSuggested.nom);
  const [dateDebut, setDateDebut] = useState(editing?.dateDebut ?? '2025-10-06');
  const [dateFin, setDateFin] = useState(editing?.dateFin ?? '2025-12-19');
  const [statut, setStatut] = useState<TrimesterStatus>(editing?.statut ?? 'En cours');
  const [semestreAssocie, setSemestreAssocie] = useState(editing?.semestreAssocie ?? 'S1');
  const [activate, setActivate] = useState(
    editing ? state.settings.trimestreActifId === editing.id : true
  );
  const [error, setError] = useState<string | null>(null);

  const batchPreview = createTrimesterBatchForYear(anneeAcademique, existingTrimesters);

  const handleYearChange = (nextYear: string) => {
    setAnneeAcademique(nextYear);
    setError(null);
    if (!editing) {
      const sug = suggestCodeForYear(nextYear);
      setCode(sug.code);
      setNom(sug.nom);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (creationMode === 'batch' && !editing) {
      if (batchPreview.length === 0) {
        setError(
          `Les 3 trimestres (T1, T2, T3) existent déjà pour l’année ${anneeAcademique}.`
        );
        return;
      }
      const prepared = batchPreview.map((t, idx) =>
        idx === 0 && activate ? { ...t, statut: 'En cours' as TrimesterStatus } : t
      );
      onGenerateBatch(prepared, anneeAcademique, activate);
      return;
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanNom = nom.trim();
    if (!cleanCode) {
      setError('Veuillez saisir un code de trimestre (ex. T1, T2, T3).');
      return;
    }
    if (!cleanNom) {
      setError('Veuillez saisir un intitulé (ex. 1er Trimestre).');
      return;
    }
    if (dateDebut && dateFin && dateDebut > dateFin) {
      setError('La date de début doit être antérieure à la date de fin.');
      return;
    }

    const duplicate = existingTrimesters.find(
      (t) =>
        t.anneeAcademique === anneeAcademique &&
        t.code.trim().toUpperCase() === cleanCode &&
        t.id !== editing?.id
    );
    if (duplicate) {
      setError(
        `Le trimestre ${cleanCode} existe déjà pour l’année ${anneeAcademique}.`
      );
      return;
    }

    const payload: Trimester = {
      id: editing ? editing.id : `tri-${Date.now()}`,
      code: cleanCode,
      nom: cleanNom,
      anneeAcademique,
      dateDebut,
      dateFin,
      statut,
      semestreAssocie: semestreAssocie || undefined,
    };
    onSaveSingle(payload, activate);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142b]/70 p-3 sm:p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#e3e7ef] rounded-xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto my-auto"
      >
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#e3e7ef]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#0b1f3f] text-[#eab33a] flex items-center justify-center shrink-0">
              <CalendarRange className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[#161e2e] truncate">
                {editing ? `Modifier ${editing.code} — ${editing.nom}` : 'Créer un trimestre'}
              </h3>
              <p className="text-xs text-slate-500">
                Découpage trimestriel CEREC-ISCOM (T1, T2, T3) & calendrier d’évaluations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre de trimestre"
            className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!editing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 bg-[#f8f9fb] border border-[#e3e7ef] rounded-lg">
            <button
              type="button"
              onClick={() => {
                setCreationMode('single');
                setError(null);
              }}
              className={`px-3 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                creationMode === 'single'
                  ? 'bg-[#0b1f3f] text-white'
                  : 'text-slate-600 hover:text-[#161e2e]'
              }`}
            >
              Créer un trimestre
            </button>
            <button
              type="button"
              onClick={() => {
                setCreationMode('batch');
                setError(null);
              }}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                creationMode === 'batch'
                  ? 'bg-[#0b1f3f] text-white'
                  : 'text-slate-600 hover:text-[#161e2e]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Générer T1, T2 & T3
            </button>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Année académique *
          </label>
          <select
            value={anneeAcademique}
            onChange={(e) => handleYearChange(e.target.value)}
            className="w-full px-3 py-2 text-sm font-mono font-semibold border border-[#e3e7ef] rounded-lg bg-white text-[#0b1f3f]"
          >
            {existingYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {creationMode === 'single' || editing ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError(null);
                  }}
                  placeholder="T1"
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-[#e3e7ef] rounded-lg uppercase"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Intitulé du trimestre *
                </label>
                <input
                  type="text"
                  required
                  value={nom}
                  onChange={(e) => {
                    setNom(e.target.value);
                    setError(null);
                  }}
                  placeholder="1er Trimestre"
                  className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date de début *
                </label>
                <input
                  type="date"
                  required
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date de fin *
                </label>
                <input
                  type="date"
                  required
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Statut de la période
                </label>
                <select
                  value={statut}
                  onChange={(e) => setStatut(e.target.value as TrimesterStatus)}
                  className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                >
                  <option value="Planifié">Planifié</option>
                  <option value="En cours">En cours</option>
                  <option value="Clôturé">Clôturé</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Semestre LMD rattaché
                </label>
                <select
                  value={semestreAssocie}
                  onChange={(e) => setSemestreAssocie(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                >
                  {['S1', 'S2', 'S3', 'S4', 'S5', 'S6'].map((s) => (
                    <option key={s} value={s}>
                      Semestre {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg bg-[#f8f9fb] border border-[#e3e7ef] p-4 space-y-2.5 text-xs">
            <p className="font-semibold text-[#0b1f3f]">
              Trimestres à générer pour {anneeAcademique} ({batchPreview.length}) :
            </p>
            {batchPreview.length > 0 ? (
              <div className="space-y-2">
                {batchPreview.map((t) => (
                  <div
                    key={t.code}
                    className="bg-white border border-[#e3e7ef] rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="font-bold text-[#0b1f3f]">
                      <span className="font-mono mr-1.5">{t.code}</span> — {t.nom}
                    </span>
                    <span className="font-mono text-slate-600 tabular-nums">
                      {t.dateDebut} → {t.dateFin}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Les trimestres T1, T2 et T3 sont déjà créés pour {anneeAcademique}.
              </p>
            )}
          </div>
        )}

        <label className="flex items-center gap-2 text-xs font-semibold text-[#0b1f3f] cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={activate}
            onChange={(e) => setActivate(e.target.checked)}
            className="accent-[#0b1f3f]"
          />
          <span>
            {creationMode === 'batch' && !editing
              ? 'Définir le 1er trimestre généré comme trimestre actif'
              : 'Définir ce trimestre comme période active'}
          </span>
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2.5 pt-3 border-t border-[#e3e7ef]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#e3e7ef] text-xs font-semibold text-slate-700 cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={creationMode === 'batch' && !editing && batchPreview.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] disabled:opacity-50 text-[#07142b] text-xs font-bold cursor-pointer"
          >
            <CalendarRange className="w-4 h-4" />
            {editing
              ? 'Enregistrer'
              : creationMode === 'batch'
              ? `Générer (${batchPreview.length})`
              : 'Créer le trimestre'}
          </button>
        </div>
      </form>
    </div>
  );
}
