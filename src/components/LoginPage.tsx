import {
  AlertCircle,
  Building2,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  Shield,
} from 'lucide-react';
import React, { useState } from 'react';
import { CEREC_LOGO_URL } from '../data/seedData';
import { Campus, UserRole } from '../types/cerec';

export interface AuthSession {
  email: string;
  displayName: string;
  role: UserRole;
  campus: Campus | 'Tous';
  remember: boolean;
  loggedInAt: string;
}

interface LoginPageProps {
  activeAcademicYear: string;
  onLogin: (session: AuthSession) => void;
}

interface ProfilePreset {
  role: UserRole;
  shortLabel: string;
  displayName: string;
  email: string;
  defaultCampus: Campus | 'Tous';
}

const PROFILE_PRESETS: ProfilePreset[] = [
  {
    role: 'admin',
    shortLabel: 'Admin Général',
    displayName: 'Administrateur Général',
    email: 'admin@cerec-iscom.cg',
    defaultCampus: 'Tous',
  },
  {
    role: 'direction',
    shortLabel: 'Direction',
    displayName: 'Direction Académique',
    email: 'direction@cerec-iscom.cg',
    defaultCampus: 'Tous',
  },
  {
    role: 'scolarite',
    shortLabel: 'Scolarité',
    displayName: 'Service Scolarité & Examens',
    email: 'scolarite@cerec-iscom.cg',
    defaultCampus: 'Pointe-Noire',
  },
  {
    role: 'caisse',
    shortLabel: 'Caisse',
    displayName: 'Caisse & Recouvrement',
    email: 'caisse@cerec-iscom.cg',
    defaultCampus: 'Pointe-Noire',
  },
  {
    role: 'enseignant',
    shortLabel: 'Enseignant',
    displayName: 'Corps Professoral',
    email: 'enseignant@cerec-iscom.cg',
    defaultCampus: 'Tous',
  },
  {
    role: 'surveillance',
    shortLabel: 'Guérite',
    displayName: 'Surveillance & Guérite',
    email: 'guerite@cerec-iscom.cg',
    defaultCampus: 'Pointe-Noire',
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({
  activeAcademicYear,
  onLogin,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [email, setEmail] = useState<string>('admin@cerec-iscom.cg');
  const [password, setPassword] = useState<string>('CEREC@2026');
  const [campus, setCampus] = useState<Campus | 'Tous'>('Tous');
  const [remember, setRemember] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showHelpNotice, setShowHelpNotice] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectPreset = (preset: ProfilePreset) => {
    setSelectedRole(preset.role);
    setEmail(preset.email);
    setCampus(preset.defaultCampus);
    if (!password) {
      setPassword('CEREC@2026');
    }
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || cleanEmail.length < 3 || !cleanEmail.includes('@')) {
      setError('Veuillez saisir une adresse email institutionnelle valide (ex. direction@cerec-iscom.cg).');
      return;
    }
    if (!password || password.trim().length < 4) {
      setError('Veuillez saisir votre mot de passe (au moins 4 caractères).');
      return;
    }

    const matchedPreset = PROFILE_PRESETS.find((p) => p.role === selectedRole);
    const localName = cleanEmail.split('@')[0];
    const formattedName =
      matchedPreset?.email.toLowerCase() === cleanEmail.toLowerCase()
        ? matchedPreset.displayName
        : localName.charAt(0).toUpperCase() + localName.slice(1);

    setError(null);
    onLogin({
      email: cleanEmail,
      displayName: formattedName,
      role: selectedRole,
      campus,
      remember,
      loggedInAt: new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 bg-[#07142b] overflow-hidden select-none">
      {/* Full-viewport CEREC-ISCOM Logo Backdrop */}
      <img
        src={CEREC_LOGO_URL}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover object-center opacity-30 scale-105 pointer-events-none"
      />
      {/* Measured Navy Scrim for Logo Visibility & High Foreground Contrast */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-[#07142b]/88 via-[#0b1f3f]/72 to-[#07142b]/90"
      />

      {/* Centered Institutional Login Card */}
      <div className="relative z-10 w-full max-w-[470px] bg-white/95 backdrop-blur-md rounded-2xl border border-white/25 shadow-2xl overflow-hidden">
        {/* Top Navy Header with Crest */}
        <div className="bg-[#0b1f3f] px-6 py-5 border-b-2 border-[#e0a526] flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white p-1.5 shrink-0 flex items-center justify-center border border-[#e0a526]/40">
            <img
              src={CEREC_LOGO_URL}
              alt="Logo Groupe CEREC-ISCOM"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-serif text-xl font-bold text-white tracking-tight truncate">
              Groupe CEREC-ISCOM
            </h1>
            <p className="text-xs text-[#eab33a] font-medium truncate">
              Portail de Gestion Académique LMD
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5 tabular-nums truncate">
              Année académique {activeAcademicYear} · Congo
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#0b1f3f]">
              Connexion à l’espace institutionnel
            </h2>
            <p className="text-xs text-slate-500">
              Identifiez-vous pour accéder aux modules académiques, financiers et administratifs.
            </p>
          </div>

          {/* Quick Role Access Selector */}
          <div className="space-y-1.5">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Accès rapide par profil
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {PROFILE_PRESETS.map((preset) => {
                const active = selectedRole === preset.role;
                return (
                  <button
                    key={preset.role}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer truncate ${
                      active
                        ? 'bg-[#0b1f3f] text-white border-[#0b1f3f]'
                        : 'bg-[#f8f9fb] text-[#161e2e] border-[#e3e7ef] hover:border-[#0b1f3f]/40 hover:bg-slate-100'
                    }`}
                  >
                    {preset.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="login-email"
              className="block text-xs font-semibold text-[#161e2e]"
            >
              Identifiant ou Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="ex. direction@cerec-iscom.cg"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#e3e7ef] bg-[#f8f9fb] text-sm text-[#161e2e] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#0b1f3f]"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[#161e2e]"
              >
                Mot de passe
              </label>
              <button
                type="button"
                onClick={() => setShowHelpNotice((v) => !v)}
                className="text-[11px] font-medium text-[#0b1f3f] hover:underline cursor-pointer"
              >
                Mot de passe oublié ?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Saisissez votre mot de passe"
                className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-[#e3e7ef] bg-[#f8f9fb] text-sm text-[#161e2e] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#0b1f3f]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-[#0b1f3f] cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {showHelpNotice && (
            <div className="p-3 rounded-lg bg-[#fff4d6] border border-[#e0a526]/40 text-xs text-[#0b1f3f] leading-relaxed">
              Mot de passe de démonstration : <span className="font-mono font-bold">CEREC@2026</span>.
              Pour réinitialiser un compte nominatif, contactez l’Administrateur Général.
            </div>
          )}

          {/* Role & Campus */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="login-role"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#161e2e]"
              >
                <Shield className="w-3.5 h-3.5 text-[#c58b12]" />
                Espace
              </label>
              <select
                id="login-role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 rounded-lg border border-[#e3e7ef] bg-[#f8f9fb] text-xs font-semibold text-[#0b1f3f] focus:outline-none focus:bg-white focus:border-[#0b1f3f]"
              >
                {PROFILE_PRESETS.map((p) => (
                  <option key={p.role} value={p.role}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="login-campus"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#161e2e]"
              >
                <Building2 className="w-3.5 h-3.5 text-[#c58b12]" />
                Campus
              </label>
              <select
                id="login-campus"
                value={campus}
                onChange={(e) => setCampus(e.target.value as Campus | 'Tous')}
                className="w-full px-3 py-2 rounded-lg border border-[#e3e7ef] bg-[#f8f9fb] text-xs font-semibold text-[#0b1f3f] focus:outline-none focus:bg-white focus:border-[#0b1f3f]"
              >
                <option value="Tous">Tous les campus</option>
                <option value="Pointe-Noire">Campus Pointe-Noire</option>
                <option value="Brazzaville">Campus Brazzaville</option>
              </select>
            </div>
          </div>

          {/* Remember Session */}
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border-[#e3e7ef] text-[#0b1f3f] focus:ring-[#0b1f3f]"
            />
            Rester connecté sur cet appareil
          </label>

          {/* Submit */}
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-sm font-bold transition-colors shadow-sm cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Se connecter
          </button>
        </form>

        {/* Institutional Footer */}
        <div className="px-6 py-3.5 bg-[#f8f9fb] border-t border-[#e3e7ef] flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="truncate">Pointe-Noire & Brazzaville</span>
          <span className="shrink-0 font-medium text-[#0b1f3f]">République du Congo</span>
        </div>
      </div>
    </div>
  );
};
