import {
  AlertCircle,
  Archive,
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Lock,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sliders,
  Upload,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { CerecState, LmdSettings, UserRole } from '../../types/cerec';
import {
  ArchiveImportResult,
  computeAcademicYearStats,
  exportCerecToExcel,
  formatFCFA,
  getAvailableAcademicYears,
  importArchivesFromFile,
} from '../../utils/lmd';
import { COMPARTMENT_ACCOUNTS, ORDERED_ROLES } from '../../utils/permissions';

interface SecurityAuditData {
  posture: {
    dbEncryption: string;
    passwordHashing: string;
    sessionProtection: string;
    xssProtection: string;
    xxeProtection: string;
    apiKeysServerOnly: boolean;
    geminiKeyConfigured: boolean;
    rateLimitingActive: boolean;
    auditCount: number;
  };
  auditLogs: {
    id: string;
    timestamp: string;
    severity: 'info' | 'warning' | 'critical';
    event: string;
    actor: string;
    ip: string;
    detail: string;
  }[];
}

interface SettingsViewProps {
  state: CerecState;
  activeRole: UserRole;
  csrfToken?: string | null;
  canSwitchRoles?: boolean;
  canManageSettings?: boolean;
  canCreateAcademicYear?: boolean;
  canManageTrimesters?: boolean;
  onChangeRole: (role: UserRole) => void;
  onUpdateSettings: (settings: LmdSettings) => void;
  onImportState: (nextState: CerecState) => void;
  onOpenCreateYear: () => void;
  onOpenCreateTrimester: () => void;
  onActivateYear: (year: string) => void;
  onActivateTrimester: (trimesterId: string) => void;
  onResetDemo: () => void;
  onNotify: (msg: string) => void;
}

export function SettingsView({
  state,
  activeRole,
  csrfToken,
  canSwitchRoles = false,
  canManageSettings = true,
  canCreateAcademicYear = true,
  canManageTrimesters = true,
  onChangeRole,
  onUpdateSettings,
  onImportState,
  onOpenCreateYear,
  onOpenCreateTrimester,
  onActivateYear,
  onActivateTrimester,
  onResetDemo,
  onNotify,
}: SettingsViewProps) {
  const [form, setForm] = useState<LmdSettings>({ ...state.settings });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ArchiveImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [lastImportSummary, setLastImportSummary] = useState<string | null>(null);
  const [rotatingEmail, setRotatingEmail] = useState<string | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<{
    email: string;
    compartment: string;
    password: string;
  } | null>(null);
  const [securityAudit, setSecurityAudit] = useState<SecurityAuditData | null>(null);

  useEffect(() => {
    setForm({ ...state.settings });
  }, [state.settings]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/security/audit', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SecurityAuditData | null) => {
        if (!cancelled && data?.posture) {
          setSecurityAudit(data);
        }
      })
      .catch(() => {
        // ignore if audit endpoint unavailable
      });
    return () => {
      cancelled = true;
    };
  }, [rotatedSecret]);

  const handleRotatePassword = async (email: string, compartment: string) => {
    if (!canManageSettings || !csrfToken || rotatingEmail) return;
    setRotatingEmail(email);
    try {
      const res = await fetch('/api/auth/rotate-password', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        newPassword?: string;
        error?: string;
      };
      if (!res.ok || !data.newPassword) {
        onNotify(data.error ?? 'Impossible de renouveler le mot de passe.');
        return;
      }
      setRotatedSecret({ email, compartment, password: data.newPassword });
      onNotify(`Mot de passe renouvelé côté serveur pour ${compartment}.`);
    } catch {
      onNotify('Erreur réseau lors du renouvellement du mot de passe.');
    } finally {
      setRotatingEmail(null);
    }
  };

  const allYears = getAvailableAcademicYears(state);
  const priorYears = allYears.filter((y) => y !== state.settings.anneeAcademique);
  const [selectedArchiveYear, setSelectedArchiveYear] = useState(
    priorYears[priorYears.length - 1] ?? allYears[0] ?? state.settings.anneeAcademique
  );

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSettings) return;
    onUpdateSettings(form);
    onNotify('Paramètres LMD et seuils campus enregistrés.');
  };

  const handleTriggerImport = () => {
    if (!canManageSettings) return;
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleArchiveFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canManageSettings) return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setLastImportSummary(null);
    try {
      const result = await importArchivesFromFile(file, state);
      setImportPreview(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Impossible de lire le fichier d'archive sélectionné.";
      setImportError(message);
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = () => {
    if (!canManageSettings || !importPreview) return;
    onImportState(importPreview.nextState);
    const yearsLabel =
      importPreview.yearsImported.length > 0
        ? importPreview.yearsImported.join(', ')
        : 'Archives';
    const summary = `${importPreview.fileName} (${yearsLabel}) : ${importPreview.studentsAdded} inscrit(s) ajouté(s), ${importPreview.studentsUpdated} mis à jour, ${importPreview.gradesAdded} note(s), ${importPreview.paymentsAdded} reçu(s) FCFA, ${importPreview.uesAdded} UE(s).`;
    setLastImportSummary(summary);
    setImportPreview(null);
    onNotify(`Archives importées avec succès (${yearsLabel}).`);
  };

  return (
    <div className="space-y-6">
      {/* Role & Access Profiles */}
      <div className="bg-white border border-[#e3e7ef] rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#e3e7ef]">
          <Shield className="w-4 h-4 text-[#0b1f3f]" />
          <div>
            <h3 className="text-sm font-semibold text-[#161e2e]">
              Profils d’accès & Rôles fonctionnels
            </h3>
            <p className="text-xs text-slate-500">
              {canSwitchRoles
                ? 'Basculez instantanément entre les espaces métiers de CEREC-ISCOM.'
                : 'Cartographie officielle des accès et missions par profil (consultation seule).'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {ORDERED_ROLES.map((r) => {
            const active = activeRole === r.id;
            const scopeLine = `${r.allowedModules.length} rubrique(s)${
              r.permissions.readOnly ? ' · Lecture seule' : ''
            }`;
            const cardClasses = `text-left p-4 rounded-lg border transition-colors ${
              active
                ? 'bg-[#0b1f3f] text-white border-[#0b1f3f]'
                : canSwitchRoles
                ? 'bg-white text-[#161e2e] border-[#e3e7ef] hover:border-[#0b1f3f] cursor-pointer'
                : 'bg-white text-[#161e2e] border-[#e3e7ef]'
            }`;
            const content = (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">{r.label}</span>
                  <span
                    className={`text-[11px] font-semibold ${
                      active ? 'text-[#eab33a]' : 'text-slate-400'
                    }`}
                  >
                    {active ? 'Actif' : scopeLine}
                  </span>
                </div>
                <p
                  className={`text-xs mt-1.5 leading-relaxed ${
                    active ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {r.mission}
                </p>
              </>
            );
            return canSwitchRoles ? (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onChangeRole(r.id);
                  onNotify(`Profil activé : ${r.label}`);
                }}
                className={cardClasses}
              >
                {content}
              </button>
            ) : (
              <div key={r.id} className={cardClasses}>
                {content}
              </div>
            );
          })}
        </div>
      </div>

      {/* Compartment Access Credentials Directory */}
      <div className="bg-white border border-[#e3e7ef] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e3e7ef] bg-[#f8f9fb] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#c58b12]" />
            <div>
              <h3 className="text-sm font-semibold text-[#161e2e]">
                Annuaire sécurisé des compartiments ({COMPARTMENT_ACCOUNTS.length})
              </h3>
              <p className="text-xs text-slate-500">
                Mots de passe hachés côté serveur (scrypt) — aucun secret n’est stocké en clair dans le navigateur
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
            <Lock className="w-3.5 h-3.5" />
            Stockage chiffré AES-256-GCM
          </span>
        </div>

        {rotatedSecret && (
          <div className="mx-5 mt-4 p-3.5 rounded-lg bg-[#fff4d6] border border-[#e0a526] text-xs text-[#0b1f3f] flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold">
                Nouveau mot de passe généré (affichage unique) — {rotatedSecret.compartment}
              </p>
              <p className="mt-1 font-mono">
                Mail : <strong>{rotatedSecret.email}</strong> · Mot de passe :{' '}
                <strong className="bg-white px-2 py-0.5 rounded border border-[#e0a526]">
                  {rotatedSecret.password}
                </strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `${rotatedSecret.compartment}\nMail : ${rotatedSecret.email}\nMot de passe : ${rotatedSecret.password}`
                  );
                  onNotify('Nouveaux identifiants copiés.');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#0b1f3f] text-white font-semibold cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                Copier
              </button>
              <button
                type="button"
                onClick={() => setRotatedSecret(null)}
                aria-label="Fermer le mot de passe temporaire"
                className="p-1 text-slate-600 hover:text-[#0b1f3f] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#e3e7ef] text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-white">
                <th className="py-3 px-4">Compartiment / Service</th>
                <th className="py-3 px-4">Campus</th>
                <th className="py-3 px-4">Adresse mail</th>
                <th className="py-3 px-4">Protection</th>
                <th className="py-3 px-4">Périmètre d’accès</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e7ef]">
              {COMPARTMENT_ACCOUNTS.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 font-semibold text-[#161e2e]">
                    {acc.compartment}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                      {acc.campus}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[#0b1f3f] font-medium">
                    {acc.email}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-emerald-700">
                    scrypt · Cookie HttpOnly
                  </td>
                  <td className="py-2.5 px-4 text-slate-500">{acc.scopeSummary}</td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(acc.email);
                          onNotify(`Adresse mail copiée : ${acc.email}`);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#e3e7ef] hover:border-[#0b1f3f] text-[#0b1f3f] font-semibold cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        Copier mail
                      </button>
                      {canManageSettings && (
                        <button
                          type="button"
                          disabled={rotatingEmail === acc.email}
                          onClick={() => handleRotatePassword(acc.email, acc.compartment)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0b1f3f] hover:bg-[#143263] disabled:opacity-50 text-white font-semibold cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3 text-[#eab33a]" />
                          {rotatingEmail === acc.email ? 'Rotation…' : 'Renouveler'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Security & Encrypted DB Audit Summary */}
      {securityAudit && (
        <div className="bg-white border border-[#e3e7ef] rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#e3e7ef]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <div>
                <h3 className="text-sm font-semibold text-[#161e2e]">
                  Posture de Sécurité & Base de Données Chiffrée
                </h3>
                <p className="text-xs text-slate-500">
                  Contrôles actifs en temps réel sur le serveur CEREC-ISCOM
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
              {securityAudit.posture.auditCount} événement(s) tracé(s)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#f8f9fb] border border-[#e3e7ef]">
              <p className="text-slate-500">Base de données</p>
              <p className="font-semibold text-[#0b1f3f] mt-0.5">
                {securityAudit.posture.dbEncryption}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#f8f9fb] border border-[#e3e7ef]">
              <p className="text-slate-500">Clés API & Secrets</p>
              <p className="font-semibold text-emerald-700 mt-0.5">
                Strictement côté serveur (0 exposition client)
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#f8f9fb] border border-[#e3e7ef]">
              <p className="text-slate-500">Protection XSS / XXE / CSRF</p>
              <p className="font-semibold text-[#0b1f3f] mt-0.5">
                DOMPurify · CSP · Anti-XXE · Jeton CSRF
              </p>
            </div>
          </div>

          {securityAudit.auditLogs.length > 0 && (
            <div className="overflow-x-auto border border-[#e3e7ef] rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f8f9fb] border-b border-[#e3e7ef] text-[11px] uppercase text-slate-500">
                    <th className="py-2 px-3">Horodatage</th>
                    <th className="py-2 px-3">Événement</th>
                    <th className="py-2 px-3">Acteur</th>
                    <th className="py-2 px-3">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3e7ef]">
                  {securityAudit.auditLogs.slice(0, 8).map((ev) => (
                    <tr key={ev.id}>
                      <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">
                        {ev.timestamp.replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-mono text-[11px] font-semibold ${
                            ev.severity === 'critical'
                              ? 'bg-red-50 text-red-700'
                              : ev.severity === 'warning'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {ev.event}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-medium text-[#161e2e]">{ev.actor}</td>
                      <td className="py-2 px-3 text-slate-600">{ev.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* LMD Parameters & Data Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSaveSettings}
          className="lg:col-span-7 bg-white border border-[#e3e7ef] rounded-lg p-5 space-y-4"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-[#e3e7ef]">
            <Sliders className="w-4 h-4 text-[#c58b12]" />
            <h3 className="text-sm font-semibold text-[#161e2e]">
              Règles Académiques LMD & Seuils de Contrôle
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Année académique en cours
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={form.anneeAcademique}
                  disabled={!canManageSettings}
                  onChange={(e) => setForm({ ...form, anneeAcademique: e.target.value })}
                  className="flex-1 min-w-[130px] px-3 py-2 text-sm font-mono font-semibold border border-[#e3e7ef] rounded-lg bg-white disabled:bg-[#f8f9fb] disabled:text-[#161e2e]"
                >
                  {allYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                {canCreateAcademicYear && (
                  <button
                    type="button"
                    onClick={onOpenCreateYear}
                    title="Créer une nouvelle année académique"
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    Nouvelle
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Trimestre actif ({form.anneeAcademique})
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  disabled={!canManageSettings}
                  value={
                    form.trimestreActifId ??
                    (state.trimestres ?? []).find(
                      (t) => t.anneeAcademique === form.anneeAcademique
                    )?.id ??
                    ''
                  }
                  onChange={(e) => {
                    const id = e.target.value;
                    setForm({ ...form, trimestreActifId: id || undefined });
                    if (id) onActivateTrimester(id);
                  }}
                  className="flex-1 min-w-[130px] px-3 py-2 text-sm font-semibold border border-[#e3e7ef] rounded-lg bg-white text-[#0b1f3f] disabled:bg-[#f8f9fb] disabled:text-[#161e2e]"
                >
                  {(state.trimestres ?? []).filter(
                    (t) => t.anneeAcademique === form.anneeAcademique
                  ).length === 0 ? (
                    <option value="">Aucun trimestre défini</option>
                  ) : (
                    (state.trimestres ?? [])
                      .filter((t) => t.anneeAcademique === form.anneeAcademique)
                      .sort((a, b) => a.code.localeCompare(b.code))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.code} — {t.nom}
                        </option>
                      ))
                  )}
                </select>
                {canManageTrimesters && (
                  <button
                    type="button"
                    onClick={onOpenCreateTrimester}
                    title="Créer un trimestre ou générer T1, T2, T3"
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-[#0b1f3f] hover:bg-slate-50 text-[#0b1f3f] text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    <CalendarRange className="w-3.5 h-3.5 text-[#c58b12]" />
                    Créer
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Seuil de validation UE (/20)
              </label>
              <input
                type="number"
                step="0.5"
                min={8}
                max={14}
                readOnly={!canManageSettings}
                disabled={!canManageSettings}
                value={form.seuilValidation}
                onChange={(e) => setForm({ ...form, seuilValidation: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg disabled:bg-[#f8f9fb] disabled:text-[#161e2e]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Pondération Contrôle Continu (0–1)
              </label>
              <input
                type="number"
                step="0.1"
                min={0.1}
                max={0.9}
                readOnly={!canManageSettings}
                disabled={!canManageSettings}
                value={form.poidsCC}
                onChange={(e) => {
                  const cc = Number(e.target.value);
                  setForm({ ...form, poidsCC: cc, poidsExamen: Number((1 - cc).toFixed(2)) });
                }}
                className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg disabled:bg-[#f8f9fb] disabled:text-[#161e2e]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Pondération Examen (auto)
              </label>
              <input
                type="number"
                readOnly
                value={form.poidsExamen}
                className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg bg-slate-50 text-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Seuil d’alerte absences répétées
              </label>
              <input
                type="number"
                min={1}
                max={10}
                readOnly={!canManageSettings}
                disabled={!canManageSettings}
                value={form.seuilAbsencesAlerte}
                onChange={(e) =>
                  setForm({ ...form, seuilAbsencesAlerte: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg disabled:bg-[#f8f9fb] disabled:text-[#161e2e]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Seuil recouvrement Guérite (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                readOnly={!canManageSettings}
                disabled={!canManageSettings}
                value={form.seuilBlocagePortailPct}
                onChange={(e) =>
                  setForm({ ...form, seuilBlocagePortailPct: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm font-mono border border-[#e3e7ef] rounded-lg disabled:bg-[#f8f9fb] disabled:text-[#161e2e]"
              />
            </div>
          </div>

          {canManageSettings && (
            <div className="pt-3 border-t border-[#e3e7ef] flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold cursor-pointer"
              >
                Enregistrer les paramètres
              </button>
            </div>
          )}
        </form>

        {/* Export & Reset */}
        <div className="lg:col-span-5 bg-white border border-[#e3e7ef] rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#e3e7ef]">
            <Archive className="w-4 h-4 text-[#0b1f3f]" />
            <h3 className="text-sm font-semibold text-[#161e2e]">
              Exportation & Maintenance des données
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Générez un classeur Excel multi-onglets classé par année académique (Synthèse,
            Étudiants, Notes, Caisse FCFA et Maquettes LMD).
          </p>
          <div className="space-y-3 pt-1">
            {canManageSettings && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleArchiveFileChange}
                  className="hidden"
                  aria-label="Sélectionner un fichier d'archives des années antérieures"
                />

                <button
                  type="button"
                  disabled={importing}
                  onClick={handleTriggerImport}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-[#eab33a]" />
                  {importing
                    ? 'Analyse du fichier en cours…'
                    : 'Importer des archives (.xlsx / .csv)'}
                </button>
              </>
            )}

            {importError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="flex-1 leading-relaxed">{importError}</span>
                <button
                  type="button"
                  onClick={() => setImportError(null)}
                  aria-label="Fermer l'alerte d'importation"
                  className="text-red-500 hover:text-red-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {lastImportSummary && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="flex-1 leading-relaxed">{lastImportSummary}</span>
                <button
                  type="button"
                  onClick={() => setLastImportSummary(null)}
                  aria-label="Fermer la confirmation d'importation"
                  className="text-emerald-600 hover:text-emerald-800 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={priorYears.length === 0}
              onClick={() => {
                exportCerecToExcel(state, { scope: 'prior' });
                onNotify(
                  `Archive des années antérieures (${priorYears.join(', ')}) exportée (.xlsx).`
                );
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] disabled:opacity-50 text-[#07142b] text-xs font-bold cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Exporter les années antérieures ({priorYears.length}) (.xlsx)
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedArchiveYear}
                onChange={(e) => setSelectedArchiveYear(e.target.value)}
                aria-label="Choisir une année académique à exporter"
                className="flex-1 min-w-[140px] px-3 py-2 text-xs font-mono font-semibold border border-[#e3e7ef] rounded-lg bg-white text-[#161e2e]"
              >
                {allYears.map((y) => (
                  <option key={y} value={y}>
                    {y} {y === state.settings.anneeAcademique ? '(En cours)' : '(Antérieure)'}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  exportCerecToExcel(state, { scope: 'single', targetYear: selectedArchiveYear });
                  onNotify(`Archive ${selectedArchiveYear} exportée (.xlsx).`);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-[#eab33a]" />
                Exporter l’année
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                exportCerecToExcel(state, { scope: 'all' });
                onNotify('Export complet classé par année académique généré (.xlsx).');
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#0b1f3f] hover:bg-slate-50 text-[#0b1f3f] text-xs font-semibold cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Exporter toutes les années classées (.xlsx)
            </button>

            {canManageSettings && (
              <button
                type="button"
                onClick={onResetDemo}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-700 text-xs font-semibold cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Réinitialiser les données de démonstration
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Archives Table Grouped by Academic Year */}
      <div className="bg-white border border-[#e3e7ef] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e3e7ef] bg-[#f8f9fb] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#161e2e]">
              Données classées par Année Académique ({allYears.length} exercice(s))
            </h3>
            <p className="text-xs text-slate-500">
              Aperçu consolidé des archives antérieures et de l’année en cours (import & export Excel)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canCreateAcademicYear && (
              <button
                type="button"
                onClick={onOpenCreateYear}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Nouvelle année académique
              </button>
            )}
            {canManageSettings && (
              <button
                type="button"
                disabled={importing}
                onClick={handleTriggerImport}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#0b1f3f] bg-white hover:bg-slate-50 disabled:opacity-50 text-[#0b1f3f] text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                Importer archives
              </button>
            )}
            {priorYears.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  exportCerecToExcel(state, { scope: 'prior' });
                  onNotify('Export des années antérieures téléchargé (.xlsx).');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-[#eab33a]" />
                Tout exporter (Années antérieures)
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e3e7ef] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Année académique</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4 text-right">Étudiants</th>
                <th className="py-3 px-4 text-right">Moy. LMD</th>
                <th className="py-3 px-4 text-right">Réussite</th>
                <th className="py-3 px-4 text-right">Encaissé (FCFA)</th>
                <th className="py-3 px-4 text-right">Recouvrement</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e7ef]">
              {allYears.map((y) => {
                const st = computeAcademicYearStats(state, y);
                const isCurrent = y === state.settings.anneeAcademique;
                return (
                  <tr key={y} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-[#0b1f3f]">{y}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          isCurrent
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isCurrent ? 'Année en cours' : 'Archive / Exercice'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {st.studentCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {st.moyenneGenerale !== null ? `${st.moyenneGenerale.toFixed(2)} / 20` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {st.tauxReussite}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-[#161e2e] tabular-nums">
                      {formatFCFA(st.totalEncaisseCaisse)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {st.tauxRecouvrement}%
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        {canManageSettings && !isCurrent && (
                          <button
                            type="button"
                            onClick={() => onActivateYear(y)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#e0a526] bg-[#e0a526]/15 hover:bg-[#e0a526]/30 text-xs font-semibold text-[#07142b] cursor-pointer whitespace-nowrap"
                          >
                            Activer
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            exportCerecToExcel(state, { scope: 'single', targetYear: y });
                            onNotify(`Export Excel ${y} téléchargé.`);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#e3e7ef] hover:border-[#0b1f3f] text-xs font-semibold text-[#0b1f3f] cursor-pointer whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Exporter {y}
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

      {/* In-App Confirmation Modal for Archive Import */}
      {canManageSettings && importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142b]/70 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-[#e3e7ef] rounded-xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto my-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#161e2e]">
                  Confirmer l’importation des archives
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5 break-all">
                  {importPreview.fileName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                aria-label="Fermer la fenêtre d'importation"
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-lg bg-[#f8f9fb] border border-[#e3e7ef] p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Années académiques détectées</span>
                <span className="font-mono font-bold text-[#0b1f3f]">
                  {importPreview.yearsImported.length > 0
                    ? importPreview.yearsImported.join(', ')
                    : 'Non spécifiée'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#e3e7ef]">
                <div className="flex items-center justify-between bg-white px-3 py-2 rounded border border-[#e3e7ef]">
                  <span className="text-slate-600">Nouveaux étudiants</span>
                  <span className="font-mono font-bold text-[#0b1f3f]">
                    +{importPreview.studentsAdded}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-white px-3 py-2 rounded border border-[#e3e7ef]">
                  <span className="text-slate-600">Étudiants mis à jour</span>
                  <span className="font-mono font-bold text-[#0b1f3f]">
                    {importPreview.studentsUpdated}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-white px-3 py-2 rounded border border-[#e3e7ef]">
                  <span className="text-slate-600">Notes importées</span>
                  <span className="font-mono font-bold text-[#0b1f3f]">
                    +{importPreview.gradesAdded}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-white px-3 py-2 rounded border border-[#e3e7ef]">
                  <span className="text-slate-600">Reçus caisse FCFA</span>
                  <span className="font-mono font-bold text-[#0b1f3f]">
                    +{importPreview.paymentsAdded}
                  </span>
                </div>
                <div className="col-span-2 flex items-center justify-between bg-white px-3 py-2 rounded border border-[#e3e7ef]">
                  <span className="text-slate-600">Nouvelles UE ajoutées à la maquette</span>
                  <span className="font-mono font-bold text-[#0b1f3f]">
                    +{importPreview.uesAdded}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Les doublons (même code UE, même numéro de reçu ou même couple matricule / année
              académique) sont automatiquement dédupliqués sans écraser l’année en cours.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className="px-4 py-2 rounded-lg border border-[#e3e7ef] text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#eab33a]" />
                Confirmer l’importation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
