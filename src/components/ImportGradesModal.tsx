import { CheckCircle2, Upload, X } from 'lucide-react';
import { GradeImportResult } from '../utils/lmd';

interface ImportGradesModalProps {
  result: GradeImportResult;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ImportGradesModal({
  result,
  onCancel,
  onConfirm,
}: ImportGradesModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142b]/70 p-4">
      <div className="bg-white border border-[#e3e7ef] rounded-xl max-w-3xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#161e2e]">
              Confirmer l’importation du relevé de notes
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5 break-all">
              {result.fileName}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer l'aperçu d'importation des notes"
            className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="bg-[#f8f9fb] border border-[#e3e7ef] rounded-lg px-3 py-2">
            <p className="text-slate-500">Nouvelles notes</p>
            <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
              +{result.createdCount}
            </p>
          </div>
          <div className="bg-[#f8f9fb] border border-[#e3e7ef] rounded-lg px-3 py-2">
            <p className="text-slate-500">Notes mises à jour</p>
            <p className="font-mono font-bold text-[#0b1f3f] text-sm mt-0.5">
              {result.updatedCount}
            </p>
          </div>
          <div className="bg-[#f8f9fb] border border-[#e3e7ef] rounded-lg px-3 py-2">
            <p className="text-slate-500">Étudiants concernés</p>
            <p className="font-mono font-bold text-[#0b1f3f] text-sm mt-0.5">
              {result.matchedStudents}
            </p>
          </div>
          <div className="bg-[#f8f9fb] border border-[#e3e7ef] rounded-lg px-3 py-2">
            <p className="text-slate-500">UE détectées</p>
            <p className="font-mono font-bold text-[#0b1f3f] text-sm mt-0.5 truncate">
              {result.matchedUes.join(', ')}
            </p>
          </div>
        </div>

        {result.skippedCount > 0 && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {result.skippedCount} ligne(s) ignorée(s) (matricule ou code UE introuvable dans le référentiel actif).
          </p>
        )}

        <div className="flex-1 min-h-0 overflow-auto border border-[#e3e7ef] rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-[#f8f9fb] border-b border-[#e3e7ef] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2.5 px-3">Matricule</th>
                <th className="py-2.5 px-3">Étudiant</th>
                <th className="py-2.5 px-3">UE</th>
                <th className="py-2.5 px-2 text-center">Classe</th>
                <th className="py-2.5 px-2 text-center">TD</th>
                <th className="py-2.5 px-2 text-center">TP</th>
                <th className="py-2.5 px-2 text-center">Examen</th>
                <th className="py-2.5 px-2 text-center">Rattrap.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e7ef]">
              {result.previewRows.slice(0, 60).map((row) => (
                <tr key={`${row.matricule}-${row.ueCode}`} className="hover:bg-slate-50/70">
                  <td className="py-2 px-3 font-mono font-semibold text-[#0b1f3f] whitespace-nowrap">
                    {row.matricule}
                  </td>
                  <td className="py-2 px-3 font-medium text-[#161e2e] whitespace-nowrap">
                    {row.studentName}
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">
                    {row.ueCode}
                  </td>
                  <td className="py-2 px-2 text-center font-mono tabular-nums">
                    {row.cc !== null ? row.cc.toFixed(2) : '—'}
                  </td>
                  <td className="py-2 px-2 text-center font-mono tabular-nums">
                    {row.td !== null ? row.td.toFixed(2) : '—'}
                  </td>
                  <td className="py-2 px-2 text-center font-mono tabular-nums">
                    {row.tp !== null ? row.tp.toFixed(2) : '—'}
                  </td>
                  <td className="py-2 px-2 text-center font-mono tabular-nums">
                    {row.examen !== null ? row.examen.toFixed(2) : '—'}
                  </td>
                  <td className="py-2 px-2 text-center font-mono tabular-nums">
                    {row.rattrapage !== null ? row.rattrapage.toFixed(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.previewRows.length > 60 && (
            <p className="text-[11px] text-slate-500 px-3 py-2 bg-[#f8f9fb] border-t border-[#e3e7ef]">
              Affichage des 60 premières lignes sur {result.previewRows.length}.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#e3e7ef]">
          <p className="text-xs text-slate-500 inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            Les moyennes LMD, crédits et rangs seront recalculés automatiquement.
          </p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-[#e3e7ef] text-xs font-semibold text-slate-700 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#eab33a]" />
              Importer {result.records.length} relevé(s)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
