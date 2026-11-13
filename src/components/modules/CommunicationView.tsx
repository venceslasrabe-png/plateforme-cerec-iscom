import { CheckCircle2, Edit3, Megaphone, Plus, Trash2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  Announcement,
  Campus,
  CerecState,
  MissionTask,
  UserRole,
} from '../../types/cerec';
import { getRoleDefinition } from '../../utils/permissions';

interface CommunicationViewProps {
  state: CerecState;
  campusFilter: Campus | 'Tous';
  activeRole: UserRole;
  canPublish?: boolean;
  canUpdateMissionStatus?: boolean;
  onAddAnnouncement: (ann: Announcement) => void;
  onUpdateAnnouncement: (ann: Announcement) => void;
  onDeleteAnnouncement: (id: string) => void;
  onAddMission: (task: MissionTask) => void;
  onUpdateMission: (task: MissionTask) => void;
  onUpdateMissionStatus: (id: string, statut: MissionTask['statut']) => void;
  onDeleteMission: (id: string) => void;
}

export function CommunicationView({
  state,
  campusFilter,
  activeRole,
  canPublish = true,
  canUpdateMissionStatus = true,
  onAddAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
  onAddMission,
  onUpdateMission,
  onUpdateMissionStatus,
  onDeleteMission,
}: CommunicationViewProps) {
  const [annModal, setAnnModal] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);

  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<MissionTask | null>(null);

  const [annForm, setAnnForm] = useState<Partial<Announcement>>({
    cible: 'Tous',
    campus: 'Tous',
    priorite: 'Normale',
    auteur: 'Direction Générale CEREC-ISCOM',
  });

  const [taskForm, setTaskForm] = useState<Partial<MissionTask>>({
    assigneA: 'Service Scolarité & Examens',
    priorite: 'Haute',
    echeance: '2026-11-22',
  });

  const roleDef = getRoleDefinition(activeRole);
  const assignedService = roleDef.assignedMissionService;
  const [missionScope, setMissionScope] = useState<'all' | 'mine'>(() =>
    assignedService && !canPublish ? 'mine' : 'all'
  );

  useEffect(() => {
    setMissionScope(assignedService && !canPublish ? 'mine' : 'all');
  }, [activeRole, assignedService, canPublish]);

  const announcements = state.announcements.filter(
    (a) => campusFilter === 'Tous' || a.campus === 'Tous' || a.campus === campusFilter
  );

  const visibleMissions =
    missionScope === 'mine' && assignedService
      ? state.missions.filter((m) => m.assigneA === assignedService)
      : state.missions;

  const openCreateAnn = () => {
    if (!canPublish) return;
    setEditingAnn(null);
    setAnnForm({
      titre: '',
      contenu: '',
      cible: 'Tous',
      campus: 'Tous',
      priorite: 'Normale',
      auteur: 'Direction Générale CEREC-ISCOM',
    });
    setAnnModal(true);
  };

  const openEditAnn = (ann: Announcement) => {
    if (!canPublish) return;
    setEditingAnn(ann);
    setAnnForm({ ...ann });
    setAnnModal(true);
  };

  const handleSaveAnn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPublish || !annForm.titre?.trim() || !annForm.contenu?.trim()) return;
    const payload: Announcement = {
      id: editingAnn ? editingAnn.id : `ann-${Date.now()}`,
      titre: annForm.titre.trim(),
      contenu: annForm.contenu.trim(),
      cible: (annForm.cible as Announcement['cible']) || 'Tous',
      campus: (annForm.campus as Campus | 'Tous') || 'Tous',
      priorite: (annForm.priorite as Announcement['priorite']) || 'Normale',
      auteur: annForm.auteur?.trim() || 'Administration',
      date: editingAnn ? editingAnn.date : new Date().toISOString().slice(0, 10),
    };
    if (editingAnn) {
      onUpdateAnnouncement(payload);
    } else {
      onAddAnnouncement(payload);
    }
    setAnnModal(false);
  };

  const openCreateTask = () => {
    if (!canPublish) return;
    setEditingTask(null);
    setTaskForm({
      titre: '',
      description: '',
      assigneA: assignedService || 'Service Scolarité & Examens',
      priorite: 'Haute',
      echeance: '2026-11-22',
      statut: 'À faire',
    });
    setTaskModal(true);
  };

  const openEditTask = (m: MissionTask) => {
    if (!canPublish) return;
    setEditingTask(m);
    setTaskForm({ ...m });
    setTaskModal(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPublish || !taskForm.titre?.trim()) return;
    const payload: MissionTask = {
      id: editingTask ? editingTask.id : `mis-${Date.now()}`,
      titre: taskForm.titre.trim(),
      description: taskForm.description?.trim() || '',
      assigneA: taskForm.assigneA || 'Service Scolarité & Examens',
      echeance: taskForm.echeance || '2026-11-30',
      priorite: (taskForm.priorite as MissionTask['priorite']) || 'Moyenne',
      statut: (taskForm.statut as MissionTask['statut']) || 'À faire',
    };
    if (editingTask) {
      onUpdateMission(payload);
    } else {
      onAddMission(payload);
    }
    setTaskModal(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Notes de service & Diffusions */}
      <div className="lg:col-span-7 bg-white border border-[#e3e7ef] rounded-lg overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-[#e3e7ef] bg-[#f8f9fb] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#0b1f3f] shrink-0" />
            <h3 className="text-sm font-semibold text-[#161e2e]">
              Notes de service & Diffusions Campus ({announcements.length})
            </h3>
          </div>
          {canPublish && (
            <button
              type="button"
              onClick={openCreateAnn}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b1f3f] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-[#eab33a]" />
              Publier une note
            </button>
          )}
        </div>

        <div className="divide-y divide-[#e3e7ef]">
          {announcements.map((ann) => (
            <div key={ann.id} className="p-5 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-sm font-semibold text-[#161e2e]">{ann.titre}</h4>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      ann.priorite === 'Urgente'
                        ? 'bg-red-50 text-red-700'
                        : ann.priorite === 'Importante'
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {ann.priorite}
                  </span>
                  {canPublish && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditAnn(ann)}
                        aria-label={`Modifier ${ann.titre}`}
                        className="p-1 rounded text-slate-500 hover:text-[#0b1f3f] hover:bg-slate-100 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteAnnouncement(ann.id)}
                        aria-label={`Supprimer ${ann.titre}`}
                        className="p-1 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{ann.contenu}</p>
              <p className="text-xs text-slate-500">
                Cible : {ann.cible} · Campus : {ann.campus} · Par {ann.auteur} · {ann.date}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Missions & Assignations */}
      <div className="lg:col-span-5 bg-white border border-[#e3e7ef] rounded-lg overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-[#e3e7ef] bg-[#f8f9fb] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#c58b12] shrink-0" />
            <h3 className="text-sm font-semibold text-[#161e2e]">
              Missions & Assignations ({visibleMissions.length})
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {assignedService && (
              <div className="inline-flex items-center p-0.5 bg-white border border-[#e3e7ef] rounded-lg text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setMissionScope('mine')}
                  className={`px-2 py-1 rounded-md cursor-pointer ${
                    missionScope === 'mine'
                      ? 'bg-[#0b1f3f] text-white'
                      : 'text-slate-600 hover:text-[#161e2e]'
                  }`}
                >
                  Mon service
                </button>
                <button
                  type="button"
                  onClick={() => setMissionScope('all')}
                  className={`px-2 py-1 rounded-md cursor-pointer ${
                    missionScope === 'all'
                      ? 'bg-[#0b1f3f] text-white'
                      : 'text-slate-600 hover:text-[#161e2e]'
                  }`}
                >
                  Toutes
                </button>
              </div>
            )}
            {canPublish && (
              <button
                type="button"
                onClick={openCreateTask}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e0a526] text-[#07142b] text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Nouvelle tâche
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-[#e3e7ef]">
          {visibleMissions.map((m) => {
            const canToggleThisMission =
              canUpdateMissionStatus &&
              (canPublish || !assignedService || m.assigneA === assignedService);
            return (
              <div key={m.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[#161e2e]">{m.titre}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums mr-1">
                      {m.echeance}
                    </span>
                    {canPublish && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditTask(m)}
                          aria-label={`Modifier mission ${m.titre}`}
                          className="p-1 rounded text-slate-500 hover:text-[#0b1f3f] hover:bg-slate-100 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMission(m.id)}
                          aria-label={`Supprimer mission ${m.titre}`}
                          className="p-1 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {m.description && (
                  <p className="text-xs text-slate-600 leading-relaxed">{m.description}</p>
                )}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-slate-500">{m.assigneA}</span>
                  {canToggleThisMission ? (
                    <select
                      value={m.statut}
                      onChange={(e) =>
                        onUpdateMissionStatus(m.id, e.target.value as MissionTask['statut'])
                      }
                      aria-label={`Statut ${m.titre}`}
                      className="px-2 py-1 text-xs font-medium border border-[#e3e7ef] rounded bg-white text-[#161e2e]"
                    >
                      <option value="À faire">À faire</option>
                      <option value="En cours">En cours</option>
                      <option value="Terminé">Terminé</option>
                    </select>
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium border ${
                        m.statut === 'Terminé'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : m.statut === 'En cours'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-slate-50 text-slate-600 border-[#e3e7ef]'
                      }`}
                    >
                      {m.statut}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {visibleMissions.length === 0 && (
            <div className="py-8 px-4 text-center text-xs text-slate-500">
              Aucune mission assignée à ce service pour le moment.
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Announcement Modal */}
      {canPublish && annModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142b]/70 p-3 sm:p-4">
          <div className="bg-white border border-[#e3e7ef] rounded-xl w-full max-w-lg shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#e3e7ef] bg-[#f8f9fb] shrink-0">
              <h3 className="text-base font-semibold text-[#161e2e]">
                {editingAnn ? 'Modifier la note de service' : 'Publier une note de service'}
              </h3>
              <button
                type="button"
                onClick={() => setAnnModal(false)}
                className="p-1 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveAnn} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
                <input
                  type="text"
                  required
                  value={annForm.titre || ''}
                  onChange={(e) => setAnnForm({ ...annForm, titre: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Cible</label>
                  <select
                    value={annForm.cible}
                    onChange={(e) =>
                      setAnnForm({ ...annForm, cible: e.target.value as Announcement['cible'] })
                    }
                    className="w-full px-2.5 py-2 text-xs border border-[#e3e7ef] rounded-lg bg-white"
                  >
                    <option value="Tous">Tous</option>
                    <option value="Étudiants">Étudiants</option>
                    <option value="Enseignants">Enseignants</option>
                    <option value="Caisse">Caisse</option>
                    <option value="Scolarité">Scolarité</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Campus</label>
                  <select
                    value={annForm.campus}
                    onChange={(e) =>
                      setAnnForm({ ...annForm, campus: e.target.value as Campus | 'Tous' })
                    }
                    className="w-full px-2.5 py-2 text-xs border border-[#e3e7ef] rounded-lg bg-white"
                  >
                    <option value="Tous">Tous</option>
                    <option value="Pointe-Noire">Pointe-Noire</option>
                    <option value="Brazzaville">Brazzaville</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Priorité</label>
                  <select
                    value={annForm.priorite}
                    onChange={(e) =>
                      setAnnForm({
                        ...annForm,
                        priorite: e.target.value as Announcement['priorite'],
                      })
                    }
                    className="w-full px-2.5 py-2 text-xs border border-[#e3e7ef] rounded-lg bg-white"
                  >
                    <option value="Normale">Normale</option>
                    <option value="Importante">Importante</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Message *</label>
                <textarea
                  rows={4}
                  required
                  value={annForm.contenu || ''}
                  onChange={(e) => setAnnForm({ ...annForm, contenu: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-[#e3e7ef]">
                <button
                  type="button"
                  onClick={() => setAnnModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#e3e7ef] text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0b1f3f] text-white text-xs font-semibold cursor-pointer"
                >
                  {editingAnn ? 'Enregistrer' : 'Diffuser'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Mission Modal */}
      {canPublish && taskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142b]/70 p-3 sm:p-4">
          <div className="bg-white border border-[#e3e7ef] rounded-xl w-full max-w-lg shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#e3e7ef] bg-[#f8f9fb] shrink-0">
              <h3 className="text-base font-semibold text-[#161e2e]">
                {editingTask ? 'Modifier la mission' : 'Assigner une nouvelle mission'}
              </h3>
              <button
                type="button"
                onClick={() => setTaskModal(false)}
                className="p-1 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveTask} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Intitulé de la mission *
                </label>
                <input
                  type="text"
                  required
                  value={taskForm.titre || ''}
                  onChange={(e) => setTaskForm({ ...taskForm, titre: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Service assigné
                  </label>
                  <select
                    value={taskForm.assigneA}
                    onChange={(e) => setTaskForm({ ...taskForm, assigneA: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#e3e7ef] rounded-lg bg-white"
                  >
                    <option value="Service Scolarité & Examens">Service Scolarité & Examens</option>
                    <option value="Caisse & Comptabilité">Caisse & Comptabilité</option>
                    <option value="Direction Académique">Direction Académique</option>
                    <option value="Surveillance & Guérite">Surveillance & Guérite</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Échéance</label>
                  <input
                    type="date"
                    value={taskForm.echeance || ''}
                    onChange={(e) => setTaskForm({ ...taskForm, echeance: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-[#e3e7ef] rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Détails</label>
                <textarea
                  rows={3}
                  value={taskForm.description || ''}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-[#e3e7ef]">
                <button
                  type="button"
                  onClick={() => setTaskModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#e3e7ef] text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0b1f3f] text-white text-xs font-semibold cursor-pointer"
                >
                  {editingTask ? 'Enregistrer' : 'Créer la mission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
