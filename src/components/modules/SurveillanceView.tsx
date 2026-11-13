import { LogIn, LogOut, Printer, QrCode, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import React, { useState } from 'react';
import { Campus, CerecState, GateLog } from '../../types/cerec';
import { computeStudentFinance } from '../../utils/lmd';
import { OfficialDocumentHeader, PrintModal } from '../PrintModal';

interface SurveillanceViewProps {
  state: CerecState;
  campusFilter: Campus | 'Tous';
  onAddGateLog: (log: GateLog) => void;
  onMarkExit: (id: string) => void;
  onCloseAllGateLogs: () => void;
  onDeleteGateLog: (id: string) => void;
}

export function SurveillanceView({
  state,
  campusFilter,
  onAddGateLog,
  onMarkExit,
  onCloseAllGateLogs,
  onDeleteGateLog,
}: SurveillanceViewProps) {
  const [badgeInput, setBadgeInput] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [visitorDoc, setVisitorDoc] = useState('');
  const [visitorMotif, setVisitorMotif] = useState('');
  const [printLogs, setPrintLogs] = useState(false);
  const [lastCheck, setLastCheck] = useState<{
    name: string;
    status: GateLog['statutAcces'];
    detail: string;
  } | null>(null);

  const logs = state.gateLogs
    .filter((g) => campusFilter === 'Tous' || g.campus === campusFilter)
    .sort((a, b) => b.heureEntree.localeCompare(a.heureEntree));

  const insideCount = logs.filter((g) => !g.heureSortie).length;
  const alertCount = logs.filter((g) => g.statutAcces !== 'Autorisé').length;

  const handleBadgeCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    const q = badgeInput.trim().toLowerCase();
    if (!q) return;

    const student = state.students.find(
      (s) =>
        s.matricule.toLowerCase() === q ||
        q.includes(s.matricule.toLowerCase()) ||
        s.nom.toLowerCase() === q
    );

    if (!student) {
      setLastCheck({
        name: badgeInput.toUpperCase(),
        status: 'Refusé',
        detail: 'Matricule introuvable dans la base CEREC-ISCOM.',
      });
      return;
    }

    const fin = computeStudentFinance(student, state.filieres, state.payments);
    let statutAcces: GateLog['statutAcces'] = 'Autorisé';
    let detail = `Dossier ${student.statutDossier} · Scolarité couverte à ${fin.tauxCouverture}%`;

    if (student.statutDossier === 'Suspendu') {
      statutAcces = 'Refusé';
      detail = 'Dossier académique suspendu. Orienter vers la Scolarité.';
    } else if (fin.tauxCouverture < state.settings.seuilBlocagePortailPct) {
      statutAcces = 'Alerte Scolarité';
      detail = `Couverture scolarité ${fin.tauxCouverture}% (< ${state.settings.seuilBlocagePortailPct}%). Rappeler passage à la Caisse.`;
    }

    const now = new Date().toTimeString().slice(0, 5);
    onAddGateLog({
      id: `gt-${Date.now()}`,
      campus: student.campus,
      typePersonne: 'Étudiant',
      studentId: student.id,
      nomComplet: `${student.nom} ${student.prenom}`,
      reference: student.matricule,
      motif: `Accès campus (${student.filiereCode} ${student.niveau})`,
      heureEntree: now,
      statutAcces,
      date: new Date().toISOString().slice(0, 10),
    });

    setLastCheck({
      name: `${student.nom} ${student.prenom} (${student.matricule})`,
      status: statutAcces,
      detail,
    });
    setBadgeInput('');
  };

  const handleVisitorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim() || !visitorMotif.trim()) return;
    const now = new Date().toTimeString().slice(0, 5);
    onAddGateLog({
      id: `gt-${Date.now()}`,
      campus: campusFilter === 'Tous' ? 'Pointe-Noire' : campusFilter,
      typePersonne: 'Visiteur',
      nomComplet: visitorName.trim(),
      reference: visitorDoc.trim() || 'CNI / Pièce',
      motif: visitorMotif.trim(),
      heureEntree: now,
      statutAcces: 'Autorisé',
      date: new Date().toISOString().slice(0, 10),
    });
    setVisitorName('');
    setVisitorDoc('');
    setVisitorMotif('');
  };

  return (
    <div className="space-y-5">
      {/* Gate KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#e3e7ef] rounded-lg p-4">
          <p className="text-xs text-slate-500">Présents actuellement sur le campus</p>
          <p className="font-mono text-xl font-bold text-[#0b1f3f] mt-1 tabular-nums">
            {insideCount}
          </p>
        </div>
        <div className="bg-white border border-[#e3e7ef] rounded-lg p-4">
          <p className="text-xs text-slate-500">Total passages guérite aujourd’hui</p>
          <p className="font-mono text-xl font-bold text-[#161e2e] mt-1 tabular-nums">
            {logs.length}
          </p>
        </div>
        <div className="bg-white border border-[#e3e7ef] rounded-lg p-4">
          <p className="text-xs text-slate-500">Alertes scolarité / refus accès</p>
          <p className="font-mono text-xl font-bold text-amber-700 mt-1 tabular-nums">
            {alertCount}
          </p>
        </div>
      </div>

      {/* 2-Column Check-in Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Badge Scanner */}
        <div className="bg-white border border-[#e3e7ef] rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#161e2e]">
            <ShieldCheck className="w-4 h-4 text-[#0b1f3f]" />
            Contrôle Badge Étudiant (Guérite Principale)
          </div>
          <form onSubmit={handleBadgeCheckIn} className="flex items-center gap-2">
            <div className="relative flex-1">
              <QrCode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={badgeInput}
                onChange={(e) => setBadgeInput(e.target.value)}
                placeholder="Scanner ou saisir matricule (ex: ISCOM-PN-26-001)"
                className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-[#eab33a]" />
              Contrôler & Entrer
            </button>
          </form>

          {lastCheck && (
            <div
              className={`p-3 rounded-lg border text-xs ${
                lastCheck.status === 'Autorisé'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : lastCheck.status === 'Alerte Scolarité'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <p className="font-bold">
                {lastCheck.status} — {lastCheck.name}
              </p>
              <p className="mt-0.5">{lastCheck.detail}</p>
            </div>
          )}
        </div>

        {/* Visitor Registration */}
        <div className="bg-white border border-[#e3e7ef] rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#161e2e]">
            <UserPlus className="w-4 h-4 text-[#c58b12]" />
            Enregistrement Visiteur / Partenaire
          </div>
          <form onSubmit={handleVisitorSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              required
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              placeholder="Nom complet *"
              className="px-3 py-2 text-xs border border-[#e3e7ef] rounded-lg"
            />
            <input
              type="text"
              value={visitorDoc}
              onChange={(e) => setVisitorDoc(e.target.value)}
              placeholder="N° CNI / Passeport"
              className="px-3 py-2 text-xs font-mono border border-[#e3e7ef] rounded-lg"
            />
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={visitorMotif}
                onChange={(e) => setVisitorMotif(e.target.value)}
                placeholder="Motif visite *"
                className="flex-1 min-w-0 px-3 py-2 text-xs border border-[#e3e7ef] rounded-lg"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold shrink-0 cursor-pointer"
              >
                Entrée
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Live Gate Log Table */}
      <div className="bg-white border border-[#e3e7ef] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e3e7ef] bg-[#f8f9fb] flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#161e2e]">
            Main courante de la Guérite ({logs.length} mouvements)
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {insideCount > 0 && (
              <button
                type="button"
                onClick={onCloseAllGateLogs}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5 text-[#eab33a]" />
                Clôturer les sorties ({insideCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => setPrintLogs(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-semibold text-[#0b1f3f] cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimer registre
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e3e7ef] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Personne</th>
                <th className="py-3 px-4">Référence</th>
                <th className="py-3 px-4">Motif & Campus</th>
                <th className="py-3 px-4">Entrée / Sortie</th>
                <th className="py-3 px-4">Statut Accès</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e7ef]">
              {logs.map((g) => (
                <tr key={g.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <p className="font-medium text-[#161e2e]">{g.nomComplet}</p>
                    <p className="text-xs text-slate-500">{g.typePersonne}</p>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-[#0b1f3f]">{g.reference}</td>
                  <td className="py-3 px-4 text-xs text-slate-700">
                    {g.motif} · {g.campus}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs tabular-nums">
                    <span>Entrée {g.heureEntree}</span>
                    {g.heureSortie && (
                      <span className="text-slate-500"> · Sortie {g.heureSortie}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        g.statutAcces === 'Autorisé'
                          ? 'bg-emerald-50 text-emerald-700'
                          : g.statutAcces === 'Alerte Scolarité'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {g.statutAcces}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {!g.heureSortie ? (
                        <button
                          type="button"
                          onClick={() => onMarkExit(g.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-medium text-[#0b1f3f] cursor-pointer"
                        >
                          <LogOut className="w-3 h-3" />
                          Sortie
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 mr-1">Clôturé</span>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteGateLog(g.id)}
                        aria-label={`Supprimer passage ${g.nomComplet}`}
                        className="p-1.5 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Gate Log */}
      {printLogs && (
        <PrintModal
          title="Registre de Contrôle d’Accès — Guérite Principale"
          subtitle={`Campus : ${campusFilter === 'Tous' ? 'Pointe-Noire & Brazzaville' : campusFilter}`}
          onClose={() => setPrintLogs(false)}
        >
          <div className="space-y-4 text-xs">
            <OfficialDocumentHeader
              campus={campusFilter === 'Tous' ? 'Pointe-Noire & Brazzaville' : campusFilter}
              docTitle="Registre Guérite Principale"
              docRef={`GUE-${new Date().toISOString().slice(0, 10)}`}
            />
            <table className="w-full text-left border-collapse border border-[#e3e7ef]">
              <thead>
                <tr className="bg-[#0b1f3f] text-white text-[11px] uppercase">
                  <th className="py-2 px-3">Personne</th>
                  <th className="py-2 px-3">Référence</th>
                  <th className="py-2 px-3">Motif</th>
                  <th className="py-2 px-3">Entrée</th>
                  <th className="py-2 px-3">Sortie</th>
                  <th className="py-2 px-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e7ef]">
                {logs.map((g) => (
                  <tr key={g.id}>
                    <td className="py-2 px-3 font-medium">
                      {g.nomComplet} ({g.typePersonne})
                    </td>
                    <td className="py-2 px-3 font-mono">{g.reference}</td>
                    <td className="py-2 px-3">{g.motif}</td>
                    <td className="py-2 px-3 font-mono tabular-nums">{g.heureEntree}</td>
                    <td className="py-2 px-3 font-mono tabular-nums">{g.heureSortie ?? '—'}</td>
                    <td className="py-2 px-3">{g.statutAcces}</td>
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
