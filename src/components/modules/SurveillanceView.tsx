import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Clock,
  History,
  LogIn,
  LogOut,
  Printer,
  QrCode,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Campus, CerecState, GateLog } from '../../types/cerec';
import {
  computeStudentFinance,
  formatFrenchDate,
  getFrenchWeekday,
  getLocalDateISO,
  getLocalTimeHHMM,
} from '../../utils/lmd';
import { OfficialDocumentHeader, PrintModal } from '../PrintModal';

interface SurveillanceViewProps {
  state: CerecState;
  campusFilter: Campus | 'Tous';
  canOperateGate?: boolean;
  operatorName?: string;
  onAddGateLog: (log: GateLog) => void;
  onMarkExit: (id: string) => void;
  onCloseAllGateLogs: () => void;
  onDeleteGateLog: (id: string) => void;
}

interface GateMovementEvent {
  id: string;
  gateLogId: string;
  mouvement: 'Entrée' | 'Sortie';
  date: string;
  jour: string;
  heure: string;
  campus: Campus;
  typePersonne: GateLog['typePersonne'];
  nomComplet: string;
  reference: string;
  motif: string;
  statutAcces: GateLog['statutAcces'];
  pointeur?: string;
  sortKey: string;
}

const WEEKDAYS_FR = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
];

