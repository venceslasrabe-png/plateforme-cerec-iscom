import { Clock, Edit3, Plus, Printer, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import { Campus, CerecState, Lecturer } from '../../types/cerec';
import { formatFCFA } from '../../utils/lmd';
import { OfficialDocumentHeader, PrintModal } from '../PrintModal';

interface FacultyViewProps {
  state: CerecState;
  campusFilter: Campus | 'Tous';
  onAddLecturer: (lecturer: Lecturer) => void;
  onUpdateLecturer: (lecturer: Lecturer) => void;
  onDeleteLecturer: (id: string) => void;
}

export function FacultyView({
  state,
  campusFilter,
  onAddLecturer,
  onUpdateLecturer,
  onDeleteLecturer,
}: FacultyViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lecturer | null>(null);
  const [printPayroll, setPrintPayroll] = useState(false);
  const [form, setForm] = useState<Partial<Lecturer>>({
    campus: campusFilter === 'Tous' ? 'Pointe-Noire' : campusFilter,
    tauxHoraire: 12000,
    heuresEffectuees: 0,
  });

  const lecturers = state.lecturers.filter(
    (l) => campusFilter === 'Tous' || l.campus === campusFilter
  );

  const totalPayroll = lecturers.reduce(
    (sum, l) => sum + l.tauxHoraire * l.heuresEffectuees,
    0
  );

  const openCreate = () => {
    setEditing(null);
    setForm({
      nom: '',
      grade: 'Chargé de cours',
      specialite: '',
      campus: campusFilter === 'Tous' ? 'Pointe-Noire' : campusFilter,
      telephone: '+242 06 ',
      email: '',
      tauxHoraire: 12000,
      heuresEffectuees: 0,
    });
    setModalOpen(true);
  };

  const openEdit = (l: Lecturer) => {
    setEditing(l);
    setForm({ ...l });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom?.trim()) return;
    const payload: Lecturer = {
      id: editing ? editing.id : `ens-${Date.now()}`,
      nom: form.nom.trim(),
      grade: form.grade?.trim() || 'Chargé de cours',
      specialite: form.specialite?.trim() || 'Gestion',
      campus: (form.campus as Campus) || 'Pointe-Noire',
      telephone: form.telephone?.trim() || '+242 06 ',
      email: form.email?.trim() || 'enseignant@cerec-iscom.cg',
      tauxHoraire: Number(form.tauxHoraire) || 12000,
      heuresEffectuees: Number(form.heuresEffectuees) || 0,
    };
    if (editing) {
      onUpdateLecturer(payload);
    } else {
      onAddLecturer(payload);
    }
    setModalOpen(false);
  };

  const handleAddHours = (l: Lecturer, delta: number) => {
    onUpdateLecturer({
      ...l,
      heuresEffectuees: Math.max(0, l.heuresEffectuees + delta),
    });
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#e3e7ef] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#161e2e]">
            Corps Professoral & Vacations ({lecturers.length} enseignants)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
            Masse horaire engagée : {formatFCFA(totalPayroll)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setPrintPayroll(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-semibold text-[#0b1f3f] cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            État des vacations
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#eab33a]" />
            Ajouter un enseignant
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#e3e7ef] rounded-lg overflow-hidden">
        <div className="md:hidden divide-y divide-[#e3e7ef]">
          {lecturers.map((l) => {
            const assignedUes = state.ues.filter((u) => u.enseignantId === l.id);
            return (
              <div key={l.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[#161e2e] truncate">{l.nom}</p>
                    <p className="text-xs text-slate-500">{l.grade}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {l.specialite} · {l.campus}
                    </p>
                  </div>
                  <p className="font-mono text-xs font-bold text-[#0b1f3f] tabular-nums shrink-0">
                    {formatFCFA(l.heuresEffectuees * l.tauxHoraire)}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  UE :{' '}
                  {assignedUes.length > 0
                    ? assignedUes.map((u) => u.code).join(' · ')
                    : 'Aucune UE'}
                </p>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="font-mono text-xs text-slate-600 tabular-nums">
                    {l.heuresEffectuees}h × {formatFCFA(l.tauxHoraire)}
                  </span>
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleAddHours(l, 2)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#e3e7ef] text-xs font-mono font-semibold text-[#0b1f3f] cursor-pointer"
                    >
                      <Clock className="w-3 h-3" />
                      +2h
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(l)}
                      aria-label={`Modifier ${l.nom}`}
                      className="p-1.5 rounded text-slate-500 hover:text-[#0b1f3f] hover:bg-slate-100 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteLecturer(l.id)}
                      aria-label={`Supprimer ${l.nom}`}
                      className="p-1.5 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#f8f9fb] border-b border-[#e3e7ef] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Enseignant & Grade</th>
                <th className="py-3 px-4">Spécialité & Campus</th>
                <th className="py-3 px-4">UE affectées</th>
                <th className="py-3 px-4 text-right">Heures eff.</th>
                <th className="py-3 px-4 text-right">Taux horaire</th>
                <th className="py-3 px-4 text-right">Décompte FCFA</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e7ef]">
              {lecturers.map((l) => {
                const assignedUes = state.ues.filter((u) => u.enseignantId === l.id);
                return (
                  <tr key={l.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#161e2e]">{l.nom}</p>
                      <p className="text-xs text-slate-500">{l.grade}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-xs font-medium text-[#161e2e]">{l.specialite}</p>
                      <p className="text-xs text-slate-500">
                        {l.campus} · {l.telephone}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {assignedUes.length > 0
                        ? assignedUes.map((u) => u.code).join(' · ')
                        : 'Aucune UE'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {l.heuresEffectuees}h
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                      {formatFCFA(l.tauxHoraire)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#0b1f3f] tabular-nums">
                      {formatFCFA(l.heuresEffectuees * l.tauxHoraire)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAddHours(l, 2)}
                          title="Pointer +2h de cours"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-mono font-semibold text-[#0b1f3f] cursor-pointer"
                        >
                          <Clock className="w-3 h-3" />
                          +2h
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(l)}
                          aria-label={`Modifier ${l.nom}`}
                          className="p-1.5 rounded text-slate-500 hover:text-[#0b1f3f] hover:bg-slate-100 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteLecturer(l.id)}
                          aria-label={`Supprimer ${l.nom}`}
                          className="p-1.5 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Lecturer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142b]/70 p-3 sm:p-4">
          <div className="bg-white border border-[#e3e7ef] rounded-xl w-full max-w-lg shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#e3e7ef] bg-[#f8f9fb] shrink-0">
              <h3 className="text-base font-semibold text-[#161e2e]">
                {editing ? 'Modifier la fiche enseignant' : 'Nouveau membre du corps professoral'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Nom complet *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Dr. Alain Moukala"
                    value={form.nom || ''}
                    onChange={(e) => setForm({ ...form, nom: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Grade</label>
                  <input
                    type="text"
                    placeholder="Maître-Assistant / Expert"
                    value={form.grade || ''}
                    onChange={(e) => setForm({ ...form, grade: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Spécialité</label>
                  <input
                    type="text"
                    placeholder="Audit & Contrôle de gestion"
                    value={form.specialite || ''}
                    onChange={(e) => setForm({ ...form, specialite: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Campus</label>
                  <select
                    value={form.campus}
                    onChange={(e) => setForm({ ...form, campus: e.target.value as Campus })}
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                  >
                    <option value="Pointe-Noire">Pointe-Noire</option>
                    <option value="Brazzaville">Brazzaville</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={form.telephone || ''}
                    onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Taux horaire (FCFA)
                  </label>
                  <input
                    type="number"
                    min={5000}
                    step={500}
                    value={form.tauxHoraire ?? 12000}
                    onChange={(e) => setForm({ ...form, tauxHoraire: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Heures réalisées
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.heuresEffectuees ?? 0}
                    onChange={(e) =>
                      setForm({ ...form, heuresEffectuees: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-[#e3e7ef]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#e3e7ef] text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0b1f3f] text-white text-xs font-semibold cursor-pointer"
                >
                  {editing ? 'Mettre à jour' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Payroll Sheet */}
      {printPayroll && (
        <PrintModal
          title="État des Vacations & Volumes Horaires"
          subtitle={`Campus : ${campusFilter === 'Tous' ? 'Pointe-Noire & Brazzaville' : campusFilter}`}
          onClose={() => setPrintPayroll(false)}
        >
          <div className="space-y-4 text-xs">
            <OfficialDocumentHeader
              campus={campusFilter === 'Tous' ? 'Pointe-Noire & Brazzaville' : campusFilter}
              docTitle="État des Vacations Enseignants"
              docRef={`VAC-${new Date().toISOString().slice(0, 10)}`}
            />
            <table className="w-full text-left border-collapse border border-[#e3e7ef]">
              <thead>
                <tr className="bg-[#0b1f3f] text-white text-[11px] uppercase">
                  <th className="py-2 px-3">Enseignant</th>
                  <th className="py-2 px-3">Campus</th>
                  <th className="py-2 px-3 text-right">Heures</th>
                  <th className="py-2 px-3 text-right">Taux horaire</th>
                  <th className="py-2 px-3 text-right">Net à payer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e7ef]">
                {lecturers.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 px-3 font-medium">
                      {l.nom} ({l.grade})
                    </td>
                    <td className="py-2 px-3">{l.campus}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      {l.heuresEffectuees}h
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      {formatFCFA(l.tauxHoraire)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold tabular-nums">
                      {formatFCFA(l.heuresEffectuees * l.tauxHoraire)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#f8f9fb] font-bold">
                  <td colSpan={4} className="py-2 px-3 text-right">
                    Total masse vacation :
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-[#0b1f3f] tabular-nums">
                    {formatFCFA(totalPayroll)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </PrintModal>
      )}
    </div>
  );
}
