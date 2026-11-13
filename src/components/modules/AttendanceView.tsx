import { AlertTriangle, CheckCheck, Printer, QrCode, RotateCcw } from 'lucide-react';
import React, { useState } from 'react';
import {
  AttendanceRecord,
  AttendanceStatus,
  Campus,
  CerecState,
} from '../../types/cerec';
import { ueMatchesStudent } from '../../utils/lmd';
import { OfficialDocumentHeader, PrintModal } from '../PrintModal';

interface AttendanceViewProps {
  state: CerecState;
  campusFilter: Campus | 'Tous';
  onSetAttendance: (record: AttendanceRecord) => void;
  onBulkAttendance: (records: AttendanceRecord[]) => void;
  onClearAttendance: (date: string, ueId: string, studentIds: string[]) => void;
}

export function AttendanceView({
  state,
  campusFilter,
  onSetAttendance,
  onBulkAttendance,
  onClearAttendance,
}: AttendanceViewProps) {
  const [selectedUeId, setSelectedUeId] = useState(state.ues[0]?.id ?? '');
  const [date, setDate] = useState('2026-11-12');
  const [scanCode, setScanCode] = useState('');
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [printSheet, setPrintSheet] = useState(false);

  const selectedUe = state.ues.find((u) => u.id === selectedUeId) ?? state.ues[0];

  const classStudents = state.students.filter((s) => {
    if (s.anneeAcademique !== state.settings.anneeAcademique) return false;
    if (campusFilter !== 'Tous' && s.campus !== campusFilter) return false;
    if (!selectedUe) return true;
    return ueMatchesStudent(selectedUe, s);
  });

  // Repeated absences alert across all records
  const absenceCounts = new Map<string, number>();
  state.attendance.forEach((a) => {
    if (a.statut === 'Absent') {
      absenceCounts.set(a.studentId, (absenceCounts.get(a.studentId) ?? 0) + 1);
    }
  });
  const flaggedStudents = state.students.filter(
    (s) =>
      s.anneeAcademique === state.settings.anneeAcademique &&
      (campusFilter === 'Tous' || s.campus === campusFilter) &&
      (absenceCounts.get(s.id) ?? 0) >= state.settings.seuilAbsencesAlerte
  );

  const handleQuickScan = (e: React.FormEvent) => {
    e.preventDefault();
    const q = scanCode.trim().toLowerCase();
    if (!q || !selectedUe) return;
    const matched = state.students.find(
      (s) =>
        s.matricule.toLowerCase() === q ||
        q.includes(s.matricule.toLowerCase()) ||
        s.nom.toLowerCase() === q
    );
    if (!matched) {
      setScanFeedback(`Aucun étudiant trouvé pour "${scanCode}".`);
      return;
    }
    const now = new Date().toTimeString().slice(0, 5);
    onSetAttendance({
      id: `att-${date}-${selectedUe.id}-${matched.id}`,
      date,
      ueId: selectedUe.id,
      studentId: matched.id,
      statut: 'Présent',
      heurePointage: now,
    });
    setScanFeedback(
      `Pointage validé : ${matched.nom} ${matched.prenom} (${matched.matricule}) à ${now}`
    );
    setScanCode('');
  };

  const getStatus = (studentId: string): AttendanceStatus | null => {
    const found = state.attendance.find(
      (a) => a.date === date && a.ueId === selectedUe?.id && a.studentId === studentId
    );
    return found?.statut ?? null;
  };

  const markStatus = (studentId: string, statut: AttendanceStatus) => {
    if (!selectedUe) return;
    const now =
      statut === 'Présent' || statut === 'Retard'
        ? new Date().toTimeString().slice(0, 5)
        : undefined;
    onSetAttendance({
      id: `att-${date}-${selectedUe.id}-${studentId}`,
      date,
      ueId: selectedUe.id,
      studentId,
      statut,
      heurePointage: now,
    });
  };

  const handleMarkAllPresent = () => {
    if (!selectedUe || classStudents.length === 0) return;
    const now = new Date().toTimeString().slice(0, 5);
    const records: AttendanceRecord[] = classStudents.map((s) => ({
      id: `att-${date}-${selectedUe.id}-${s.id}`,
      date,
      ueId: selectedUe.id,
      studentId: s.id,
      statut: 'Présent',
      heurePointage: now,
    }));
    onBulkAttendance(records);
  };

  const handleResetSession = () => {
    if (!selectedUe || classStudents.length === 0) return;
    onClearAttendance(
      date,
      selectedUe.id,
      classStudents.map((s) => s.id)
    );
  };

  return (
    <div className="space-y-5">
      {/* Controls & QR Scan */}
      <div className="bg-white border border-[#e3e7ef] rounded-lg p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        <div className="lg:col-span-5">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Cours / Unité d’Enseignement
          </label>
          <select
            value={selectedUe?.id ?? ''}
            onChange={(e) => setSelectedUeId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white text-[#161e2e]"
          >
            {state.ues.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} — {u.intitule} ({u.filiereCode} · {u.option || 'Tronc commun'} · {u.niveau})
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Date séance</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
          />
        </div>

        <form onSubmit={handleQuickScan} className="lg:col-span-5 flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Scan QR Badge ou Matricule rapide
            </label>
            <div className="relative">
              <QrCode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                placeholder="Ex: ISCOM-PN-26-001"
                className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            Pointer
          </button>
        </form>
      </div>

      {scanFeedback && (
        <div className="bg-[#fff4d6] border border-[#eab33a]/40 rounded-lg px-4 py-2.5 text-xs font-medium text-[#6b4e07]">
          {scanFeedback}
        </div>
      )}

      {/* Repeated Absences Banner */}
      {flaggedStudents.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
          <div className="text-xs text-red-900 space-y-1">
            <p className="font-semibold">
              Détection d’absences répétées ({flaggedStudents.length} étudiant(s) ≥{' '}
              {state.settings.seuilAbsencesAlerte} absences)
            </p>
            <p className="text-red-800">
              {flaggedStudents
                .map(
                  (s) =>
                    `${s.nom} ${s.prenom} (${s.matricule} · ${absenceCounts.get(s.id)} abs.)`
                )
                .join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Roll Call Table */}
      <div className="bg-white border border-[#e3e7ef] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e3e7ef] bg-[#f8f9fb] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#161e2e]">
              Feuille d’appel numérique · {selectedUe?.code} ({classStudents.length} étudiants)
            </h3>
            <p className="text-xs text-slate-500 font-mono">{date}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <CheckCheck className="w-3.5 h-3.5 text-[#eab33a]" />
              Tout marquer Présent
            </button>
            <button
              type="button"
              onClick={handleResetSession}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e3e7ef] hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Réinitialiser
            </button>
            <button
              type="button"
              onClick={() => setPrintSheet(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-semibold text-[#0b1f3f] cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimer feuille
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e3e7ef] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Matricule</th>
                <th className="py-3 px-4">Étudiant</th>
                <th className="py-3 px-4">Total Abs.</th>
                <th className="py-3 px-4 text-right">Marquer l’assiduité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e7ef]">
              {classStudents.map((s) => {
                const current = getStatus(s.id);
                const absTotal = absenceCounts.get(s.id) ?? 0;
                return (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-[#0b1f3f]">
                      {s.matricule}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-[#161e2e]">
                        {s.nom} {s.prenom}
                      </p>
                      <p className="text-xs text-slate-500">{s.campus}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums">
                      <span
                        className={
                          absTotal >= state.settings.seuilAbsencesAlerte
                            ? 'text-red-700 font-bold'
                            : 'text-slate-600'
                        }
                      >
                        {absTotal} absence(s)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {(['Présent', 'Retard', 'Absent', 'Justifié'] as AttendanceStatus[]).map(
                          (st) => {
                            const active = current === st;
                            const activeClass =
                              st === 'Présent'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : st === 'Retard'
                                ? 'bg-amber-600 text-white border-amber-600'
                                : st === 'Absent'
                                ? 'bg-red-700 text-white border-red-700'
                                : 'bg-[#0b1f3f] text-white border-[#0b1f3f]';
                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() => markStatus(s.id, st)}
                                className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                                  active
                                    ? activeClass
                                    : 'border-[#e3e7ef] text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {st}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {classStudents.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-slate-500">
                    Aucun étudiant inscrit dans cette classe pour le filtre campus actuel.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Attendance Sheet */}
      {printSheet && selectedUe && (
        <PrintModal
          title={`Feuille d’émargement — ${selectedUe.code}`}
          subtitle={`${selectedUe.intitule} · ${date}`}
          onClose={() => setPrintSheet(false)}
        >
          <div className="space-y-4 text-xs">
            <OfficialDocumentHeader
              campus={campusFilter === 'Tous' ? 'Pointe-Noire & Brazzaville' : campusFilter}
              docTitle="Feuille de Présences"
              docRef={`${selectedUe.code}-${date}`}
            />
            <p className="text-slate-700">
              Module : <strong>{selectedUe.code} — {selectedUe.intitule}</strong> ({selectedUe.filiereCode}{' '}
              {selectedUe.niveau}) · Date : <strong>{date}</strong>
            </p>
            <table className="w-full text-left border-collapse border border-[#e3e7ef]">
              <thead>
                <tr className="bg-[#0b1f3f] text-white text-[11px] uppercase">
                  <th className="py-2 px-3">Matricule</th>
                  <th className="py-2 px-3">Nom & Prénom</th>
                  <th className="py-2 px-3">Statut</th>
                  <th className="py-2 px-3">Émargement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e7ef]">
                {classStudents.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 px-3 font-mono">{s.matricule}</td>
                    <td className="py-2.5 px-3 font-medium">
                      {s.nom} {s.prenom}
                    </td>
                    <td className="py-2.5 px-3">{getStatus(s.id) ?? 'Non pointé'}</td>
                    <td className="py-2.5 px-3 w-36" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PrintModal>
      )}
    </div>
  );
}
