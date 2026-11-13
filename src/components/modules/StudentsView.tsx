import {
  CreditCard,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  Plus,
  QrCode,
  Receipt,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import {
  Campus,
  CerecState,
  Niveau,
  Payment,
  PaymentMode,
  PaymentMotif,
  Student,
} from '../../types/cerec';
import {
  computeStudentFinance,
  formatFCFA,
  getAvailableAcademicYears,
  isTrimesterCode,
  ueMatchesStudent,
} from '../../utils/lmd';
import { downloadBulletinPdf } from '../../utils/bulletinPdf';
import {
  downloadBatchCartesPvcPdf,
  downloadCartePvcPdf,
} from '../../utils/cartePvcPdf';
import {
  downloadRecuInscriptionPdf,
  downloadRecuPaiementPdf,
  getInscriptionReceiptRef,
} from '../../utils/recuInscriptionPdf';
import { BulletinReleve } from '../BulletinReleve';
import { CarteEtudiantPvc } from '../CarteEtudiantPvc';
import { OfficialDocumentHeader, PrintModal } from '../PrintModal';
import { QrCodeSvg } from '../QrCodeSvg';

interface StudentsViewProps {
  state: CerecState;
  campusFilter: Campus | 'Tous';
  canManageStudents?: boolean;
  canCollectPayments?: boolean;
  canViewGrades?: boolean;
  onAddStudent: (student: Student) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onAddPayment: (payment: Payment) => void;
  onNotify?: (msg: string) => void;
}

const NIVEAUX: Niveau[] = ['L1', 'L2', 'L3', 'M1', 'M2', 'FQ'];

export function StudentsView({
  state,
  campusFilter,
  canManageStudents = true,
  canCollectPayments = true,
  canViewGrades = true,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onAddPayment,
  onNotify,
}: StudentsViewProps) {
  const [search, setSearch] = useState('');
  const [filiereFilter, setFiliereFilter] = useState('Toutes');
  const [niveauFilter, setNiveauFilter] = useState('Tous');
  const [anneeFilter, setAnneeFilter] = useState('Toutes');
  const [financeFilter, setFinanceFilter] = useState('Tous');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [printDoc, setPrintDoc] = useState<{
    type: 'card' | 'fiche' | 'bulletin' | 'recu';
    student: Student;
  } | null>(null);
  const [bulletinSemestre, setBulletinSemestre] = useState<string>('Tous');
  const [cardSide, setCardSide] = useState<'both' | 'recto' | 'verso'>('both');

  // Quick payment modal from student row
  const [payStudent, setPayStudent] = useState<Student | null>(null);
  const [payAmount, setPayAmount] = useState(150000);
  const [payMotif, setPayMotif] = useState<PaymentMotif>('Tranche 2');
  const [payMode, setPayMode] = useState<PaymentMode>('Espèces');

  const [form, setForm] = useState<Partial<Student>>({
    campus: campusFilter === 'Tous' ? 'Pointe-Noire' : campusFilter,
    filiereCode: 'GCF',
    option: state.filieres[0]?.options?.[0] ?? '',
    niveau: 'L1',
    sexe: 'M',
    boursePct: 0,
    statutDossier: 'Complet',
    parentLien: 'Père',
    garantLien: 'Parent / Tuteur',
  });
  const [garantSameAsParent, setGarantSameAsParent] = useState(false);

  const academicYears = getAvailableAcademicYears(state);

  const filtered = state.students.filter((s) => {
    if (campusFilter !== 'Tous' && s.campus !== campusFilter) return false;
    if (filiereFilter !== 'Toutes' && s.filiereCode !== filiereFilter) return false;
    if (niveauFilter !== 'Tous' && s.niveau !== niveauFilter) return false;
    if (anneeFilter !== 'Toutes' && s.anneeAcademique !== anneeFilter) return false;
    if (financeFilter !== 'Tous') {
      const fin = computeStudentFinance(s, state.filieres, state.payments);
      if (fin.statutFinancier !== financeFilter) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.nom.toLowerCase().includes(q) ||
        s.prenom.toLowerCase().includes(q) ||
        s.matricule.toLowerCase().includes(q) ||
        s.telephone.toLowerCase().includes(q) ||
        (s.option ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setGarantSameAsParent(false);
    const defaultCampus: Campus = campusFilter === 'Tous' ? 'Pointe-Noire' : campusFilter;
    const prefix = defaultCampus === 'Pointe-Noire' ? 'PN' : 'BZ';
    const yrSuffix = state.settings.anneeAcademique.slice(-2) || '26';
    const nextNum = String(state.students.length + 1).padStart(3, '0');
    const defaultFil = state.filieres[0];
    setForm({
      matricule: `ISCOM-${prefix}-${yrSuffix}-${nextNum}`,
      nom: '',
      prenom: '',
      sexe: 'M',
      dateNaissance: '2004-01-15',
      lieuNaissance: defaultCampus,
      telephone: '+242 06 ',
      email: '',
      tuteurNom: '',
      tuteurTel: '+242 06 ',
      parentLien: 'Père',
      parentProfession: '',
      parentAdresse: '',
      parentEmail: '',
      garantNom: '',
      garantLien: 'Parent / Tuteur',
      garantTel: '+242 06 ',
      garantProfession: '',
      garantAdresse: '',
      garantCni: '',
      campus: defaultCampus,
      filiereCode: defaultFil?.code ?? 'GCF',
      option: defaultFil?.options?.[0] ?? '',
      niveau: 'L1',
      anneeAcademique: state.settings.anneeAcademique,
      boursePct: 0,
      statutDossier: 'Complet',
      dateInscription: new Date().toISOString().slice(0, 10),
    });
    setModalOpen(true);
  };

  const openEdit = (st: Student) => {
    setEditing(st);
    const fil = state.filieres.find((f) => f.code === st.filiereCode);
    const isSame =
      Boolean(st.garantNom) &&
      st.garantNom === st.tuteurNom &&
      (st.garantTel ?? '') === st.tuteurTel;
    setGarantSameAsParent(isSame);
    setForm({
      ...st,
      option: st.option || fil?.options?.[0] || '',
      parentLien: st.parentLien || 'Tuteur légal',
      garantLien: st.garantLien || 'Parent / Tuteur',
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom?.trim() || !form.prenom?.trim()) return;
    const selectedFil = state.filieres.find((f) => f.code === (form.filiereCode || 'GCF'));

    const parentName = form.tuteurNom?.trim() || 'Non renseigné';
    const parentPhone = form.tuteurTel?.trim() || '';
    const resolvedGarantNom = garantSameAsParent
      ? parentName
      : form.garantNom?.trim() || undefined;
    const resolvedGarantTel = garantSameAsParent
      ? parentPhone
      : form.garantTel?.trim() || undefined;
    const resolvedGarantProfession = garantSameAsParent
      ? form.parentProfession?.trim() || undefined
      : form.garantProfession?.trim() || undefined;
    const resolvedGarantAdresse = garantSameAsParent
      ? form.parentAdresse?.trim() || undefined
      : form.garantAdresse?.trim() || undefined;
    const resolvedGarantLien = garantSameAsParent
      ? 'Parent / Tuteur'
      : form.garantLien?.trim() || undefined;

    const payload: Student = {
      id: editing ? editing.id : `st-${Date.now()}`,
      matricule: form.matricule?.trim() || `ISCOM-26-${Date.now().toString().slice(-4)}`,
      nom: form.nom.trim().toUpperCase(),
      prenom: form.prenom.trim(),
      sexe: (form.sexe as 'M' | 'F') || 'M',
      dateNaissance: form.dateNaissance || '2004-01-01',
      lieuNaissance: form.lieuNaissance?.trim() || 'Pointe-Noire',
      telephone: form.telephone?.trim() || '',
      email:
        form.email?.trim() ||
        `${form.prenom.trim().toLowerCase()}.${form.nom.trim().toLowerCase()}@etudiant.cerec-iscom.cg`,
      tuteurNom: parentName,
      tuteurTel: parentPhone,
      parentLien: form.parentLien?.trim() || undefined,
      parentProfession: form.parentProfession?.trim() || undefined,
      parentAdresse: form.parentAdresse?.trim() || undefined,
      parentEmail: form.parentEmail?.trim() || undefined,
      garantNom: resolvedGarantNom,
      garantLien: resolvedGarantNom ? resolvedGarantLien : undefined,
      garantTel: resolvedGarantNom ? resolvedGarantTel : undefined,
      garantProfession: resolvedGarantNom ? resolvedGarantProfession : undefined,
      garantAdresse: resolvedGarantNom ? resolvedGarantAdresse : undefined,
      garantCni: form.garantCni?.trim() || undefined,
      campus: (form.campus as Campus) || 'Pointe-Noire',
      filiereCode: form.filiereCode || 'GCF',
      option: form.option?.trim() || selectedFil?.options?.[0] || undefined,
      niveau: (form.niveau as Niveau) || 'L1',
      anneeAcademique: form.anneeAcademique?.trim() || state.settings.anneeAcademique,
      boursePct: Number(form.boursePct) || 0,
      statutDossier:
        (form.statutDossier as Student['statutDossier']) || 'Complet',
      dateInscription: form.dateInscription || new Date().toISOString().slice(0, 10),
      photoUrl: form.photoUrl,
    };

    if (editing) {
      onUpdateStudent(payload);
      setModalOpen(false);
    } else {
      onAddStudent(payload);
      setModalOpen(false);
      setPrintDoc({ type: 'recu', student: payload });
      void downloadRecuInscriptionPdf(payload, state).then((fileName) => {
        onNotify?.(`Reçu d'inscription PDF téléchargé : ${fileName}`);
      });
    }
  };

  const handlePhotoFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    targetStudent?: Student
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
      if (!dataUrl) return;
      if (targetStudent) {
        const updated = { ...targetStudent, photoUrl: dataUrl };
        onUpdateStudent(updated);
        setPrintDoc({ type: 'card', student: updated });
      } else {
        setForm((prev) => ({ ...prev, photoUrl: dataUrl }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQuickPaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payStudent || payAmount <= 0) return;
    const prefix = payStudent.campus === 'Pointe-Noire' ? 'PN' : 'BZ';
    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      numeroRecu: `REC-${prefix}-2026-${String(state.payments.length + 101)}`,
      studentId: payStudent.id,
      montant: Number(payAmount),
      motif: payMotif,
      mode: payMode,
      date: new Date().toISOString().slice(0, 10),
      anneeAcademique: payStudent.anneeAcademique,
      caissier: 'Caisse Centrale',
      campus: payStudent.campus,
    };
    onAddPayment(newPayment);
    const targetStudent = payStudent;
    setPayStudent(null);
    void downloadRecuPaiementPdf(newPayment, {
      ...state,
      payments: [newPayment, ...state.payments],
    }).then((fileName) => {
      onNotify?.(`Reçu de paiement PDF téléchargé : ${fileName}`);
    });
    setPrintDoc({ type: 'recu', student: targetStudent });
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white border border-[#e3e7ef] rounded-lg p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2.5 flex-1">
          <div className="relative sm:col-span-2 lg:flex-1 lg:min-w-[200px] lg:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, matricule, téléphone..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-[#e3e7ef] rounded-lg focus:outline-none focus:border-[#0e2447]"
            />
          </div>

          <select
            value={filiereFilter}
            onChange={(e) => setFiliereFilter(e.target.value)}
            aria-label="Filtrer par filière"
            className="w-full lg:w-auto px-3 py-2 text-xs font-medium border border-[#e3e7ef] rounded-lg bg-white text-[#161e2e]"
          >
            <option value="Toutes">Toutes les filières</option>
            {state.filieres.map((f) => (
              <option key={f.id} value={f.code}>
                {f.code} — {f.nom}
              </option>
            ))}
          </select>

          <select
            value={niveauFilter}
            onChange={(e) => setNiveauFilter(e.target.value)}
            aria-label="Filtrer par niveau"
            className="w-full lg:w-auto px-3 py-2 text-xs font-medium border border-[#e3e7ef] rounded-lg bg-white text-[#161e2e]"
          >
            <option value="Tous">Tous niveaux</option>
            {NIVEAUX.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <select
            value={anneeFilter}
            onChange={(e) => setAnneeFilter(e.target.value)}
            aria-label="Filtrer par année académique"
            className="w-full lg:w-auto px-3 py-2 text-xs font-medium border border-[#e3e7ef] rounded-lg bg-white text-[#161e2e]"
          >
            <option value="Toutes">Toutes années</option>
            {academicYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={financeFilter}
            onChange={(e) => setFinanceFilter(e.target.value)}
            aria-label="Filtrer par statut financier"
            className="w-full lg:w-auto px-3 py-2 text-xs font-medium border border-[#e3e7ef] rounded-lg bg-white text-[#161e2e]"
          >
            <option value="Tous">Tous statuts financiers</option>
            <option value="Soldé">Soldé</option>
            <option value="En cours">En cours</option>
            <option value="Retard critique">Retard critique</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={async () => {
              const label =
                filiereFilter !== 'Toutes'
                  ? `${filiereFilter}_${niveauFilter !== 'Tous' ? niveauFilter : 'Tous'}`
                  : 'Etudiants';
              const fileName = await downloadBatchCartesPvcPdf(
                filtered,
                state.filieres,
                label
              );
              onNotify?.(`Cartes PVC PDF téléchargées : ${fileName}`);
            }}
            title="Télécharger toutes les cartes PVC filtrées en PDF"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] disabled:opacity-50 text-[#07142b] text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Cartes PVC PDF ({filtered.length})
          </button>
          {canManageStudents && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#eab33a]" />
              Nouvelle inscription
            </button>
          )}
        </div>
      </div>

      {/* Mobile Cards & Desktop Table */}
      <div className="bg-white border border-[#e3e7ef] rounded-lg overflow-hidden">
        <div className="md:hidden divide-y divide-[#e3e7ef]">
          {filtered.map((s) => {
            const fin = computeStudentFinance(s, state.filieres, state.payments);
            return (
              <div key={s.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-[#0b1f3f]">
                      {s.matricule} · {s.anneeAcademique}
                    </p>
                    <p className="font-semibold text-sm text-[#161e2e] truncate">
                      {s.nom} {s.prenom}
                    </p>
                    <p className="text-xs text-slate-500">
                      {s.filiereCode} · {s.niveau}
                      {s.option ? ` · ${s.option}` : ''} · {s.campus}
                    </p>
                  </div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium shrink-0 ${
                      s.statutDossier === 'Complet'
                        ? 'bg-emerald-50 text-emerald-700'
                        : s.statutDossier === 'En attente'
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {s.statutDossier}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 bg-[#f8f9fb] border border-[#e3e7ef] rounded-lg px-3 py-2 text-xs">
                  <span className="text-slate-500">{s.telephone || 'Tél. non renseigné'}</span>
                  <div className="text-right font-mono tabular-nums">
                    <span className="font-semibold text-[#161e2e]">
                      {formatFCFA(fin.totalPaye)}
                    </span>
                    <span
                      className={`ml-1.5 text-[11px] ${
                        fin.statutFinancier === 'Soldé'
                          ? 'text-emerald-700'
                          : fin.statutFinancier === 'Retard critique'
                          ? 'text-red-700'
                          : 'text-amber-700'
                      }`}
                    >
                      ({fin.tauxCouverture}%)
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPrintDoc({ type: 'card', student: s })}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#e3e7ef] text-xs font-medium text-[#0b1f3f] cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    Carte
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const fil = state.filieres.find((f) => f.code === s.filiereCode);
                      const fileName = await downloadCartePvcPdf(s, fil, 'both');
                      onNotify?.(`Carte PVC PDF téléchargée : ${fileName}`);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#e0a526] text-[#07142b] text-xs font-bold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    PVC
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintDoc({ type: 'fiche', student: s })}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#e3e7ef] text-xs font-medium text-[#0b1f3f] cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Fiche
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintDoc({ type: 'recu', student: s })}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#e3e7ef] text-xs font-medium text-[#0b1f3f] cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    Reçu
                  </button>
                  {canViewGrades && (
                    <button
                      type="button"
                      onClick={() => {
                        setBulletinSemestre('Tous');
                        setPrintDoc({ type: 'bulletin', student: s });
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#e3e7ef] text-xs font-medium text-[#0b1f3f] cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Relevé
                    </button>
                  )}
                  {canCollectPayments && fin.resteAPayer > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPayStudent(s);
                        setPayAmount(Math.min(150000, fin.resteAPayer));
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#e0a526] text-[#07142b] text-xs font-bold cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Payer
                    </button>
                  )}
                  {canManageStudents && (
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        aria-label={`Modifier ${s.nom}`}
                        className="p-1.5 rounded text-slate-500 hover:text-[#0b1f3f] hover:bg-slate-100 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteStudent(s.id)}
                        aria-label={`Supprimer ${s.nom}`}
                        className="p-1.5 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-10 px-4 text-center text-sm text-slate-500">
              Aucun étudiant ne correspond aux critères sélectionnés.
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8f9fb] border-b border-[#e3e7ef] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Matricule</th>
                <th className="py-3 px-4">Étudiant</th>
                <th className="py-3 px-4">Campus & Filière</th>
                <th className="py-3 px-4">Dossier</th>
                <th className="py-3 px-4 text-right">Scolarité payée</th>
                <th className="py-3 px-4 text-right">Documents & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e7ef] text-sm">
              {filtered.map((s) => {
                const fin = computeStudentFinance(s, state.filieres, state.payments);
                return (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-[#0b1f3f] tabular-nums whitespace-nowrap">
                      <p>{s.matricule}</p>
                      <p className="text-[11px] font-normal text-slate-500">{s.anneeAcademique}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#161e2e]">
                        {s.nom} {s.prenom}
                      </p>
                      <p className="text-xs text-slate-500">{s.telephone}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-[#161e2e]">
                        {s.filiereCode} · {s.niveau}
                      </p>
                      <p className="text-xs text-slate-500">
                        {s.option ? `${s.option} · ` : ''}
                        {s.campus}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          s.statutDossier === 'Complet'
                            ? 'bg-emerald-50 text-emerald-700'
                            : s.statutDossier === 'En attente'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {s.statutDossier}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <p className="text-xs font-semibold text-[#161e2e]">
                        {formatFCFA(fin.totalPaye)}
                      </p>
                      <p
                        className={`text-[11px] ${
                          fin.statutFinancier === 'Soldé'
                            ? 'text-emerald-700'
                            : fin.statutFinancier === 'Retard critique'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {fin.tauxCouverture}% · {fin.statutFinancier}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPrintDoc({ type: 'card', student: s })}
                          title="Aperçu Carte Étudiant PVC avec QR Code"
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-medium text-[#0b1f3f] cursor-pointer whitespace-nowrap"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          Carte
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const fil = state.filieres.find(
                              (f) => f.code === s.filiereCode
                            );
                            const fileName = await downloadCartePvcPdf(s, fil, 'both');
                            onNotify?.(`Carte PVC PDF téléchargée : ${fileName}`);
                          }}
                          title="Télécharger la carte PVC (Recto & Verso) en PDF"
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold cursor-pointer whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PVC
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintDoc({ type: 'fiche', student: s })}
                          title="Fiche d'inscription A4"
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-medium text-[#0b1f3f] cursor-pointer whitespace-nowrap"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Fiche
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintDoc({ type: 'recu', student: s })}
                          title="Reçu d'inscription officiel"
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-medium text-[#0b1f3f] cursor-pointer whitespace-nowrap"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          Reçu
                        </button>
                        {canViewGrades && (
                          <button
                            type="button"
                            onClick={() => {
                              setBulletinSemestre('Tous');
                              setPrintDoc({ type: 'bulletin', student: s });
                            }}
                            title="Imprimer le relevé de notes LMD"
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-medium text-[#0b1f3f] cursor-pointer whitespace-nowrap"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            Relevé
                          </button>
                        )}
                        {canCollectPayments && fin.resteAPayer > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPayStudent(s);
                              setPayAmount(Math.min(150000, fin.resteAPayer));
                            }}
                            title="Encaisser un versement"
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold cursor-pointer whitespace-nowrap"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            Payer
                          </button>
                        )}
                        {canManageStudents && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(s)}
                              aria-label={`Modifier ${s.nom}`}
                              className="p-1.5 rounded text-slate-500 hover:text-[#0b1f3f] hover:bg-slate-100 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteStudent(s.id)}
                              aria-label={`Supprimer ${s.nom}`}
                              className="p-1.5 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                    Aucun étudiant ne correspond aux critères sélectionnés.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Payment Modal */}
      {canCollectPayments && payStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142b]/70 p-3 sm:p-4">
          <div className="bg-white border border-[#e3e7ef] rounded-xl w-full max-w-md shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#e3e7ef] bg-[#f8f9fb] shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[#161e2e] truncate">
                  Encaissement rapide — {payStudent.nom} {payStudent.prenom}
                </h3>
                <p className="text-xs font-mono text-slate-500">{payStudent.matricule}</p>
              </div>
              <button
                type="button"
                onClick={() => setPayStudent(null)}
                className="p-1 text-slate-500 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleQuickPaySubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Montant (FCFA)
                </label>
                <input
                  type="number"
                  min={1000}
                  step={500}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Motif</label>
                  <select
                    value={payMotif}
                    onChange={(e) => setPayMotif(e.target.value as PaymentMotif)}
                    className="w-full px-3 py-2 text-xs border border-[#e3e7ef] rounded-lg bg-white"
                  >
                    {(['Inscription', 'Tranche 1', 'Tranche 2', 'Tranche 3', 'Soutenance', 'Certificat'] as PaymentMotif[]).map(
                      (m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Mode</label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value as PaymentMode)}
                    className="w-full px-3 py-2 text-xs border border-[#e3e7ef] rounded-lg bg-white"
                  >
                    {(['Espèces', 'MTN MoMo', 'Airtel Money', 'Virement', 'Chèque'] as PaymentMode[]).map(
                      (m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-[#e3e7ef]">
                <button
                  type="button"
                  onClick={() => setPayStudent(null)}
                  className="px-4 py-2 rounded-lg border border-[#e3e7ef] text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0b1f3f] text-white text-xs font-semibold cursor-pointer"
                >
                  Valider l’encaissement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {canManageStudents && modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142b]/70 p-3 sm:p-4">
          <div className="bg-white border border-[#e3e7ef] rounded-xl w-full max-w-3xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#e3e7ef] bg-[#f8f9fb] shrink-0">
              <h3 className="text-base font-semibold text-[#161e2e]">
                {editing ? 'Modifier le dossier étudiant' : 'Nouvelle inscription CEREC-ISCOM'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto">
              {/* Section 1 : Identité & Cursus LMD */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#0b1f3f] border-b border-[#e3e7ef] pb-1.5">
                  1. Identité & Cursus LMD de l’étudiant
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Matricule
                    </label>
                    <input
                      type="text"
                      required
                      value={form.matricule || ''}
                      onChange={(e) => setForm({ ...form, matricule: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Nom *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.nom || ''}
                      onChange={(e) => setForm({ ...form, nom: e.target.value })}
                      placeholder="MBOUNGOU"
                      className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Prénom *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.prenom || ''}
                      onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                      placeholder="Précieux"
                      className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Sexe
                    </label>
                    <select
                      value={form.sexe || 'M'}
                      onChange={(e) =>
                        setForm({ ...form, sexe: e.target.value as 'M' | 'F' })
                      }
                      className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                    >
                      <option value="M">Masculin (M)</option>
                      <option value="F">Féminin (F)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Campus
                    </label>
                    <select
                      value={form.campus}
                      onChange={(e) => setForm({ ...form, campus: e.target.value as Campus })}
                      className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                    >
                      <option value="Pointe-Noire">Pointe-Noire</option>
                      <option value="Brazzaville">Brazzaville</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Filière
                    </label>
                    <select
                      value={form.filiereCode}
                      onChange={(e) => {
                        const nextCode = e.target.value;
                        const nextFil = state.filieres.find((f) => f.code === nextCode);
                        setForm({
                          ...form,
                          filiereCode: nextCode,
                          option: nextFil?.options?.[0] ?? '',
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
                      Option
                    </label>
                    <select
                      value={form.option || ''}
                      onChange={(e) => setForm({ ...form, option: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                    >
                      {Array.from(
                        new Set([
                          ...(state.filieres.find((f) => f.code === form.filiereCode)?.options ?? []),
                          ...(form.option ? [form.option] : []),
                        ])
                      ).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Niveau
                    </label>
                    <select
                      value={form.niveau}
                      onChange={(e) => setForm({ ...form, niveau: e.target.value as Niveau })}
                      className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                    >
                      {NIVEAUX.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Téléphone étudiant
                    </label>
                    <input
                      type="text"
                      value={form.telephone || ''}
                      onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                      placeholder="+242 06 ..."
                      className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Email étudiant
                    </label>
                    <input
                      type="email"
                      value={form.email || ''}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="nom@etudiant.cerec-iscom.cg"
                      className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Date de naissance
                    </label>
                    <input
                      type="date"
                      value={form.dateNaissance || ''}
                      onChange={(e) => setForm({ ...form, dateNaissance: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Lieu de naissance
                    </label>
                    <input
                      type="text"
                      value={form.lieuNaissance || ''}
                      onChange={(e) => setForm({ ...form, lieuNaissance: e.target.value })}
                      placeholder="Pointe-Noire"
                      className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Année académique
                    </label>
                    <input
                      type="text"
                      value={form.anneeAcademique || state.settings.anneeAcademique}
                      onChange={(e) => setForm({ ...form, anneeAcademique: e.target.value })}
                      placeholder="2025-2026"
                      className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Bourse / Réduction (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.boursePct ?? 0}
                      onChange={(e) => setForm({ ...form, boursePct: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Statut du dossier
                    </label>
                    <select
                      value={form.statutDossier}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          statutDossier: e.target.value as Student['statutDossier'],
                        })
                      }
                      className="w-full px-3 py-2 text-sm border border-[#e3e7ef] rounded-lg bg-white"
                    >
                      <option value="Complet">Complet</option>
                      <option value="En attente">En attente</option>
                      <option value="Suspendu">Suspendu</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2 : Formulaire Parent / Tuteur légal */}
              <div className="bg-[#f8f9fb] border border-[#e3e7ef] rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-[#e3e7ef] pb-2">
                  <UserCheck className="w-4 h-4 text-[#0b1f3f]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#0b1f3f]">
                    2. Formulaire Parent / Tuteur légal
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Nom complet du Parent / Tuteur *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.tuteurNom || ''}
                      onChange={(e) => setForm({ ...form, tuteurNom: e.target.value })}
                      placeholder="M. Jean-Claude Mboungou"
                      className="w-full px-3 py-2 text-sm bg-white border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Lien de parenté
                    </label>
                    <select
                      value={form.parentLien || 'Père'}
                      onChange={(e) => setForm({ ...form, parentLien: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-white border border-[#e3e7ef] rounded-lg"
                    >
                      <option value="Père">Père</option>
                      <option value="Mère">Mère</option>
                      <option value="Tuteur légal">Tuteur légal</option>
                      <option value="Frère / Sœur">Frère / Sœur</option>
                      <option value="Oncle / Tante">Oncle / Tante</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Téléphone du Parent *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.tuteurTel || ''}
                      onChange={(e) => setForm({ ...form, tuteurTel: e.target.value })}
                      placeholder="+242 05 534 11 02"
                      className="w-full px-3 py-2 text-sm bg-white border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Profession du Parent
                    </label>
                    <input
                      type="text"
                      value={form.parentProfession || ''}
                      onChange={(e) => setForm({ ...form, parentProfession: e.target.value })}
                      placeholder="Chef de chantier, Commerçant..."
                      className="w-full px-3 py-2 text-sm bg-white border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Email du Parent
                    </label>
                    <input
                      type="email"
                      value={form.parentEmail || ''}
                      onChange={(e) => setForm({ ...form, parentEmail: e.target.value })}
                      placeholder="parent@exemple.cg"
                      className="w-full px-3 py-2 text-sm bg-white border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Adresse / Quartier
                    </label>
                    <input
                      type="text"
                      value={form.parentAdresse || ''}
                      onChange={(e) => setForm({ ...form, parentAdresse: e.target.value })}
                      placeholder="Loandjili, Pointe-Noire"
                      className="w-full px-3 py-2 text-sm bg-white border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3 : Formulaire Garant (Financier & Moral) */}
              <div className="bg-[#f8f9fb] border border-[#e3e7ef] rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e3e7ef] pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#c58b12]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#0b1f3f]">
                      3. Formulaire Garant (Financier & Moral)
                    </h4>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0b1f3f] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={garantSameAsParent}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setGarantSameAsParent(checked);
                        if (checked) {
                          setForm((prev) => ({
                            ...prev,
                            garantNom: prev.tuteurNom || '',
                            garantLien: 'Parent / Tuteur',
                            garantTel: prev.tuteurTel || '',
                            garantProfession: prev.parentProfession || '',
                            garantAdresse: prev.parentAdresse || '',
                          }));
                        }
                      }}
                      className="rounded border-slate-300 text-[#0b1f3f] focus:ring-[#0b1f3f]"
                    />
                    Identique au Parent / Tuteur
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Nom complet du Garant
                    </label>
                    <input
                      type="text"
                      disabled={garantSameAsParent}
                      value={garantSameAsParent ? form.tuteurNom || '' : form.garantNom || ''}
                      onChange={(e) => setForm({ ...form, garantNom: e.target.value })}
                      placeholder="Nom & Prénom du garant ou organisme"
                      className="w-full px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-600 border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Qualité / Lien avec l’étudiant
                    </label>
                    <select
                      disabled={garantSameAsParent}
                      value={
                        garantSameAsParent
                          ? 'Parent / Tuteur'
                          : form.garantLien || 'Parent / Tuteur'
                      }
                      onChange={(e) => setForm({ ...form, garantLien: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-600 border border-[#e3e7ef] rounded-lg"
                    >
                      <option value="Parent / Tuteur">Parent / Tuteur</option>
                      <option value="Parrain / Sponsor">Parrain / Sponsor</option>
                      <option value="Employeur / Entreprise">Employeur / Entreprise</option>
                      <option value="Organisme boursier">Organisme boursier</option>
                      <option value="Tuteur financier">Tuteur financier</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Téléphone du Garant
                    </label>
                    <input
                      type="text"
                      disabled={garantSameAsParent}
                      value={garantSameAsParent ? form.tuteurTel || '' : form.garantTel || ''}
                      onChange={(e) => setForm({ ...form, garantTel: e.target.value })}
                      placeholder="+242 06 ..."
                      className="w-full px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-600 border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Profession / Société du Garant
                    </label>
                    <input
                      type="text"
                      disabled={garantSameAsParent}
                      value={
                        garantSameAsParent
                          ? form.parentProfession || ''
                          : form.garantProfession || ''
                      }
                      onChange={(e) => setForm({ ...form, garantProfession: e.target.value })}
                      placeholder="Entreprise ou profession"
                      className="w-full px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-600 border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      N° CNI / Passeport / NIU
                    </label>
                    <input
                      type="text"
                      value={form.garantCni || ''}
                      onChange={(e) => setForm({ ...form, garantCni: e.target.value })}
                      placeholder="CNI-CG-..."
                      className="w-full px-3 py-2 text-sm font-mono bg-white border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Adresse du Garant
                    </label>
                    <input
                      type="text"
                      disabled={garantSameAsParent}
                      value={
                        garantSameAsParent
                          ? form.parentAdresse || ''
                          : form.garantAdresse || ''
                      }
                      onChange={(e) => setForm({ ...form, garantAdresse: e.target.value })}
                      placeholder="Quartier, Ville"
                      className="w-full px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-600 border border-[#e3e7ef] rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pt-1">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-medium text-[#0b1f3f] cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  {form.photoUrl ? 'Changer la photo étudiant' : 'Ajouter une photo (Carte PVC)'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoFile(e)}
                    className="hidden"
                  />
                </label>
                {form.photoUrl && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, photoUrl: undefined })}
                    className="text-xs text-red-700 hover:underline cursor-pointer"
                  >
                    Retirer la photo
                  </button>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e3e7ef]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#e3e7ef] text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold cursor-pointer"
                >
                  {editing ? 'Enregistrer les modifications' : 'Valider l’inscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable PVC Card / A4 Registration Sheet / Bulletin / Reçu d'inscription */}
      {printDoc && (
        <PrintModal
          title={
            printDoc.type === 'card'
              ? `Carte Étudiant PVC — ${printDoc.student.nom} ${printDoc.student.prenom}`
              : printDoc.type === 'bulletin'
              ? `Relevé de notes — ${printDoc.student.nom} ${printDoc.student.prenom}`
              : printDoc.type === 'recu'
              ? `Reçu d'Inscription — ${printDoc.student.nom} ${printDoc.student.prenom}`
              : `Fiche d'Inscription A4 — ${printDoc.student.matricule}`
          }
          subtitle={`Campus de ${printDoc.student.campus} · ${printDoc.student.filiereCode} ${printDoc.student.niveau} · ${printDoc.student.anneeAcademique}`}
          printLabel={
            printDoc.type === 'bulletin'
              ? 'Imprimer'
              : printDoc.type === 'card'
              ? 'Imprimer la carte PVC'
              : printDoc.type === 'recu'
              ? 'Imprimer le reçu'
              : 'Imprimer la fiche A4'
          }
          pdfButtonLabel={
            printDoc.type === 'bulletin'
              ? 'Télécharger le relevé PDF'
              : printDoc.type === 'recu'
              ? 'Télécharger Reçu (PDF)'
              : printDoc.type === 'card'
              ? cardSide === 'both'
                ? 'Télécharger Carte PVC (PDF)'
                : cardSide === 'recto'
                ? 'Télécharger Recto (PDF)'
                : 'Télécharger Verso (PDF)'
              : undefined
          }
          onDownloadPdf={
            printDoc.type === 'bulletin'
              ? async () => {
                  const sem =
                    bulletinSemestre === 'Tous' ? undefined : bulletinSemestre;
                  const fileName = await downloadBulletinPdf(printDoc.student, state, sem);
                  onNotify?.(`Relevé PDF téléchargé : ${fileName}`);
                }
              : printDoc.type === 'recu'
              ? async () => {
                  const fileName = await downloadRecuInscriptionPdf(
                    printDoc.student,
                    state
                  );
                  onNotify?.(`Reçu d'inscription PDF téléchargé : ${fileName}`);
                }
              : printDoc.type === 'card'
              ? async () => {
                  const fil = state.filieres.find(
                    (f) => f.code === printDoc.student.filiereCode
                  );
                  const fileName = await downloadCartePvcPdf(
                    printDoc.student,
                    fil,
                    cardSide
                  );
                  onNotify?.(`Carte PVC PDF téléchargée : ${fileName}`);
                }
              : undefined
          }
          toolbarExtra={
            printDoc.type === 'bulletin' ? (
              <select
                value={bulletinSemestre}
                onChange={(e) => setBulletinSemestre(e.target.value)}
                aria-label="Période du relevé"
                className="px-2.5 py-1.5 text-xs font-semibold border border-[#e3e7ef] rounded-lg bg-white text-[#0b1f3f]"
              >
                <option value="Tous">Toutes périodes</option>
                {Array.from(
                  new Set(
                    state.ues
                      .filter((u) => ueMatchesStudent(u, printDoc.student))
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
            ) : undefined
          }
          onClose={() => setPrintDoc(null)}
        >
          {printDoc.type === 'card' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e3e7ef] print:hidden">
                <div className="flex items-center gap-1 p-1 bg-[#f8f9fb] border border-[#e3e7ef] rounded-lg">
                  {(
                    [
                      { id: 'both', label: 'Recto & Verso' },
                      { id: 'recto', label: 'Recto seul' },
                      { id: 'verso', label: 'Verso seul' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCardSide(opt.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                        cardSide === opt.id
                          ? 'bg-[#0b1f3f] text-white'
                          : 'text-slate-600 hover:text-[#161e2e]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {canManageStudents && (
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-medium text-[#0b1f3f] cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    {printDoc.student.photoUrl ? 'Changer photo' : 'Importer photo ID'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoFile(e, printDoc.student)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <CarteEtudiantPvc
                student={printDoc.student}
                filiere={state.filieres.find((f) => f.code === printDoc.student.filiereCode)}
                side={cardSide}
              />
            </div>
          ) : printDoc.type === 'bulletin' ? (
            <BulletinReleve
              student={printDoc.student}
              state={state}
              semestre={bulletinSemestre === 'Tous' ? undefined : bulletinSemestre}
            />
          ) : printDoc.type === 'recu' ? (
            (() => {
              const st = printDoc.student;
              const fil = state.filieres.find((f) => f.code === st.filiereCode);
              const fin = computeStudentFinance(st, state.filieres, state.payments);
              const fraisInscription = fil?.fraisInscription ?? 75000;
              const scolariteApresBourse = Math.round(
                (fil?.scolariteAnnuelle ?? 480000) * (1 - (st.boursePct || 0) / 100)
              );
              const receiptRef = getInscriptionReceiptRef(st, state);
              const inscriptionPay = state.payments.find(
                (p) => p.studentId === st.id && p.motif === 'Inscription'
              );
              const isSettled = fin.totalPaye >= fraisInscription;
              return (
                <div className="space-y-5 text-xs">
                  <OfficialDocumentHeader
                    campus={st.campus}
                    docTitle="Reçu d'Inscription Officiel"
                    docRef={receiptRef}
                    academicYear={st.anneeAcademique}
                  />

                  <div className="bg-[#f8f9fb] border border-[#e3e7ef] rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider font-bold text-[#0b1f3f]">
                        Attestation de validation d’inscription académique
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Date d’inscription : <strong>{st.dateInscription}</strong> · Statut dossier :{' '}
                        <strong>{st.statutDossier}</strong>
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded border text-[11px] font-bold ${
                        isSettled
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}
                    >
                      {isSettled ? 'Frais d’inscription réglés' : 'À régler à la Caisse Centrale'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 p-4 border border-[#e3e7ef] rounded-lg">
                    <div>
                      <p className="text-slate-500">Étudiant inscrit</p>
                      <p className="font-bold text-sm text-[#161e2e] mt-0.5">
                        {st.nom} {st.prenom}
                      </p>
                      <p className="font-mono text-[#0b1f3f] font-semibold mt-0.5">
                        {st.matricule}
                      </p>
                      <p className="text-slate-600 mt-1">
                        {fil ? `${fil.code} — ${fil.nom}` : st.filiereCode}
                        {st.option ? ` (${st.option})` : ''} · {st.niveau}
                      </p>
                    </div>
                    <div className="sm:text-right print:text-right space-y-1">
                      <p className="text-slate-500">Parent / Tuteur & Garant</p>
                      <p className="font-semibold text-[#161e2e]">
                        {st.tuteurNom} ({st.tuteurTel || 'Tél. non renseigné'})
                      </p>
                      {st.garantNom && (
                        <p className="text-slate-600">
                          Garant : {st.garantNom}
                          {st.garantTel ? ` (${st.garantTel})` : ''}
                        </p>
                      )}
                      <p className="text-slate-500">Campus : {st.campus}</p>
                    </div>
                  </div>

                  <div className="p-4 border border-[#e3e7ef] rounded-lg bg-[#f8f9fb] flex flex-col sm:flex-row print:flex-row items-start sm:items-center print:items-center justify-between gap-4">
                    <div className="flex-1 w-full space-y-1.5">
                      <p className="font-bold text-[#0b1f3f] uppercase tracking-wider text-[11px] mb-2">
                        Décompte financier de l’inscription
                      </p>
                      <div className="flex items-center justify-between border-b border-[#e3e7ef] pb-1">
                        <span className="text-slate-600">Frais d’inscription académique</span>
                        <span className="font-mono font-semibold text-[#161e2e] tabular-nums">
                          {formatFCFA(fraisInscription)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-[#e3e7ef] pb-1">
                        <span className="text-slate-600">
                          Scolarité annuelle{st.boursePct > 0 ? ` (bourse -${st.boursePct}%)` : ''}
                        </span>
                        <span className="font-mono font-semibold text-[#161e2e] tabular-nums">
                          {formatFCFA(scolariteApresBourse)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-[#e3e7ef] pb-1">
                        <span className="font-semibold text-[#0b1f3f]">Total annuel engagé</span>
                        <span className="font-mono font-bold text-[#0b1f3f] tabular-nums">
                          {formatFCFA(fin.totalDu)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-[#e3e7ef] pb-1">
                        <span className="text-slate-600">
                          {inscriptionPay
                            ? `Déjà réglé (Reçu Caisse ${inscriptionPay.numeroRecu})`
                            : 'Montant réglé à ce jour'}
                        </span>
                        <span className="font-mono font-bold text-emerald-700 tabular-nums">
                          {formatFCFA(fin.totalPaye)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="font-bold text-[#161e2e]">Reste à payer</span>
                        <span className="font-mono font-bold text-amber-800 tabular-nums">
                          {formatFCFA(fin.resteAPayer)}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <QrCodeSvg
                        value={`CEREC-ISCOM|RECU-INSCRIPTION|${receiptRef}|${st.matricule}|${st.nom} ${st.prenom}|${st.filiereCode}-${st.niveau}|PAYE:${fin.totalPaye}`}
                        size={82}
                      />
                      <span className="font-mono text-[10px] text-slate-500">{receiptRef}</span>
                    </div>
                  </div>

                  {canCollectPayments && fin.resteAPayer > 0 && (
                    <div className="flex justify-end print:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setPrintDoc(null);
                          setPayStudent(st);
                          setPayMotif('Inscription');
                          setPayAmount(Math.min(fraisInscription, fin.resteAPayer));
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Encaisser les frais d’inscription maintenant
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-6 pt-5 text-xs text-center">
                    <div>
                      <p className="font-semibold text-slate-700">L’Étudiant / Parent</p>
                      <div className="h-12 border-b border-dashed border-slate-300 mx-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Service Scolarité</p>
                      <div className="h-12 border-b border-dashed border-slate-300 mx-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Cachet & Visa Caisse</p>
                      <div className="h-12 border-b border-dashed border-slate-300 mx-4" />
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="space-y-5 text-sm">
              <OfficialDocumentHeader
                campus={printDoc.student.campus}
                docTitle="Fiche d’Inscription Académique"
                docRef={printDoc.student.matricule}
                academicYear={printDoc.student.anneeAcademique}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 text-xs border border-[#e3e7ef] rounded-lg p-4">
                <div>
                  <p className="text-slate-500">Nom et Prénom</p>
                  <p className="font-bold text-[#161e2e] text-sm mt-0.5">
                    {printDoc.student.nom} {printDoc.student.prenom}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Matricule LMD</p>
                  <p className="font-mono font-bold text-[#0b1f3f] text-sm mt-0.5">
                    {printDoc.student.matricule}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Date et lieu de naissance</p>
                  <p className="font-medium mt-0.5">
                    {printDoc.student.dateNaissance} à {printDoc.student.lieuNaissance}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Filière, Option & Niveau</p>
                  <p className="font-semibold mt-0.5">
                    {state.filieres.find((f) => f.code === printDoc.student.filiereCode)?.nom}
                    {printDoc.student.option ? ` — ${printDoc.student.option}` : ''} (
                    {printDoc.student.niveau})
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Téléphone & Email</p>
                  <p className="font-medium mt-0.5 break-all">
                    {printDoc.student.telephone} · {printDoc.student.email}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Statut & Date d’inscription</p>
                  <p className="font-medium mt-0.5">
                    {printDoc.student.statutDossier} · {printDoc.student.dateInscription}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 text-xs">
                <div className="border border-[#e3e7ef] rounded-lg p-3.5 space-y-1">
                  <p className="font-bold text-[#0b1f3f] uppercase tracking-wider text-[11px]">
                    Parent / Tuteur légal
                  </p>
                  <p className="font-semibold text-[#161e2e]">
                    {printDoc.student.tuteurNom}
                    {printDoc.student.parentLien ? ` (${printDoc.student.parentLien})` : ''}
                  </p>
                  <p className="text-slate-600">
                    Tél : {printDoc.student.tuteurTel || 'Non renseigné'}
                    {printDoc.student.parentEmail ? ` · ${printDoc.student.parentEmail}` : ''}
                  </p>
                  {(printDoc.student.parentProfession || printDoc.student.parentAdresse) && (
                    <p className="text-slate-500">
                      {[printDoc.student.parentProfession, printDoc.student.parentAdresse]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>

                <div className="border border-[#e3e7ef] rounded-lg p-3.5 space-y-1">
                  <p className="font-bold text-[#0b1f3f] uppercase tracking-wider text-[11px]">
                    Garant (Financier & Moral)
                  </p>
                  <p className="font-semibold text-[#161e2e]">
                    {printDoc.student.garantNom || printDoc.student.tuteurNom}
                    {printDoc.student.garantLien
                      ? ` (${printDoc.student.garantLien})`
                      : ''}
                  </p>
                  <p className="text-slate-600">
                    Tél :{' '}
                    {printDoc.student.garantTel ||
                      printDoc.student.tuteurTel ||
                      'Non renseigné'}
                    {printDoc.student.garantCni ? ` · ID : ${printDoc.student.garantCni}` : ''}
                  </p>
                  {(printDoc.student.garantProfession || printDoc.student.garantAdresse) && (
                    <p className="text-slate-500">
                      {[printDoc.student.garantProfession, printDoc.student.garantAdresse]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="border border-[#e3e7ef] rounded-lg p-4 flex flex-col sm:flex-row print:flex-row items-start sm:items-center print:items-center justify-between gap-4">
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-[#0b1f3f]">Situation Administrative & Financière</p>
                  <p className="text-slate-600">
                    Statut dossier : <span className="font-semibold">{printDoc.student.statutDossier}</span> · Date d’inscription :{' '}
                    {printDoc.student.dateInscription}
                  </p>
                  <p className="text-slate-600 font-mono tabular-nums">
                    Total payé :{' '}
                    {formatFCFA(
                      computeStudentFinance(printDoc.student, state.filieres, state.payments).totalPaye
                    )}{' '}
                    / Reste :{' '}
                    {formatFCFA(
                      computeStudentFinance(printDoc.student, state.filieres, state.payments).resteAPayer
                    )}
                  </p>
                </div>
                <QrCodeSvg
                  value={`CEREC-ISCOM|INSCRIPTION|${printDoc.student.matricule}|${printDoc.student.nom} ${printDoc.student.prenom}|${printDoc.student.filiereCode}-${printDoc.student.niveau}|${printDoc.student.campus}`}
                  size={78}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-6 pt-6 text-xs text-center">
                <div>
                  <p className="font-semibold text-slate-700">Signature de l’Étudiant</p>
                  <div className="h-14 border-b border-dashed border-slate-300 mx-4" />
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Signature du Parent / Garant</p>
                  <div className="h-14 border-b border-dashed border-slate-300 mx-4" />
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Le Chef de Service Scolarité</p>
                  <div className="h-14 border-b border-dashed border-slate-300 mx-4" />
                </div>
              </div>
            </div>
          )}
        </PrintModal>
      )}
    </div>
  );
}
