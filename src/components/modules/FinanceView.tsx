import { Bell, Plus, Printer, Search, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import {
  Campus,
  CerecState,
  Payment,
  PaymentMode,
  PaymentMotif,
} from '../../types/cerec';
import {
  computeStudentFinance,
  formatFCFA,
  getPaymentAcademicYear,
} from '../../utils/lmd';
import { OfficialDocumentHeader, PrintModal } from '../PrintModal';
import { QrCodeSvg } from '../QrCodeSvg';

interface FinanceViewProps {
  state: CerecState;
  campusFilter: Campus | 'Tous';
  onAddPayment: (payment: Payment) => void;
  onDeletePayment: (id: string) => void;
  onNotify: (msg: string) => void;
}

const MOTIFS: PaymentMotif[] = [
  'Inscription',
  'Tranche 1',
  'Tranche 2',
  'Tranche 3',
  'Soutenance',
  'Certificat',
];
const MODES: PaymentMode[] = [
  'Espèces',
  'MTN MoMo',
  'Airtel Money',
  'Virement',
  'Chèque',
];

export function FinanceView({
  state,
  campusFilter,
  onAddPayment,
  onDeletePayment,
  onNotify,
}: FinanceViewProps) {
  const [subTab, setSubTab] = useState<'journal' | 'soldes'>('journal');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [printArrears, setPrintArrears] = useState(false);

  const [form, setForm] = useState<{
    studentId: string;
    montant: number;
    motif: PaymentMotif;
    mode: PaymentMode;
    caissier: string;
    observation: string;
  }>({
    studentId: state.students[0]?.id ?? '',
    montant: 150000,
    motif: 'Tranche 2',
    mode: 'Espèces',
    caissier: 'Mme Clarisse Mavoungou',
    observation: '',
  });

  const activeYear = state.settings.anneeAcademique;

  const payments = state.payments
    .filter((p) => {
      if (getPaymentAcademicYear(p, state.students) !== activeYear) return false;
      if (campusFilter !== 'Tous' && p.campus !== campusFilter) return false;
      if (search.trim()) {
        const st = state.students.find((s) => s.id === p.studentId);
        const q = search.toLowerCase();
        return (
          p.numeroRecu.toLowerCase().includes(q) ||
          (st && `${st.nom} ${st.prenom} ${st.matricule}`.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const students = state.students.filter((s) => {
    if (s.anneeAcademique !== activeYear) return false;
    if (campusFilter !== 'Tous' && s.campus !== campusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return `${s.nom} ${s.prenom} ${s.matricule}`.toLowerCase().includes(q);
    }
    return true;
  });

  const totalCollected = payments.reduce((sum, p) => sum + p.montant, 0);
  const totalArrears = students.reduce(
    (sum, s) => sum + computeStudentFinance(s, state.filieres, state.payments).resteAPayer,
    0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const st = state.students.find((s) => s.id === form.studentId);
    if (!st || form.montant <= 0) return;

    const prefix = st.campus === 'Pointe-Noire' ? 'PN' : 'BZ';
    const nextPayment: Payment = {
      id: `pay-${Date.now()}`,
      numeroRecu: `REC-${prefix}-${st.anneeAcademique.slice(0, 4)}-${String(state.payments.length + 101)}`,
      studentId: st.id,
      montant: Number(form.montant),
      motif: form.motif,
      mode: form.mode,
      date: new Date().toISOString().slice(0, 10),
      anneeAcademique: st.anneeAcademique,
      caissier: form.caissier.trim() || 'Caisse Centrale',
      campus: st.campus,
      observation: form.observation.trim() || undefined,
    };

    onAddPayment(nextPayment);
    setModalOpen(false);
    setReceipt(nextPayment);
  };

  return (
    <div className="space-y-5">
      {/* Financial KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#e3e7ef] rounded-lg p-4">
          <p className="text-xs text-slate-500">Total encaissé (sélection)</p>
          <p className="font-mono text-xl font-bold text-emerald-700 mt-1 tabular-nums">
            {formatFCFA(totalCollected)}
          </p>
        </div>
        <div className="bg-white border border-[#e3e7ef] rounded-lg p-4">
          <p className="text-xs text-slate-500">Reste à recouvrer</p>
          <p className="font-mono text-xl font-bold text-amber-700 mt-1 tabular-nums">
            {formatFCFA(totalArrears)}
          </p>
        </div>
        <div className="bg-white border border-[#e3e7ef] rounded-lg p-4">
          <p className="text-xs text-slate-500">Nombre de reçus émis</p>
          <p className="font-mono text-xl font-bold text-[#0b1f3f] mt-1 tabular-nums">
            {payments.length}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-[#e3e7ef] rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="flex items-center gap-1 p-1 bg-[#f8f9fb] border border-[#e3e7ef] rounded-lg">
            <button
              type="button"
              onClick={() => setSubTab('journal')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                subTab === 'journal'
                  ? 'bg-[#0b1f3f] text-white'
                  : 'text-slate-600 hover:text-[#161e2e]'
              }`}
            >
              Journal des encaissements
            </button>
            <button
              type="button"
              onClick={() => setSubTab('soldes')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                subTab === 'soldes'
                  ? 'bg-[#0b1f3f] text-white'
                  : 'text-slate-600 hover:text-[#161e2e]'
              }`}
            >
              Situation des soldes étudiants
            </button>
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher reçu, matricule, nom..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-[#e3e7ef] rounded-lg"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setPrintArrears(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-semibold text-[#0b1f3f] whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            État recouvrement
          </button>
          <button
            type="button"
            onClick={() => {
              setForm((prev) => ({
                ...prev,
                studentId: students[0]?.id ?? state.students[0]?.id ?? '',
              }));
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nouvel encaissement
          </button>
        </div>
      </div>

      {/* Tables */}
      {subTab === 'journal' ? (
        <div className="bg-white border border-[#e3e7ef] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#f8f9fb] border-b border-[#e3e7ef] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">N° Reçu</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Étudiant</th>
                  <th className="py-3 px-4">Motif & Mode</th>
                  <th className="py-3 px-4 text-right">Montant</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e7ef]">
                {payments.map((p) => {
                  const st = state.students.find((s) => s.id === p.studentId);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#0b1f3f]">
                        {p.numeroRecu}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums">
                        {p.date}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-[#161e2e]">
                          {st ? `${st.nom} ${st.prenom}` : p.studentId}
                        </p>
                        <p className="text-xs text-slate-500">
                          {st?.matricule} · {p.campus}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {p.motif} · {p.mode}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums">
                        {formatFCFA(p.montant)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setReceipt(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-medium text-[#0b1f3f] cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Reçu
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeletePayment(p.id)}
                            aria-label={`Annuler ${p.numeroRecu}`}
                            title="Annuler ce reçu"
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
      ) : (
        <div className="bg-white border border-[#e3e7ef] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#f8f9fb] border-b border-[#e3e7ef] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Matricule</th>
                  <th className="py-3 px-4">Étudiant</th>
                  <th className="py-3 px-4 text-right">Total Dû</th>
                  <th className="py-3 px-4 text-right">Payé</th>
                  <th className="py-3 px-4 text-right">Reste</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e7ef]">
                {students.map((s) => {
                  const fin = computeStudentFinance(s, state.filieres, state.payments);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#0b1f3f]">
                        {s.matricule}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-[#161e2e]">
                          {s.nom} {s.prenom}
                        </p>
                        <p className="text-xs text-slate-500">
                          {s.filiereCode} {s.niveau} · {s.campus}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        {formatFCFA(fin.totalDu)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                        {formatFCFA(fin.totalPaye)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-[#161e2e] tabular-nums">
                        {formatFCFA(fin.resteAPayer)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            fin.statutFinancier === 'Soldé'
                              ? 'bg-emerald-50 text-emerald-700'
                              : fin.statutFinancier === 'Retard critique'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {fin.statutFinancier} ({fin.tauxCouverture}%)
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {fin.resteAPayer > 0 && (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                onNotify(
                                  `Relance préparée pour ${s.tuteurNom} (${s.tuteurTel || s.telephone}) : solde dû ${formatFCFA(fin.resteAPayer)}.`
                                )
                              }
                              title="Relancer le tuteur"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-medium text-[#0b1f3f] cursor-pointer"
                            >
                              <Bell className="w-3 h-3" />
                              Relancer
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  studentId: s.id,
                                  montant: Math.min(150000, fin.resteAPayer),
                                }));
                                setModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded bg-[#0b1f3f] text-white text-xs font-medium cursor-pointer"
                            >
                              Encaisser
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142b]/70 p-4">
          <div className="bg-white border border-[#e3e7ef] rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e3e7ef] bg-[#f8f9fb]">
              <h3 className="text-base font-semibold text-[#161e2e]">
                Enregistrer un encaissement Caisse
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Étudiant concerné
                </label>
                <select
                  value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                >
                  {state.students
                    .filter(
                      (s) =>
                        s.anneeAcademique === activeYear &&
                        (campusFilter === 'Tous' || s.campus === campusFilter)
                    )
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.matricule} — {s.nom} {s.prenom} ({s.filiereCode} {s.niveau} · {s.campus})
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Motif du versement
                  </label>
                  <select
                    value={form.motif}
                    onChange={(e) =>
                      setForm({ ...form, motif: e.target.value as PaymentMotif })
                    }
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                  >
                    {MOTIFS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Mode de règlement
                  </label>
                  <select
                    value={form.mode}
                    onChange={(e) =>
                      setForm({ ...form, mode: e.target.value as PaymentMode })
                    }
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                  >
                    {MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Montant (FCFA) *
                  </label>
                  <input
                    type="number"
                    min={1000}
                    step={500}
                    required
                    value={form.montant}
                    onChange={(e) => setForm({ ...form, montant: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Caissier(ère)
                  </label>
                  <input
                    type="text"
                    value={form.caissier}
                    onChange={(e) => setForm({ ...form, caissier: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Observation (optionnel)
                </label>
                <input
                  type="text"
                  value={form.observation}
                  onChange={(e) => setForm({ ...form, observation: e.target.value })}
                  placeholder="Référence transaction Mobile Money ou bordereau"
                  className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                />
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
                  Valider & Émettre le Reçu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Official Receipt */}
      {receipt && (
        <PrintModal
          title={`Reçu Officiel de Caisse — ${receipt.numeroRecu}`}
          subtitle={`${receipt.campus} · ${receipt.date}`}
          onClose={() => setReceipt(null)}
        >
          {(() => {
            const st = state.students.find((s) => s.id === receipt.studentId);
            const fin = st
              ? computeStudentFinance(st, state.filieres, state.payments)
              : null;
            return (
              <div className="space-y-5 text-xs">
                <OfficialDocumentHeader
                  campus={receipt.campus}
                  docTitle="Reçu de Paiement Officiel"
                  docRef={receipt.numeroRecu}
                />

                <div className="grid grid-cols-2 gap-4 p-4 border border-[#e3e7ef] rounded-lg">
                  <div>
                    <p className="text-slate-500">Reçu de</p>
                    <p className="font-bold text-sm text-[#161e2e] mt-0.5">
                      {st ? `${st.nom} ${st.prenom}` : receipt.studentId}
                    </p>
                    <p className="font-mono text-slate-600 mt-0.5">
                      {st?.matricule} · {st?.filiereCode} {st?.niveau}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500">Montant encaissé</p>
                    <p className="font-mono text-lg font-bold text-emerald-700 tabular-nums mt-0.5">
                      {formatFCFA(receipt.montant)}
                    </p>
                    <p className="text-slate-600 mt-0.5">
                      Mode : <strong>{receipt.mode}</strong>
                    </p>
                  </div>
                </div>

                <div className="p-4 border border-[#e3e7ef] rounded-lg bg-[#f8f9fb] flex items-center justify-between">
                  <div className="space-y-1">
                    <p>
                      Motif du règlement : <strong>{receipt.motif}</strong>
                    </p>
                    <p>Date d’opération : {receipt.date}</p>
                    {fin && (
                      <p className="font-mono tabular-nums">
                        Cumul payé : {formatFCFA(fin.totalPaye)} · Solde restant :{' '}
                        <strong>{formatFCFA(fin.resteAPayer)}</strong>
                      </p>
                    )}
                    {receipt.observation && (
                      <p className="text-slate-600">Obs : {receipt.observation}</p>
                    )}
                  </div>
                  <QrCodeSvg
                    value={`CEREC-ISCOM|RECU|${receipt.numeroRecu}|${st?.matricule ?? receipt.studentId}|${receipt.montant}FCFA|${receipt.motif}|${receipt.date}`}
                    size={76}
                  />
                </div>

                <div className="flex items-center justify-between pt-6">
                  <p className="text-slate-500">Caissier(ère) : {receipt.caissier}</p>
                  <div className="text-center w-52">
                    <p className="font-semibold text-slate-700">Cachet & Signature Caisse</p>
                    <div className="h-12 border-b border-dashed border-slate-300" />
                  </div>
                </div>
              </div>
            );
          })()}
        </PrintModal>
      )}

      {/* Printable Arrears / Recovery State */}
      {printArrears && (
        <PrintModal
          title="État des Recouvrements & Soldes Étudiants"
          subtitle={`Campus : ${campusFilter === 'Tous' ? 'Pointe-Noire & Brazzaville' : campusFilter}`}
          onClose={() => setPrintArrears(false)}
        >
          <div className="space-y-4 text-xs">
            <OfficialDocumentHeader
              campus={campusFilter === 'Tous' ? 'Pointe-Noire & Brazzaville' : campusFilter}
              docTitle="État des Recouvrements"
              docRef={`REC-ETAT-${new Date().toISOString().slice(0, 10)}`}
            />
            <table className="w-full text-left border-collapse border border-[#e3e7ef]">
              <thead>
                <tr className="bg-[#0b1f3f] text-white text-[11px] uppercase">
                  <th className="py-2 px-3">Matricule</th>
                  <th className="py-2 px-3">Étudiant</th>
                  <th className="py-2 px-3 text-right">Dû</th>
                  <th className="py-2 px-3 text-right">Payé</th>
                  <th className="py-2 px-3 text-right">Reste</th>
                  <th className="py-2 px-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e7ef]">
                {students.map((s) => {
                  const fin = computeStudentFinance(s, state.filieres, state.payments);
                  return (
                    <tr key={s.id}>
                      <td className="py-2 px-3 font-mono">{s.matricule}</td>
                      <td className="py-2 px-3 font-medium">
                        {s.nom} {s.prenom} ({s.filiereCode} {s.niveau})
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {formatFCFA(fin.totalDu)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {formatFCFA(fin.totalPaye)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold tabular-nums">
                        {formatFCFA(fin.resteAPayer)}
                      </td>
                      <td className="py-2 px-3">{fin.statutFinancier}</td>
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