export function SurveillanceView({
  state,
  campusFilter,
  canOperateGate = true,
  operatorName = 'Pointeur Guérite',
  onAddGateLog,
  onMarkExit,
  onCloseAllGateLogs,
  onDeleteGateLog,
}: SurveillanceViewProps) {
  const [badgeInput, setBadgeInput] = useState('');
  const [visitorType, setVisitorType] = useState<'Visiteur' | 'Personnel'>('Visiteur');
  const [visitorName, setVisitorName] = useState('');
  const [visitorDoc, setVisitorDoc] = useState('');
  const [visitorMotif, setVisitorMotif] = useState('');
  const [activeTab, setActiveTab] = useState<'historique' | 'sessions'>('historique');
  const [movementFilter, setMovementFilter] = useState<'Tous' | 'Entrée' | 'Sortie'>('Tous');
  const [dayFilter, setDayFilter] = useState<string>('Tous');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [printLogs, setPrintLogs] = useState(false);
  const [lastCheck, setLastCheck] = useState<{
    action: 'Entrée' | 'Sortie';
    name: string;
    status: GateLog['statutAcces'];
    stamp: string;
    detail: string;
  } | null>(null);

  const logs = useMemo(() => {
    return state.gateLogs
      .filter((g) => campusFilter === 'Tous' || g.campus === campusFilter)
      .sort((a, b) => {
        const aKey = `${a.date}T${a.heureEntree === '—' ? a.heureSortie ?? '00:00' : a.heureEntree}`;
        const bKey = `${b.date}T${b.heureEntree === '—' ? b.heureSortie ?? '00:00' : b.heureEntree}`;
        return bKey.localeCompare(aKey);
      });
  }, [state.gateLogs, campusFilter]);

  const movementHistory = useMemo<GateMovementEvent[]>(() => {
    const events: GateMovementEvent[] = [];
    for (const g of logs) {
      if (g.heureEntree && g.heureEntree !== '—') {
        const entryDate = g.date || getLocalDateISO();
        const entryDay = g.jour || getFrenchWeekday(entryDate);
        events.push({
          id: `${g.id}-in`,
          gateLogId: g.id,
          mouvement: 'Entrée',
          date: entryDate,
          jour: entryDay,
          heure: g.heureEntree,
          campus: g.campus,
          typePersonne: g.typePersonne,
          nomComplet: g.nomComplet,
          reference: g.reference,
          motif: g.motif,
          statutAcces: g.statutAcces,
          pointeur: g.pointeurEntree,
          sortKey: `${entryDate}T${g.heureEntree}-0`,
        });
      }
      if (g.heureSortie) {
        const exitDate = g.dateSortie || g.date || getLocalDateISO();
        const exitDay = g.jourSortie || getFrenchWeekday(exitDate);
        events.push({
          id: `${g.id}-out`,
          gateLogId: g.id,
          mouvement: 'Sortie',
          date: exitDate,
          jour: exitDay,
          heure: g.heureSortie,
          campus: g.campus,
          typePersonne: g.typePersonne,
          nomComplet: g.nomComplet,
          reference: g.reference,
          motif: g.motif,
          statutAcces: g.statutAcces,
          pointeur: g.pointeurSortie,
          sortKey: `${exitDate}T${g.heureSortie}-1`,
        });
      }
    }
    return events.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [logs]);

  const filteredMovements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return movementHistory.filter((ev) => {
      if (movementFilter !== 'Tous' && ev.mouvement !== movementFilter) return false;
      if (dayFilter !== 'Tous' && ev.jour !== dayFilter) return false;
      if (dateFilter && ev.date !== dateFilter) return false;
      if (q) {
        const hay = `${ev.nomComplet} ${ev.reference} ${ev.motif} ${ev.typePersonne} ${ev.campus}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [movementHistory, movementFilter, dayFilter, dateFilter, searchQuery]);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((g) => {
      const entryDay = g.jour || getFrenchWeekday(g.date);
      if (dayFilter !== 'Tous' && entryDay !== dayFilter && g.jourSortie !== dayFilter) {
        return false;
      }
      if (dateFilter && g.date !== dateFilter && g.dateSortie !== dateFilter) {
        return false;
      }
      if (q) {
        const hay = `${g.nomComplet} ${g.reference} ${g.motif} ${g.typePersonne} ${g.campus}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, dayFilter, dateFilter, searchQuery]);

  const insideCount = logs.filter((g) => !g.heureSortie).length;
  const totalEntriesCount = movementHistory.filter((m) => m.mouvement === 'Entrée').length;
  const totalExitsCount = movementHistory.filter((m) => m.mouvement === 'Sortie').length;
  const alertCount = logs.filter((g) => g.statutAcces !== 'Autorisé').length;

  const findStudentOrLecturer = (raw: string) => {
    const q = raw.trim().toLowerCase();
    if (!q) return null;

    const student = state.students.find(
      (s) =>
        s.matricule.toLowerCase() === q ||
        q.includes(s.matricule.toLowerCase()) ||
        `${s.nom} ${s.prenom}`.toLowerCase() === q ||
        `${s.prenom} ${s.nom}`.toLowerCase() === q ||
        s.nom.toLowerCase() === q
    );
    if (student) return { kind: 'student' as const, student };

    const lecturer = state.lecturers.find(
      (l) =>
        l.nom.toLowerCase().includes(q) ||
        l.email.toLowerCase() === q
    );
    if (lecturer) return { kind: 'lecturer' as const, lecturer };

    return null;
  };

  const handleBadgeAction = (mode: 'Entrée' | 'Sortie') => {
    if (!canOperateGate) return;
    const raw = badgeInput.trim();
    if (!raw) return;

    const nowObj = new Date();
    const nowTime = getLocalTimeHHMM(nowObj);
    const nowDate = getLocalDateISO(nowObj);
    const nowDay = getFrenchWeekday(nowDate);
    const stampLabel = `${nowDay} ${formatFrenchDate(nowDate)} à ${nowTime}`;

    const matched = findStudentOrLecturer(raw);

    if (mode === 'Sortie') {
      const q = raw.toLowerCase();
      const openLog = logs.find(
        (g) =>
          !g.heureSortie &&
          (g.reference.toLowerCase() === q ||
            q.includes(g.reference.toLowerCase()) ||
            g.nomComplet.toLowerCase().includes(q) ||
            (matched?.kind === 'student' && g.studentId === matched.student.id))
      );

      if (openLog) {
        onMarkExit(openLog.id);
        setLastCheck({
          action: 'Sortie',
          name: `${openLog.nomComplet} (${openLog.reference})`,
          status: openLog.statutAcces,
          stamp: stampLabel,
          detail: `Sortie pointée avec clôture de l’entrée de ${openLog.heureEntree}.`,
        });
        setBadgeInput('');
        return;
      }

      if (matched?.kind === 'student') {
        const s = matched.student;
        onAddGateLog({
          id: `gt-${Date.now()}`,
          campus: s.campus,
          typePersonne: 'Étudiant',
          studentId: s.id,
          nomComplet: `${s.nom} ${s.prenom}`,
          reference: s.matricule,
          motif: `Sortie campus (${s.filiereCode} ${s.niveau})`,
          heureEntree: '—',
          heureSortie: nowTime,
          statutAcces: 'Autorisé',
          date: nowDate,
          jour: nowDay,
          dateSortie: nowDate,
          jourSortie: nowDay,
          pointeurSortie: operatorName,
        });
        setLastCheck({
          action: 'Sortie',
          name: `${s.nom} ${s.prenom} (${s.matricule})`,
          status: 'Autorisé',
          stamp: stampLabel,
          detail: 'Sortie directe enregistrée dans l’historique des mouvements.',
        });
        setBadgeInput('');
        return;
      }

      if (matched?.kind === 'lecturer') {
        const l = matched.lecturer;
        onAddGateLog({
          id: `gt-${Date.now()}`,
          campus: l.campus,
          typePersonne: 'Personnel',
          nomComplet: l.nom,
          reference: l.grade,
          motif: `Sortie campus (${l.specialite})`,
          heureEntree: '—',
          heureSortie: nowTime,
          statutAcces: 'Autorisé',
          date: nowDate,
          jour: nowDay,
          dateSortie: nowDate,
          jourSortie: nowDay,
          pointeurSortie: operatorName,
        });
        setLastCheck({
          action: 'Sortie',
          name: `${l.nom} (${l.grade})`,
          status: 'Autorisé',
          stamp: stampLabel,
          detail: 'Sortie du personnel enregistrée dans l’historique.',
        });
        setBadgeInput('');
        return;
      }

      setLastCheck({
        action: 'Sortie',
        name: raw.toUpperCase(),
        status: 'Refusé',
        stamp: stampLabel,
        detail: 'Aucun présent en cours ou matricule correspondant trouvé.',
      });
      return;
    }

    // Mode === 'Entrée'
    if (!matched) {
      setLastCheck({
        action: 'Entrée',
        name: raw.toUpperCase(),
        status: 'Refusé',
        stamp: stampLabel,
        detail: 'Matricule ou badge introuvable dans la base CEREC-ISCOM.',
      });
      return;
    }

    if (matched.kind === 'lecturer') {
      const l = matched.lecturer;
      onAddGateLog({
        id: `gt-${Date.now()}`,
        campus: l.campus,
        typePersonne: 'Personnel',
        nomComplet: l.nom,
        reference: l.grade,
        motif: `Cours / Service (${l.specialite})`,
        heureEntree: nowTime,
        statutAcces: 'Autorisé',
        date: nowDate,
        jour: nowDay,
        pointeurEntree: operatorName,
      });
      setLastCheck({
        action: 'Entrée',
        name: `${l.nom} (${l.grade})`,
        status: 'Autorisé',
        stamp: stampLabel,
        detail: `Entrée Personnel / Enseignant validée sur ${l.campus}.`,
      });
      setBadgeInput('');
      return;
    }

    const student = matched.student;
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

    onAddGateLog({
      id: `gt-${Date.now()}`,
      campus: student.campus,
      typePersonne: 'Étudiant',
      studentId: student.id,
      nomComplet: `${student.nom} ${student.prenom}`,
      reference: student.matricule,
      motif: `Accès campus (${student.filiereCode} ${student.niveau})`,
      heureEntree: nowTime,
      statutAcces,
      date: nowDate,
      jour: nowDay,
      pointeurEntree: operatorName,
    });

    setLastCheck({
      action: 'Entrée',
      name: `${student.nom} ${student.prenom} (${student.matricule})`,
      status: statutAcces,
      stamp: stampLabel,
      detail,
    });
    setBadgeInput('');
  };

  const handleVisitorMovement = (mode: 'Entrée' | 'Sortie') => {
    if (!canOperateGate) return;
    const cleanName = visitorName.trim();
    const cleanDoc = visitorDoc.trim();
    const cleanMotif = visitorMotif.trim();
    if (!cleanName) return;

    const nowObj = new Date();
    const nowTime = getLocalTimeHHMM(nowObj);
    const nowDate = getLocalDateISO(nowObj);
    const nowDay = getFrenchWeekday(nowDate);
    const stampLabel = `${nowDay} ${formatFrenchDate(nowDate)} à ${nowTime}`;
    const targetCampus: Campus = campusFilter === 'Tous' ? 'Pointe-Noire' : campusFilter;

    if (mode === 'Sortie') {
      const openLog = logs.find(
        (g) =>
          !g.heureSortie &&
          (g.nomComplet.toLowerCase() === cleanName.toLowerCase() ||
            (cleanDoc && g.reference.toLowerCase() === cleanDoc.toLowerCase()))
      );
      if (openLog) {
        onMarkExit(openLog.id);
        setLastCheck({
          action: 'Sortie',
          name: `${openLog.nomComplet} (${openLog.reference})`,
          status: openLog.statutAcces,
          stamp: stampLabel,
          detail: `Sortie pointée (entrée enregistrée à ${openLog.heureEntree}).`,
        });
      } else {
        onAddGateLog({
          id: `gt-${Date.now()}`,
          campus: targetCampus,
          typePersonne: visitorType,
          nomComplet: cleanName,
          reference: cleanDoc || 'CNI / Pièce',
          motif: cleanMotif || 'Sortie campus',
          heureEntree: '—',
          heureSortie: nowTime,
          statutAcces: 'Autorisé',
          date: nowDate,
          jour: nowDay,
          dateSortie: nowDate,
          jourSortie: nowDay,
          pointeurSortie: operatorName,
        });
        setLastCheck({
          action: 'Sortie',
          name: cleanName,
          status: 'Autorisé',
          stamp: stampLabel,
          detail: `Sortie directe (${visitorType}) enregistrée dans l’historique.`,
        });
      }
      setVisitorName('');
      setVisitorDoc('');
      setVisitorMotif('');
      return;
    }

    if (!cleanMotif) return;
    onAddGateLog({
      id: `gt-${Date.now()}`,
      campus: targetCampus,
      typePersonne: visitorType,
      nomComplet: cleanName,
      reference: cleanDoc || 'CNI / Pièce',
      motif: cleanMotif,
      heureEntree: nowTime,
      statutAcces: 'Autorisé',
      date: nowDate,
      jour: nowDay,
      pointeurEntree: operatorName,
    });
    setLastCheck({
      action: 'Entrée',
      name: cleanName,
      status: 'Autorisé',
      stamp: stampLabel,
      detail: `Entrée ${visitorType} enregistrée (${targetCampus}).`,
    });
    setVisitorName('');
    setVisitorDoc('');
    setVisitorMotif('');
  };

  const todayISO = getLocalDateISO();
  const todayDayName = getFrenchWeekday(todayISO);

  return (
    <div className="space-y-5">
      {/* Gate KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#e3e7ef] rounded-lg p-4">
          <p className="text-xs text-slate-500">Présents actuellement</p>
          <p className="font-mono text-xl font-bold text-[#0b1f3f] mt-1 tabular-nums">
            {insideCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {todayDayName} {formatFrenchDate(todayISO)}
          </p>
        </div>
        <div className="bg-white border border-[#e3e7ef] rounded-lg p-4">
          <p className="text-xs text-slate-500">Entrées enregistrées</p>
          <p className="font-mono text-xl font-bold text-emerald-700 mt-1 tabular-nums">
            {totalEntriesCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Historique cumulé</p>
        </div>
        <div className="bg-white border border-[#e3e7ef] rounded-lg p-4">
          <p className="text-xs text-slate-500">Sorties enregistrées</p>
          <p className="font-mono text-xl font-bold text-[#161e2e] mt-1 tabular-nums">
            {totalExitsCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Mouvements clôturés</p>
        </div>
        <div className="bg-white border border-[#e3e7ef] rounded-lg p-4">
          <p className="text-xs text-slate-500">Alertes / Refus accès</p>
          <p className="font-mono text-xl font-bold text-amber-700 mt-1 tabular-nums">
            {alertCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Contrôle scolarité</p>
        </div>
      </div>

      {/* 2-Column Pointeur Check-In / Check-Out Panels */}
      {canOperateGate && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Badge Scanner (Entrée / Sortie) */}
          <div className="bg-white border border-[#e3e7ef] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#161e2e]">
                <ShieldCheck className="w-4 h-4 text-[#0b1f3f]" />
                Pointage Badge Étudiant & Enseignant
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                {todayDayName} · {formatFrenchDate(todayISO)}
              </span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleBadgeAction('Entrée');
              }}
              className="space-y-3"
            >
              <div className="relative">
                <QrCode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  list="pointeur-badges-list"
                  value={badgeInput}
                  onChange={(e) => setBadgeInput(e.target.value)}
                  placeholder="Scanner ou saisir matricule / nom (ex: ISCOM-PN-26-001)"
                  className="w-full pl-9 pr-3 py-2.5 text-sm font-mono border border-[#e3e7ef] rounded-lg focus:outline-none focus:border-[#0b1f3f]"
                />
                <datalist id="pointeur-badges-list">
                  {state.students
                    .filter((s) => campusFilter === 'Tous' || s.campus === campusFilter)
                    .map((s) => (
                      <option
                        key={s.id}
                        value={s.matricule}
                      >{`${s.nom} ${s.prenom} (${s.filiereCode} ${s.niveau})`}</option>
                    ))}
                  {state.lecturers
                    .filter((l) => campusFilter === 'Tous' || l.campus === campusFilter)
                    .map((l) => (
                      <option key={l.id} value={l.nom}>{`${l.grade} · ${l.campus}`}</option>
                    ))}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-[#eab33a]" />
                  Marquer Entrée
                </button>
                <button
                  type="button"
                  onClick={() => handleBadgeAction('Sortie')}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Marquer Sortie
                </button>
              </div>
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">
                    {lastCheck.action} · {lastCheck.status} — {lastCheck.name}
                  </p>
                  <span className="font-mono text-[11px] font-semibold">
                    {lastCheck.stamp}
                  </span>
                </div>
                <p className="mt-1">{lastCheck.detail}</p>
              </div>
            )}
          </div>

          {/* Visitor / Staff Manual Check-In & Check-Out */}
          <div className="bg-white border border-[#e3e7ef] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#161e2e]">
                <UserPlus className="w-4 h-4 text-[#c58b12]" />
                Pointage Visiteur / Personnel (Entrée & Sortie)
              </div>
              <select
                value={visitorType}
                onChange={(e) => setVisitorType(e.target.value as 'Visiteur' | 'Personnel')}
                aria-label="Type de personne"
                className="px-2.5 py-1 text-xs font-semibold border border-[#e3e7ef] rounded-lg bg-[#f8f9fb] text-[#0b1f3f]"
              >
                <option value="Visiteur">Visiteur</option>
                <option value="Personnel">Personnel</option>
              </select>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVisitorMovement('Entrée');
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="Nom complet *"
                  className="px-3 py-2.5 text-xs border border-[#e3e7ef] rounded-lg"
                />
                <input
                  type="text"
                  value={visitorDoc}
                  onChange={(e) => setVisitorDoc(e.target.value)}
                  placeholder="N° CNI / Badge"
                  className="px-3 py-2.5 text-xs font-mono border border-[#e3e7ef] rounded-lg"
                />
                <input
                  type="text"
                  value={visitorMotif}
                  onChange={(e) => setVisitorMotif(e.target.value)}
                  placeholder="Motif / Service *"
                  className="px-3 py-2.5 text-xs border border-[#e3e7ef] rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-[#eab33a]" />
                  Marquer Entrée
                </button>
                <button
                  type="button"
                  onClick={() => handleVisitorMovement('Sortie')}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[#0b1f3f] hover:bg-slate-50 text-[#0b1f3f] text-xs font-bold cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Marquer Sortie
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Movement History & Gate Ledger */}
      <div className="bg-white border border-[#e3e7ef] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e3e7ef] bg-[#f8f9fb] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('historique')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'historique'
                  ? 'bg-[#0b1f3f] text-white'
                  : 'bg-white border border-[#e3e7ef] text-slate-600 hover:text-[#0b1f3f]'
              }`}
            >
              <History className="w-3.5 h-3.5 text-[#eab33a]" />
              Historique des mouvements ({filteredMovements.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sessions')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'sessions'
                  ? 'bg-[#0b1f3f] text-white'
                  : 'bg-white border border-[#e3e7ef] text-slate-600 hover:text-[#0b1f3f]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#eab33a]" />
              Main courante ({filteredSessions.length} · {insideCount} présent(s))
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canOperateGate && insideCount > 0 && (
              <button
                type="button"
                onClick={onCloseAllGateLogs}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                Clôturer les sorties ({insideCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => setPrintLogs(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e3e7ef] bg-white hover:border-[#0b1f3f] text-xs font-semibold text-[#0b1f3f] cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimer registre
            </button>
          </div>
        </div>

        {/* Filter Bar: Search, Mouvement, Jour, Date */}
        <div className="px-5 py-3 border-b border-[#e3e7ef] bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher nom, matricule, motif..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#e3e7ef] rounded-lg"
            />
          </div>

          {activeTab === 'historique' ? (
            <select
              value={movementFilter}
              onChange={(e) =>
                setMovementFilter(e.target.value as 'Tous' | 'Entrée' | 'Sortie')
              }
              aria-label="Filtrer par type de mouvement"
              className="px-3 py-1.5 text-xs border border-[#e3e7ef] rounded-lg bg-white text-[#161e2e]"
            >
              <option value="Tous">Tous les mouvements (Entrée & Sortie)</option>
              <option value="Entrée">Entrées uniquement</option>
              <option value="Sortie">Sorties uniquement</option>
            </select>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#e3e7ef] rounded-lg bg-[#f8f9fb] text-slate-600">
              <Clock className="w-3.5 h-3.5 text-[#0b1f3f]" />
              <span>Présents en cours : {insideCount}</span>
            </div>
          )}

          <select
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            aria-label="Filtrer par jour"
            className="px-3 py-1.5 text-xs border border-[#e3e7ef] rounded-lg bg-white text-[#161e2e]"
          >
            <option value="Tous">Tous les jours</option>
            {WEEKDAYS_FR.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                aria-label="Filtrer par date"
                className="w-full pl-8 pr-2 py-1.5 text-xs font-mono border border-[#e3e7ef] rounded-lg bg-white"
              />
            </div>
            {(dateFilter || dayFilter !== 'Tous' || movementFilter !== 'Tous' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setDateFilter('');
                  setDayFilter('Tous');
                  setMovementFilter('Tous');
                  setSearchQuery('');
                }}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-[#0b1f3f] border border-[#e3e7ef] rounded-lg cursor-pointer whitespace-nowrap"
              >
                Tout voir
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: Movement History (Date ; Jour ; Heure) */}
        {activeTab === 'historique' && (
          <>
            <div className="md:hidden divide-y divide-[#e3e7ef]">
              {filteredMovements.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500">
                  Aucun mouvement enregistré pour ces critères.
                </p>
              ) : (
                filteredMovements.map((ev) => (
                  <div key={ev.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                              ev.mouvement === 'Entrée'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {ev.mouvement === 'Entrée' ? (
                              <ArrowDownLeft className="w-3 h-3" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" />
                            )}
                            {ev.mouvement}
                          </span>
                          <span className="font-mono text-xs font-semibold text-[#0b1f3f]">
                            {ev.jour} {formatFrenchDate(ev.date)} · {ev.heure}
                          </span>
                        </div>
                        <p className="font-semibold text-sm text-[#161e2e] mt-1 truncate">
                          {ev.nomComplet}
                        </p>
                        <p className="text-xs text-slate-500">
                          {ev.typePersonne} · <span className="font-mono">{ev.reference}</span>
                        </p>
                      </div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium shrink-0 ${
                          ev.statutAcces === 'Autorisé'
                            ? 'bg-emerald-50 text-emerald-700'
                            : ev.statutAcces === 'Alerte Scolarité'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {ev.statutAcces}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {ev.motif} · {ev.campus}
                      {ev.pointeur ? ` · Pointé par ${ev.pointeur}` : ''}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#e3e7ef] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Mouvement</th>
                    <th className="py-3 px-4">Jour</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Heure</th>
                    <th className="py-3 px-4">Personne</th>
                    <th className="py-3 px-4">Référence</th>
                    <th className="py-3 px-4">Motif & Campus</th>
                    <th className="py-3 px-4">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e7ef]">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-slate-500">
                        Aucun mouvement enregistré pour ces critères.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold ${
                              ev.mouvement === 'Entrée'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {ev.mouvement === 'Entrée' ? (
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            )}
                            {ev.mouvement}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-[#0b1f3f]">
                          {ev.jour}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-[#161e2e] tabular-nums">
                          {formatFrenchDate(ev.date)}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-bold text-[#0b1f3f] tabular-nums">
                          {ev.heure}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-[#161e2e]">{ev.nomComplet}</p>
                          <p className="text-xs text-slate-500">
                            {ev.typePersonne}
                            {ev.pointeur ? ` · ${ev.pointeur}` : ''}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-[#0b1f3f]">
                          {ev.reference}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700">
                          {ev.motif} · {ev.campus}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              ev.statutAcces === 'Autorisé'
                                ? 'bg-emerald-50 text-emerald-700'
                                : ev.statutAcces === 'Alerte Scolarité'
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {ev.statutAcces}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* TAB 2: Paired Sessions Ledger */}
        {activeTab === 'sessions' && (
          <>
            <div className="md:hidden divide-y divide-[#e3e7ef]">
              {filteredSessions.map((g) => {
                const entryDay = g.jour || getFrenchWeekday(g.date);
                const exitDay = g.jourSortie || (g.dateSortie ? getFrenchWeekday(g.dateSortie) : entryDay);
                return (
                  <div key={g.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-[#161e2e] truncate">
                          {g.nomComplet}
                        </p>
                        <p className="text-xs text-slate-500">
                          {g.typePersonne} · <span className="font-mono text-[#0b1f3f]">{g.reference}</span>
                        </p>
                      </div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium shrink-0 ${
                          g.statutAcces === 'Autorisé'
                            ? 'bg-emerald-50 text-emerald-700'
                            : g.statutAcces === 'Alerte Scolarité'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {g.statutAcces}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {g.motif} · {g.campus}
                    </p>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="font-mono text-xs text-slate-600 tabular-nums space-y-0.5">
                        {g.heureEntree && g.heureEntree !== '—' && (
                          <p>
                            Entrée : {entryDay} {formatFrenchDate(g.date)} · {g.heureEntree}
                          </p>
                        )}
                        {g.heureSortie && (
                          <p className="text-slate-500">
                            Sortie : {exitDay} {formatFrenchDate(g.dateSortie || g.date)} · {g.heureSortie}
                          </p>
                        )}
                      </div>
                      <div className="inline-flex items-center gap-1.5">
                        {canOperateGate && !g.heureSortie ? (
                          <button
                            type="button"
                            onClick={() => onMarkExit(g.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#e0a526] text-[#07142b] text-xs font-bold cursor-pointer"
                          >
                            <LogOut className="w-3 h-3" />
                            Sortir
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 mr-1">
                            {g.heureSortie ? 'Clôturé' : 'En campus'}
                          </span>
                        )}
                        {canOperateGate && (
                          <button
                            type="button"
                            onClick={() => onDeleteGateLog(g.id)}
                            aria-label={`Supprimer passage ${g.nomComplet}`}
                            className="p-1.5 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#e3e7ef] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Personne</th>
                    <th className="py-3 px-4">Référence</th>
                    <th className="py-3 px-4">Motif & Campus</th>
                    <th className="py-3 px-4">Entrée (Jour · Date · Heure)</th>
                    <th className="py-3 px-4">Sortie (Jour · Date · Heure)</th>
                    <th className="py-3 px-4">Statut Accès</th>
                    {canOperateGate && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e7ef]">
                  {filteredSessions.map((g) => {
                    const entryDay = g.jour || getFrenchWeekday(g.date);
                    const exitDay = g.jourSortie || (g.dateSortie ? getFrenchWeekday(g.dateSortie) : entryDay);
                    return (
                      <tr key={g.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <p className="font-medium text-[#161e2e]">{g.nomComplet}</p>
                          <p className="text-xs text-slate-500">{g.typePersonne}</p>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-[#0b1f3f]">{g.reference}</td>
                        <td className="py-3 px-4 text-xs text-slate-700">
                          {g.motif} · {g.campus}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-[#161e2e]">
                          {g.heureEntree && g.heureEntree !== '—'
                            ? `${entryDay} ${formatFrenchDate(g.date)} · ${g.heureEntree}`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600">
                          {g.heureSortie
                            ? `${exitDay} ${formatFrenchDate(g.dateSortie || g.date)} · ${g.heureSortie}`
                            : 'En campus'}
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
                        {canOperateGate && (
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {!g.heureSortie ? (
                                <button
                                  type="button"
                                  onClick={() => onMarkExit(g.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#e0a526] hover:bg-[#c58b12] text-xs font-bold text-[#07142b] cursor-pointer"
                                >
                                  <LogOut className="w-3 h-3" />
                                  Marquer Sortie
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
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Printable Gate Log / Movement History */}
      {printLogs && (
        <PrintModal
          title={
            activeTab === 'historique'
              ? 'Historique des Mouvements (Entrées & Sorties) — Guérite'
              : 'Registre de Contrôle d’Accès — Guérite Principale'
          }
          subtitle={`Campus : ${campusFilter === 'Tous' ? 'Pointe-Noire & Brazzaville' : campusFilter}`}
          onClose={() => setPrintLogs(false)}
        >
          <div className="space-y-4 text-xs">
            <OfficialDocumentHeader
              campus={campusFilter === 'Tous' ? 'Pointe-Noire & Brazzaville' : campusFilter}
              docTitle={
                activeTab === 'historique'
                  ? 'Historique Chronologique des Mouvements'
                  : 'Main Courante Guérite Principale'
              }
              docRef={`GUE-${todayISO}`}
            />
            {activeTab === 'historique' ? (
              <table className="w-full text-left border-collapse border border-[#e3e7ef]">
                <thead>
                  <tr className="bg-[#0b1f3f] text-white text-[11px] uppercase">
                    <th className="py-2 px-3">Mouvement</th>
                    <th className="py-2 px-3">Jour</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Heure</th>
                    <th className="py-2 px-3">Personne</th>
                    <th className="py-2 px-3">Référence</th>
                    <th className="py-2 px-3">Motif</th>
                    <th className="py-2 px-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e7ef]">
                  {filteredMovements.map((ev) => (
                    <tr key={ev.id}>
                      <td className="py-2 px-3 font-bold">{ev.mouvement}</td>
                      <td className="py-2 px-3">{ev.jour}</td>
                      <td className="py-2 px-3 font-mono tabular-nums">
                        {formatFrenchDate(ev.date)}
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums">{ev.heure}</td>
                      <td className="py-2 px-3 font-medium">
                        {ev.nomComplet} ({ev.typePersonne})
                      </td>
                      <td className="py-2 px-3 font-mono">{ev.reference}</td>
                      <td className="py-2 px-3">{ev.motif}</td>
                      <td className="py-2 px-3">{ev.statutAcces}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse border border-[#e3e7ef]">
                <thead>
                  <tr className="bg-[#0b1f3f] text-white text-[11px] uppercase">
                    <th className="py-2 px-3">Personne</th>
                    <th className="py-2 px-3">Référence</th>
                    <th className="py-2 px-3">Motif</th>
                    <th className="py-2 px-3">Entrée (Jour · Date · Heure)</th>
                    <th className="py-2 px-3">Sortie (Jour · Date · Heure)</th>
                    <th className="py-2 px-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e7ef]">
                  {filteredSessions.map((g) => {
                    const entryDay = g.jour || getFrenchWeekday(g.date);
                    const exitDay =
                      g.jourSortie || (g.dateSortie ? getFrenchWeekday(g.dateSortie) : entryDay);
                    return (
                      <tr key={g.id}>
                        <td className="py-2 px-3 font-medium">
                          {g.nomComplet} ({g.typePersonne})
                        </td>
                        <td className="py-2 px-3 font-mono">{g.reference}</td>
                        <td className="py-2 px-3">{g.motif}</td>
                        <td className="py-2 px-3 font-mono tabular-nums">
                          {g.heureEntree && g.heureEntree !== '—'
                            ? `${entryDay} ${formatFrenchDate(g.date)} · ${g.heureEntree}`
                            : '—'}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums">
                          {g.heureSortie
                            ? `${exitDay} ${formatFrenchDate(g.dateSortie || g.date)} · ${g.heureSortie}`
                            : 'En campus'}
                        </td>
                        <td className="py-2 px-3">{g.statutAcces}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </PrintModal>
      )}
    </div>
  );
}
