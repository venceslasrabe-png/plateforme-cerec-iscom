import { Calendar, Edit3, Layers, Plus, Printer, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import {
  Campus,
  CerecState,
  Cycle,
  Filiere,
  Niveau,
  ScheduleSlot,
  UE,
} from '../../types/cerec';
import { formatFCFA } from '../../utils/lmd';
import { OfficialDocumentHeader, PrintModal } from '../PrintModal';

interface AcademicViewProps {
  state: CerecState;
  campusFilter: Campus | 'Tous';
  onAddFiliere: (filiere: Filiere) => void;
  onUpdateFiliere: (filiere: Filiere) => void;
  onDeleteFiliere: (id: string) => void;
  onAddUe: (ue: UE) => void;
  onUpdateUe: (ue: UE) => void;
  onDeleteUe: (id: string) => void;
  onAddSchedule: (slot: ScheduleSlot) => void;
  onUpdateSchedule: (slot: ScheduleSlot) => void;
  onDeleteSchedule: (id: string) => void;
}

const JOURS: ScheduleSlot['jour'][] = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];

export function AcademicView({
  state,
  campusFilter,
  onAddFiliere,
  onUpdateFiliere,
  onDeleteFiliere,
  onAddUe,
  onUpdateUe,
  onDeleteUe,
  onAddSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
}: AcademicViewProps) {
  const [subTab, setSubTab] = useState<'maquette' | 'planning'>('maquette');
  const [selectedFiliere, setSelectedFiliere] = useState('Toutes');
  const [selectedOption, setSelectedOption] = useState('Toutes');
  const [printPlanning, setPrintPlanning] = useState(false);

  // Modals
  const [filiereModal, setFiliereModal] = useState(false);
  const [editingFiliere, setEditingFiliere] = useState<Filiere | null>(null);
  const [newOptionInput, setNewOptionInput] = useState('');
  const [filiereForm, setFiliereForm] = useState<Partial<Filiere>>({
    cycle: 'Licence',
    options: [],
    fraisInscription: 75000,
    scolariteAnnuelle: 480000,
  });

  const [ueModal, setUeModal] = useState(false);
  const [editingUe, setEditingUe] = useState<UE | null>(null);
  const [ueForm, setUeForm] = useState<Partial<UE>>({
    filiereCode: state.filieres[0]?.code ?? 'GCF',
    option: 'Tronc commun',
    niveau: 'L1',
    semestre: 'S1',
    credits: 5,
    coefficient: 2,
    volumeHoraire: 36,
    enseignantId: state.lecturers[0]?.id ?? 'ens-1',
  });

  const [slotModal, setSlotModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null);
  const [slotForm, setSlotForm] = useState<Partial<ScheduleSlot>>({
    campus: campusFilter === 'Tous' ? 'Pointe-Noire' : campusFilter,
    filiereCode: 'GCF',
    option: 'Tronc commun',
    niveau: 'L1',
    jour: 'Lundi',
    heureDebut: '08:00',
    heureFin: '10:30',
    ueId: state.ues[0]?.id ?? '',
    salle: 'Amphi A1',
  });

  const availableOptions =
    selectedFiliere === 'Toutes'
      ? Array.from(new Set(state.filieres.flatMap((f) => f.options ?? [])))
      : state.filieres.find((f) => f.code === selectedFiliere)?.options ?? [];

  const filteredUes = state.ues.filter((u) => {
    if (selectedFiliere !== 'Toutes' && u.filiereCode !== selectedFiliere) return false;
    if (selectedOption !== 'Toutes' && (u.option || 'Tronc commun') !== selectedOption) {
      return false;
    }
    return true;
  });

  const filteredSchedule = state.schedule.filter((s) => {
    if (campusFilter !== 'Tous' && s.campus !== campusFilter) return false;
    if (selectedFiliere !== 'Toutes' && s.filiereCode !== selectedFiliere) return false;
    if (selectedOption !== 'Toutes') {
      const ue = state.ues.find((u) => u.id === s.ueId);
      const slotOpt = s.option || ue?.option || 'Tronc commun';
      if (slotOpt !== selectedOption) return false;
    }
    return true;
  });

  // Filiere handlers
  const openCreateFiliere = () => {
    setEditingFiliere(null);
    setNewOptionInput('');
    setFiliereForm({
      code: '',
      nom: '',
      cycle: 'Licence',
      departement: 'Sciences de Gestion & Management',
      options: ['Option générale'],
      fraisInscription: 75000,
      scolariteAnnuelle: 480000,
    });
    setFiliereModal(true);
  };

  const openEditFiliere = (f: Filiere) => {
    setEditingFiliere(f);
    setNewOptionInput('');
    setFiliereForm({ ...f, options: [...(f.options ?? [])] });
    setFiliereModal(true);
  };

  const addOptionToFiliereForm = () => {
    const clean = newOptionInput.trim();
    if (!clean) return;
    const current = filiereForm.options ?? [];
    if (!current.includes(clean)) {
      setFiliereForm({ ...filiereForm, options: [...current, clean] });
    }
    setNewOptionInput('');
  };

  const removeOptionFromFiliereForm = (opt: string) => {
    const current = filiereForm.options ?? [];
    setFiliereForm({
      ...filiereForm,
      options: current.filter((o) => o !== opt),
    });
  };

  const handleSaveFiliere = (e: React.FormEvent) => {
    e.preventDefault();
    if (!filiereForm.code?.trim() || !filiereForm.nom?.trim()) return;
    const cleanedOptions = (filiereForm.options ?? []).map((o) => o.trim()).filter(Boolean);
    const pendingOpt = newOptionInput.trim();
    if (pendingOpt && !cleanedOptions.includes(pendingOpt)) {
      cleanedOptions.push(pendingOpt);
    }
    const payload: Filiere = {
      id: editingFiliere ? editingFiliere.id : `f-${Date.now()}`,
      code: filiereForm.code.trim().toUpperCase(),
      nom: filiereForm.nom.trim(),
      cycle: (filiereForm.cycle as Cycle) || 'Licence',
      departement: filiereForm.departement?.trim() || 'Sciences de Gestion',
      options: cleanedOptions.length > 0 ? cleanedOptions : [filiereForm.nom.trim()],
      fraisInscription: Number(filiereForm.fraisInscription) || 75000,
      scolariteAnnuelle: Number(filiereForm.scolariteAnnuelle) || 450000,
    };
    if (editingFiliere) {
      onUpdateFiliere(payload);
    } else {
      onAddFiliere(payload);
    }
    setFiliereModal(false);
  };

  // UE handlers
  const openCreateUe = () => {
    setEditingUe(null);
    const defaultFiliere =
      selectedFiliere === 'Toutes' ? state.filieres[0]?.code ?? 'GCF' : selectedFiliere;
    const filObj = state.filieres.find((f) => f.code === defaultFiliere);
    const defaultOption =
      selectedOption !== 'Toutes'
        ? selectedOption
        : filObj?.options?.[0] ?? 'Tronc commun';
    setUeForm({
      code: '',
      intitule: '',
      uniteParent: '',
      filiereCode: defaultFiliere,
      option: defaultOption,
      niveau: 'L1',
      semestre: 'S1',
      credits: 5,
      coefficient: 2,
      volumeHoraire: 36,
      enseignantId: state.lecturers[0]?.id ?? '',
    });
    setUeModal(true);
  };

  const openEditUe = (u: UE) => {
    setEditingUe(u);
    setUeForm({ ...u, option: u.option || 'Tronc commun' });
    setUeModal(true);
  };

  const handleSaveUe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ueForm.code?.trim() || !ueForm.intitule?.trim()) return;
    const payload: UE = {
      id: editingUe ? editingUe.id : `ue-${Date.now()}`,
      code: ueForm.code.trim().toUpperCase(),
      intitule: ueForm.intitule.trim(),
      uniteParent: ueForm.uniteParent?.trim() || undefined,
      filiereCode: ueForm.filiereCode || 'GCF',
      option: ueForm.option?.trim() || 'Tronc commun',
      niveau: (ueForm.niveau as Niveau) || 'L1',
      semestre: ueForm.semestre || 'S1',
      credits: Number(ueForm.credits) || 4,
      coefficient: Number(ueForm.coefficient) || 2,
      volumeHoraire: Number(ueForm.volumeHoraire) || 30,
      enseignantId: ueForm.enseignantId || state.lecturers[0]?.id || '',
    };
    if (editingUe) {
      onUpdateUe(payload);
    } else {
      onAddUe(payload);
    }
    setUeModal(false);
  };

  // Schedule handlers
  const openCreateSlot = () => {
    setEditingSlot(null);
    const defaultUe = filteredUes[0] ?? state.ues[0];
    setSlotForm({
      campus: campusFilter === 'Tous' ? 'Pointe-Noire' : campusFilter,
      filiereCode: defaultUe?.filiereCode ?? 'GCF',
      option: defaultUe?.option ?? 'Tronc commun',
      niveau: defaultUe?.niveau ?? 'L1',
      jour: 'Lundi',
      heureDebut: '08:00',
      heureFin: '10:30',
      ueId: defaultUe?.id ?? '',
      salle: 'Amphi A1',
    });
    setSlotModal(true);
  };

  const openEditSlot = (slot: ScheduleSlot) => {
    setEditingSlot(slot);
    setSlotForm({ ...slot });
    setSlotModal(true);
  };

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotForm.ueId || !slotForm.salle?.trim()) return;
    const ue = state.ues.find((u) => u.id === slotForm.ueId);
    const payload: ScheduleSlot = {
      id: editingSlot ? editingSlot.id : `sch-${Date.now()}`,
      campus: (slotForm.campus as Campus) || 'Pointe-Noire',
      filiereCode: ue?.filiereCode ?? slotForm.filiereCode ?? 'GCF',
      option: ue?.option ?? slotForm.option ?? 'Tronc commun',
      niveau: ue?.niveau ?? (slotForm.niveau as Niveau) ?? 'L1',
      jour: (slotForm.jour as ScheduleSlot['jour']) || 'Lundi',
      heureDebut: slotForm.heureDebut || '08:00',
      heureFin: slotForm.heureFin || '10:30',
      ueId: slotForm.ueId,
      salle: slotForm.salle.trim(),
    };
    if (editingSlot) {
      onUpdateSchedule(payload);
    } else {
      onAddSchedule(payload);
    }
    setSlotModal(false);
  };

  const selectedUeFiliere = state.filieres.find((f) => f.code === ueForm.filiereCode);
  const ueModalOptions = Array.from(
    new Set([
      'Tronc commun',
      ...(selectedUeFiliere?.options ?? []),
      ...(ueForm.option ? [ueForm.option] : []),
    ])
  );

  return (
    <div className="space-y-5">
      {/* Sub-navigation & Filters */}
      <div className="bg-white border border-[#e3e7ef] rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#f8f9fb] border border-[#e3e7ef] rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setSubTab('maquette')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'maquette'
                ? 'bg-[#0b1f3f] text-white'
                : 'text-slate-600 hover:text-[#161e2e]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Filières & Maquettes LMD
          </button>
          <button
            type="button"
            onClick={() => setSubTab('planning')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'planning'
                ? 'bg-[#0b1f3f] text-white'
                : 'text-slate-600 hover:text-[#161e2e]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Emploi du temps hebdomadaire
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedFiliere}
            onChange={(e) => {
              setSelectedFiliere(e.target.value);
              setSelectedOption('Toutes');
            }}
            aria-label="Filtrer par filière"
            className="px-3 py-2 text-xs font-medium border border-[#e3e7ef] rounded-lg bg-white text-[#161e2e]"
          >
            <option value="Toutes">Toutes les filières</option>
            {state.filieres.map((f) => (
              <option key={f.id} value={f.code}>
                {f.code} — {f.nom}
              </option>
            ))}
          </select>

          <select
            value={selectedOption}
            onChange={(e) => setSelectedOption(e.target.value)}
            aria-label="Filtrer par option"
            className="px-3 py-2 text-xs font-medium border border-[#e3e7ef] rounded-lg bg-white text-[#161e2e]"
          >
            <option value="Toutes">Toutes les options</option>
            <option value="Tronc commun">Tronc commun</option>
            {availableOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          {subTab === 'maquette' ? (
            <>
              <button
                type="button"
                onClick={openCreateFiliere}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#0b1f3f] text-[#0b1f3f] hover:bg-slate-50 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Nouvelle filière
              </button>
              <button
                type="button"
                onClick={openCreateUe}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#eab33a]" />
                Ajouter une UE
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPrintPlanning(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#e3e7ef] hover:border-[#0b1f3f] text-[#0b1f3f] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimer planning
              </button>
              <button
                type="button"
                onClick={openCreateSlot}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#eab33a]" />
                Planifier un cours
              </button>
            </>
          )}
        </div>
      </div>

      {subTab === 'maquette' ? (
        <div className="space-y-6">
          {/* Filières Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {state.filieres.map((f) => (
              <div key={f.id} className="bg-white border border-[#e3e7ef] rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-[#c58b12]">
                      {f.code} · {f.cycle}
                    </p>
                    <h4 className="text-sm font-semibold text-[#161e2e] mt-0.5 truncate">
                      {f.nom}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{f.departement}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditFiliere(f)}
                      aria-label={`Modifier filière ${f.code}`}
                      className="p-1.5 rounded text-slate-500 hover:text-[#0b1f3f] hover:bg-slate-100 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteFiliere(f.id)}
                      aria-label={`Supprimer filière ${f.code}`}
                      className="p-1.5 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-2.5 pt-2.5 border-t border-[#e3e7ef] space-y-2">
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    <span className="font-semibold text-[#0b1f3f]">Options :</span>{' '}
                    {(f.options ?? []).length > 0
                      ? f.options.join(' · ')
                      : 'Aucune option définie'}
                  </p>
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-600">
                    <span>Inscr: {formatFCFA(f.fraisInscription)}</span>
                    <span>Scolarité: {formatFCFA(f.scolariteAnnuelle)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* UE Table */}
          <div className="bg-white border border-[#e3e7ef] rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#e3e7ef] bg-[#f8f9fb]">
              <h3 className="text-sm font-semibold text-[#161e2e]">
                Unités d’Enseignement (UE) & Crédits ECTS ({filteredUes.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#e3e7ef] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Intitulé & UE parente</th>
                    <th className="py-3 px-4">Filière & Option</th>
                    <th className="py-3 px-4">Niveau</th>
                    <th className="py-3 px-4 text-right">Crédits</th>
                    <th className="py-3 px-4 text-right">Coef.</th>
                    <th className="py-3 px-4 text-right">Vol. Hor.</th>
                    <th className="py-3 px-4">Enseignant</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e7ef]">
                  {filteredUes.map((u) => {
                    const ens = state.lecturers.find((l) => l.id === u.enseignantId);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-[#0b1f3f]">
                          {u.code}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-[#161e2e]">{u.intitule}</p>
                          {u.uniteParent && (
                            <p className="text-xs text-slate-500">UE : {u.uniteParent}</p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-xs font-semibold text-[#0b1f3f]">{u.filiereCode}</p>
                          <p className="text-xs text-slate-600">
                            {u.option || 'Tronc commun'}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                          {u.niveau} · {u.semestre}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">{u.credits}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">{u.coefficient}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {u.volumeHoraire}h
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700">
                          {ens ? ens.nom : 'Non affecté'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditUe(u)}
                              aria-label={`Modifier ${u.code}`}
                              className="p-1.5 rounded text-slate-500 hover:text-[#0b1f3f] hover:bg-slate-100 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteUe(u.id)}
                              aria-label={`Supprimer ${u.code}`}
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
        </div>
      ) : (
        /* Weekly Schedule Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {JOURS.map((jour) => {
            const slots = filteredSchedule
              .filter((s) => s.jour === jour)
              .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
            return (
              <div
                key={jour}
                className="bg-white border border-[#e3e7ef] rounded-lg overflow-hidden"
              >
                <div className="px-4 py-2.5 bg-[#0b1f3f] text-white flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider">{jour}</span>
                  <span className="font-mono text-xs text-[#eab33a] tabular-nums">
                    {slots.length} séance(s)
                  </span>
                </div>
                <div className="divide-y divide-[#e3e7ef]">
                  {slots.map((slot) => {
                    const ue = state.ues.find((u) => u.id === slot.ueId);
                    const ens = state.lecturers.find((l) => l.id === ue?.enseignantId);
                    return (
                      <div key={slot.id} className="p-3.5 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-[#c58b12] tabular-nums">
                            {slot.heureDebut} – {slot.heureFin}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditSlot(slot)}
                              aria-label="Modifier séance"
                              className="text-slate-500 hover:text-[#0b1f3f] p-1 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteSchedule(slot.id)}
                              aria-label="Supprimer séance"
                              className="text-slate-400 hover:text-red-700 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-[#161e2e]">
                          {ue ? `${ue.code} — ${ue.intitule}` : slot.ueId}
                        </p>
                        <p className="text-xs text-slate-600">
                          {slot.filiereCode} {slot.niveau} · {slot.option || ue?.option || 'Tronc commun'} ·{' '}
                          {slot.salle}
                        </p>
                        <p className="text-xs text-slate-500">
                          {slot.campus} · {ens?.nom ?? 'Enseignant à confirmer'}
                        </p>
                      </div>
                    );
                  })}
                  {slots.length === 0 && (
                    <p className="p-5 text-xs text-slate-400 text-center">
                      Aucune séance planifiée ce jour.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Filiere Modal */}
      {filiereModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142b]/70 p-4">
          <div className="bg-white border border-[#e3e7ef] rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e3e7ef] bg-[#f8f9fb]">
              <h3 className="text-base font-semibold text-[#161e2e]">
                {editingFiliere ? 'Modifier la filière' : 'Nouvelle filière CEREC-ISCOM'}
              </h3>
              <button
                type="button"
                onClick={() => setFiliereModal(false)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveFiliere} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="MKT"
                    value={filiereForm.code || ''}
                    onChange={(e) => setFiliereForm({ ...filiereForm, code: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Intitulé *</label>
                  <input
                    type="text"
                    required
                    placeholder="Marketing Digital & Communication"
                    value={filiereForm.nom || ''}
                    onChange={(e) => setFiliereForm({ ...filiereForm, nom: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Cycle</label>
                  <select
                    value={filiereForm.cycle}
                    onChange={(e) => setFiliereForm({ ...filiereForm, cycle: e.target.value as Cycle })}
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                  >
                    <option value="BTS">BTS</option>
                    <option value="Licence">Licence</option>
                    <option value="Master">Master</option>
                    <option value="Qualifiant">Qualifiant</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Département</label>
                  <input
                    type="text"
                    value={filiereForm.departement || ''}
                    onChange={(e) =>
                      setFiliereForm({ ...filiereForm, departement: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Frais d’inscription (FCFA)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={5000}
                    value={filiereForm.fraisInscription ?? 75000}
                    onChange={(e) =>
                      setFiliereForm({
                        ...filiereForm,
                        fraisInscription: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Scolarité annuelle (FCFA)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={filiereForm.scolariteAnnuelle ?? 480000}
                    onChange={(e) =>
                      setFiliereForm({
                        ...filiereForm,
                        scolariteAnnuelle: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">
                  Options / Spécialités rattachées à la filière
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: Audit & Contrôle de Gestion"
                    value={newOptionInput}
                    onChange={(e) => setNewOptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addOptionToFiliereForm();
                      }
                    }}
                    className="flex-1 px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={addOptionToFiliereForm}
                    className="px-3 py-2 rounded-lg border border-[#0b1f3f] text-xs font-semibold text-[#0b1f3f] hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                  >
                    Ajouter option
                  </button>
                </div>
                {(filiereForm.options ?? []).length > 0 && (
                  <div className="divide-y divide-[#e3e7ef] border border-[#e3e7ef] rounded-lg overflow-hidden">
                    {(filiereForm.options ?? []).map((opt) => (
                      <div
                        key={opt}
                        className="flex items-center justify-between px-3 py-1.5 text-xs bg-[#f8f9fb]"
                      >
                        <span className="font-medium text-[#161e2e]">{opt}</span>
                        <button
                          type="button"
                          onClick={() => removeOptionFromFiliereForm(opt)}
                          aria-label={`Retirer l'option ${opt}`}
                          className="text-slate-400 hover:text-red-700 p-0.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-[#e3e7ef]">
                <button
                  type="button"
                  onClick={() => setFiliereModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#e3e7ef] text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0b1f3f] text-white text-xs font-semibold cursor-pointer"
                >
                  {editingFiliere ? 'Enregistrer' : 'Créer la filière'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit UE Modal */}
      {ueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142b]/70 p-4">
          <div className="bg-white border border-[#e3e7ef] rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e3e7ef] bg-[#f8f9fb]">
              <h3 className="text-base font-semibold text-[#161e2e]">
                {editingUe
                  ? `Modifier l’UE ${editingUe.code}`
                  : 'Nouvelle Unité d’Enseignement (UE)'}
              </h3>
              <button
                type="button"
                onClick={() => setUeModal(false)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveUe} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Code UE *</label>
                  <input
                    type="text"
                    required
                    placeholder="GCF204"
                    value={ueForm.code || ''}
                    onChange={(e) => setUeForm({ ...ueForm, code: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Intitulé *</label>
                  <input
                    type="text"
                    required
                    placeholder="Fiscalité des Entreprises CEMAC"
                    value={ueForm.intitule || ''}
                    onChange={(e) => setUeForm({ ...ueForm, intitule: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Unité d’enseignement (regroupement bulletin, optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Sciences Comptables & Financières"
                  value={ueForm.uniteParent || ''}
                  onChange={(e) => setUeForm({ ...ueForm, uniteParent: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Filière de rattachement *
                  </label>
                  <select
                    value={ueForm.filiereCode}
                    onChange={(e) => {
                      const nextCode = e.target.value;
                      const nextFil = state.filieres.find((f) => f.code === nextCode);
                      setUeForm({
                        ...ueForm,
                        filiereCode: nextCode,
                        option: nextFil?.options?.[0] ?? 'Tronc commun',
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                  >
                    {state.filieres.map((f) => (
                      <option key={f.id} value={f.code}>
                        {f.code} — {f.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Option de rattachement *
                  </label>
                  <select
                    value={ueForm.option || 'Tronc commun'}
                    onChange={(e) => setUeForm({ ...ueForm, option: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                  >
                    {ueModalOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Niveau</label>
                  <select
                    value={ueForm.niveau}
                    onChange={(e) => setUeForm({ ...ueForm, niveau: e.target.value as Niveau })}
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                  >
                    {(['L1', 'L2', 'L3', 'M1', 'M2', 'FQ'] as Niveau[]).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Semestre</label>
                  <select
                    value={ueForm.semestre}
                    onChange={(e) => setUeForm({ ...ueForm, semestre: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                  >
                    {['S1', 'S2', 'S3', 'S4', 'S5', 'S6'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Crédits ECTS</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={ueForm.credits ?? 5}
                    onChange={(e) => setUeForm({ ...ueForm, credits: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Coefficient</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={ueForm.coefficient ?? 2}
                    onChange={(e) => setUeForm({ ...ueForm, coefficient: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vol. Horaire</label>
                  <input
                    type="number"
                    min={10}
                    max={120}
                    value={ueForm.volumeHoraire ?? 36}
                    onChange={(e) => setUeForm({ ...ueForm, volumeHoraire: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Enseignant</label>
                <select
                  value={ueForm.enseignantId}
                  onChange={(e) => setUeForm({ ...ueForm, enseignantId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                >
                  {state.lecturers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nom} ({l.campus})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-[#e3e7ef]">
                <button
                  type="button"
                  onClick={() => setUeModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#e3e7ef] text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0b1f3f] text-white text-xs font-semibold cursor-pointer"
                >
                  {editingUe ? 'Mettre à jour' : 'Enregistrer l’UE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Schedule Slot Modal */}
      {slotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142b]/70 p-4">
          <div className="bg-white border border-[#e3e7ef] rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e3e7ef] bg-[#f8f9fb]">
              <h3 className="text-base font-semibold text-[#161e2e]">
                {editingSlot ? 'Modifier la séance' : 'Planifier une séance de cours'}
              </h3>
              <button
                type="button"
                onClick={() => setSlotModal(false)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSlot} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Unité d’Enseignement (UE)
                </label>
                <select
                  value={slotForm.ueId}
                  onChange={(e) => setSlotForm({ ...slotForm, ueId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                >
                  {state.ues.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code} — {u.intitule} ({u.filiereCode} · {u.option || 'Tronc commun'} · {u.niveau})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Campus</label>
                  <select
                    value={slotForm.campus}
                    onChange={(e) => setSlotForm({ ...slotForm, campus: e.target.value as Campus })}
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                  >
                    <option value="Pointe-Noire">Pointe-Noire</option>
                    <option value="Brazzaville">Brazzaville</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Jour</label>
                  <select
                    value={slotForm.jour}
                    onChange={(e) =>
                      setSlotForm({ ...slotForm, jour: e.target.value as ScheduleSlot['jour'] })
                    }
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                  >
                    {JOURS.map((j) => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Début</label>
                  <input
                    type="time"
                    value={slotForm.heureDebut || '08:00'}
                    onChange={(e) => setSlotForm({ ...slotForm, heureDebut: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Fin</label>
                  <input
                    type="time"
                    value={slotForm.heureFin || '10:30'}
                    onChange={(e) => setSlotForm({ ...slotForm, heureFin: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Salle *</label>
                  <input
                    type="text"
                    required
                    value={slotForm.salle || ''}
                    onChange={(e) => setSlotForm({ ...slotForm, salle: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-[#e3e7ef]">
                <button
                  type="button"
                  onClick={() => setSlotModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#e3e7ef] text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0b1f3f] text-white text-xs font-semibold cursor-pointer"
                >
                  {editingSlot ? 'Enregistrer' : 'Ajouter au planning'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Weekly Schedule */}
      {printPlanning && (
        <PrintModal
          title="Emploi du temps hebdomadaire officiel"
          subtitle={`Campus : ${campusFilter === 'Tous' ? 'Pointe-Noire & Brazzaville' : campusFilter} · Filière : ${selectedFiliere}`}
          onClose={() => setPrintPlanning(false)}
        >
          <div className="space-y-4 text-xs">
            <OfficialDocumentHeader
              campus={campusFilter === 'Tous' ? 'Pointe-Noire & Brazzaville' : campusFilter}
              docTitle="Emploi du Temps Hebdomadaire"
              docRef={`EDT-${selectedFiliere}-2026`}
            />
            <table className="w-full text-left border-collapse border border-[#e3e7ef]">
              <thead>
                <tr className="bg-[#0b1f3f] text-white text-[11px] uppercase">
                  <th className="py-2 px-3">Jour</th>
                  <th className="py-2 px-3">Horaire</th>
                  <th className="py-2 px-3">Parcours</th>
                  <th className="py-2 px-3">Module / UE</th>
                  <th className="py-2 px-3">Salle</th>
                  <th className="py-2 px-3">Enseignant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e7ef]">
                {filteredSchedule.map((slot) => {
                  const ue = state.ues.find((u) => u.id === slot.ueId);
                  const ens = state.lecturers.find((l) => l.id === ue?.enseignantId);
                  return (
                    <tr key={slot.id}>
                      <td className="py-2 px-3 font-semibold">{slot.jour}</td>
                      <td className="py-2 px-3 font-mono tabular-nums">
                        {slot.heureDebut} – {slot.heureFin}
                      </td>
                      <td className="py-2 px-3">
                        {slot.filiereCode} {slot.niveau} · {slot.option || ue?.option || 'Tronc commun'} ({slot.campus})
                      </td>
                      <td className="py-2 px-3 font-medium">
                        {ue ? `${ue.code} — ${ue.intitule}` : slot.ueId}
                      </td>
                      <td className="py-2 px-3">{slot.salle}</td>
                      <td className="py-2 px-3">{ens?.nom ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </PrintModal>
      )}
    </div>
  );
}
