import { AlertCircle, CalendarPlus, CheckCircle2, Users, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { CerecState } from '../types/cerec';
import {
  CreateAcademicYearMode,
  CreateAcademicYearResult,
  createNewAcademicYear,
  getAvailableAcademicYears,
  isValidAcademicYear,
  suggestNextAcademicYear,
} from '../utils/lmd';

interface CreateAcademicYearModalProps {
  state: CerecState;
  onClose: () => void;
  onCreated: (result: CreateAcademicYearResult) => void;
}

export function CreateAcademicYearModal({
  state,
  onClose,
  onCreated,
}: CreateAcademicYearModalProps) {
  const existingYears = getAvailableAcademicYears(state);
  const [newYear, setNewYear] = useState(() =>
    suggestNextAcademicYear(state.settings.anneeAcademique, existingYears)
  );
  const [sourceYear, setSourceYear] = useState(state.settings.anneeAcademique);
  const [mode, setMode] = useState<CreateAcademicYearMode>('promote_admitted');
  const [includeRepeating, setIncludeRepeating] = useState(true);
  const [includeL3ToM1, setIncludeL3ToM1] = useState(false);
  const [setAsActive, setSetAsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const alreadyExists = existingYears.includes(newYear.trim());
  const validFormat = isValidAcademicYear(newYear);

  const preview = useMemo(() => {
    if (!validFormat) return null;
    try {
      return createNewAcademicYear(state, {
        newYear: newYear.trim(),
        sourceYear,
        mode,
        includeRepeating,
        includeL3ToM1,
        setAsActive,
      });
    } catch {
      return null;
    }
  }, [state, newYear, sourceYear, mode, includeRepeating, includeL3ToM1, setAsActive, validFormat]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = createNewAcademicYear(state, {
        newYear: newYear.trim(),
        sourceYear,
        mode,
        includeRepeating,
        includeL3ToM1,
        setAsActive,
      });
      onCreated(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de créer la nouvelle année académique."
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142b]/70 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#e3e7ef] rounded-xl max-w-xl w-full p-6 space-y-5 shadow-xl max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#e3e7ef]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#0b1f3f] text-[#eab33a] flex items-center justify-center shrink-0">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#161e2e]">
                Créer une nouvelle année académique
              </h3>
              <p className="text-xs text-slate-500">
                Ouverture d’exercice CEREC-ISCOM & reconduction LMD optionnelle
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre de création d'année académique"
            className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Libellé de la nouvelle année *
            </label>
            <input
              type="text"
              required
              value={newYear}
              onChange={(e) => {
                setNewYear(e.target.value);
                setError(null);
              }}
              placeholder="ex. 2026-2027"
              className="w-full px-3 py-2 text-sm font-mono font-bold border border-[#e3e7ef] rounded-lg focus:outline-none focus:border-[#0b1f3f]"
            />
            {!validFormat && newYear.trim() !== '' && (
              <p className="text-[11px] text-red-600 mt-1">
                Format attendu : AAAA-AAAA consécutif (ex. 2026-2027).
              </p>
            )}
            {alreadyExists && validFormat && (
              <p className="text-[11px] text-amber-700 mt-1">
                Cet exercice existe déjà : seuls les étudiants non inscrits sur {newYear.trim()} seront ajoutés.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Année source pour reconduction
            </label>
            <select
              value={sourceYear}
              onChange={(e) => setSourceYear(e.target.value)}
              disabled={mode === 'empty'}
              className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-400"
            >
              {existingYears.map((y) => (
                <option key={y} value={y}>
                  {y} ({state.students.filter((s) => s.anneeAcademique === y).length} étudiants)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Rollover Mode */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700">
            Initialisation des effectifs étudiants
          </label>
          <div className="space-y-2">
            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-[#e3e7ef] hover:border-[#0b1f3f] cursor-pointer">
              <input
                type="radio"
                name="rolloverMode"
                checked={mode === 'promote_admitted'}
                onChange={() => setMode('promote_admitted')}
                className="mt-0.5 accent-[#0b1f3f]"
              />
              <div className="text-xs">
                <p className="font-semibold text-[#161e2e]">
                  Passage LMD automatique depuis {sourceYear}
                </p>
                <p className="text-slate-500 mt-0.5">
                  Promeut les étudiants admis au niveau supérieur (L1 → L2, L2 → L3, M1 → M2) tout en
                  conservant intactes les archives de {sourceYear}.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-[#e3e7ef] hover:border-[#0b1f3f] cursor-pointer">
              <input
                type="radio"
                name="rolloverMode"
                checked={mode === 'copy_all'}
                onChange={() => setMode('copy_all')}
                className="mt-0.5 accent-[#0b1f3f]"
              />
              <div className="text-xs">
                <p className="font-semibold text-[#161e2e]">
                  Reconduire les inscrits à niveau identique
                </p>
                <p className="text-slate-500 mt-0.5">
                  Copie les dossiers de {sourceYear} en attente de réinscription sans modifier leur niveau actuel.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-[#e3e7ef] hover:border-[#0b1f3f] cursor-pointer">
              <input
                type="radio"
                name="rolloverMode"
                checked={mode === 'empty'}
                onChange={() => setMode('empty')}
                className="mt-0.5 accent-[#0b1f3f]"
              />
              <div className="text-xs">
                <p className="font-semibold text-[#161e2e]">
                  Ouvrir une année académique vierge (0 reconduction)
                </p>
                <p className="text-slate-500 mt-0.5">
                  Crée uniquement le nouvel exercice ; les inscriptions et imports se feront manuellement.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Sub-options */}
        <div className="space-y-2 pt-1">
          {mode === 'promote_admitted' && (
            <>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeRepeating}
                  onChange={(e) => setIncludeRepeating(e.target.checked)}
                  className="accent-[#0b1f3f]"
                />
                <span>
                  Réinscrire en redoublement les étudiants ajournés ou en cours d’évaluation
                </span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeL3ToM1}
                  onChange={(e) => setIncludeL3ToM1(e.target.checked)}
                  className="accent-[#0b1f3f]"
                />
                <span>
                  Inscrire automatiquement les admis de Licence 3 (L3) en Master 1 (M1)
                </span>
              </label>
            </>
          )}

          <label className="flex items-center gap-2 text-xs font-semibold text-[#0b1f3f] cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={setAsActive}
              onChange={(e) => setSetAsActive(e.target.checked)}
              className="accent-[#0b1f3f]"
            />
            <span>Activer immédiatement {newYear.trim() || 'cette année'} comme année en cours</span>
          </label>
        </div>

        {/* Live Preview Summary */}
        {preview && (
          <div className="rounded-lg bg-[#f8f9fb] border border-[#e3e7ef] p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#0b1f3f] inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#c58b12]" />
                Prévision d’ouverture ({preview.year})
              </span>
              <span className="font-mono font-bold text-[#0b1f3f]">
                {preview.totalCreated} dossier(s) généré(s)
              </span>
            </div>
            {mode !== 'empty' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[#e3e7ef]">
                <div className="bg-white px-3 py-2 rounded border border-[#e3e7ef] flex items-center justify-between">
                  <span className="text-slate-600">Promus LMD</span>
                  <span className="font-mono font-bold text-emerald-700">
                    +{preview.promotedCount}
                  </span>
                </div>
                <div className="bg-white px-3 py-2 rounded border border-[#e3e7ef] flex items-center justify-between">
                  <span className="text-slate-600">Reconduits</span>
                  <span className="font-mono font-bold text-[#0b1f3f]">
                    +{preview.repeatedCount}
                  </span>
                </div>
                <div className="bg-white px-3 py-2 rounded border border-[#e3e7ef] flex items-center justify-between">
                  <span className="text-slate-600">Sortants/Dipl.</span>
                  <span className="font-mono font-bold text-slate-600">
                    {preview.graduatedSkipped}
                  </span>
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Les notes, reçus FCFA et dossiers de {sourceYear} demeurent conservés dans les archives.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-[#e3e7ef]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#e3e7ef] text-xs font-semibold text-slate-700 cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!validFormat}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] disabled:opacity-50 text-[#07142b] text-xs font-bold cursor-pointer"
          >
            <CalendarPlus className="w-4 h-4" />
            Créer l’année {newYear.trim() || ''}
          </button>
        </div>
      </form>
    </div>
  );
}
