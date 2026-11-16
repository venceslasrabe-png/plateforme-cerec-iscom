import {
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
} from 'lucide-react';
import React, { useState } from 'react';
import { CEREC_LOGO_URL } from '../data/seedData';
import { Campus, UserRole } from '../types/cerec';
import { sanitizeText } from '../utils/security';

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
  onLogin: (session: AuthSession, csrfToken: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  activeAcademicYear,
  onLogin,
}) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [remember, setRemember] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showHelpNotice, setShowHelpNotice] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const cleanEmail = sanitizeText(email, 180).toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError(
        'Veuillez saisir une adresse mail valide (ex. dg@cerec-iscom.cg).'
      );
      return;
    }
    if (!password.trim()) {
      setError('Veuillez saisir le mot de passe de votre compartiment.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          remember,
        }),
      });
      const data = (await res.json()) as {
        session?: AuthSession;
        csrfToken?: string;
        error?: string;
      };
      if (!res.ok || !data.session || !data.csrfToken) {
        setError(data.error ?? 'Échec de l’authentification.');
        return;
      }
      setPassword('');
      onLogin(data.session, data.csrfToken);
    } catch {
      setError(
        'Serveur d’authentification inaccessible. Vérifiez votre connexion et réessayez.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 bg-[#07142b] overflow-y-auto select-none">
      {/* Full-viewport CEREC-ISCOM Logo Backdrop */}
      <img
        src={CEREC_LOGO_URL}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        className="fixed inset-0 w-full h-full object-cover object-center opacity-25 scale-105 pointer-events-none"
      />
      {/* Measured Navy Scrim for Contrast */}
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-gradient-to-br from-[#07142b]/90 via-[#0b1f3f]/78 to-[#07142b]/92 pointer-events-none"
      />

      {/* Side-by-Side Card: Logo on the Left + Email & Password Form on the Right */}
      <div className="relative z-10 w-full max-w-4xl bg-white rounded-2xl border border-white/25 shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* Left Column: CEREC-ISCOM Logo */}
        <div className="md:col-span-5 bg-[#0b1f3f] text-white p-6 sm:p-8 flex flex-col items-center justify-between text-center border-b-2 md:border-b-0 md:border-r-2 border-[#e0a526] gap-6">
          <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-300">
            <span className="text-[#eab33a] font-semibold">CEREC-ISCOM</span>
            <span className="tabular-nums">{activeAcademicYear}</span>
          </div>

          <div className="flex flex-col items-center gap-4 my-auto py-4">
            <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl bg-white p-4 shadow-lg border-2 border-[#e0a526] flex items-center justify-center">
              <img
                src={CEREC_LOGO_URL}
                alt="Logo Groupe CEREC-ISCOM"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#eab33a]">
                République du Congo · Système LMD
              </p>
              <h1 className="font-serif text-2xl font-bold text-white tracking-tight">
                Groupe CEREC-ISCOM
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                Institut Supérieur de Commerce et de Management · Partenariat ESTAM Bénin
              </p>
            </div>
          </div>

          <div className="w-full pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
            <span>Pointe-Noire & Brazzaville</span>
            <span className="text-[#eab33a] font-semibold">Portail Officiel</span>
          </div>
        </div>

        {/* Right Column: Clean Email & Password Login Form */}
        <form
          onSubmit={handleSubmit}
          className="md:col-span-7 p-6 sm:p-9 space-y-5 bg-white flex flex-col justify-center"
        >
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-[#0b1f3f]">Connexion</h2>
            <p className="text-xs text-slate-500">
              Saisissez votre adresse mail et votre mot de passe pour accéder à la plateforme.
            </p>
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

          {/* Email Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="login-email"
              className="block text-xs font-semibold text-[#161e2e]"
            >
              Adresse mail *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="ex. dg@cerec-iscom.cg"
                className="w-full pl-10 pr-3.5 py-3 rounded-lg border border-[#e3e7ef] bg-[#f8f9fb] text-sm text-[#161e2e] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#0b1f3f]"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[#161e2e]"
              >
                Mot de passe *
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
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Saisissez votre mot de passe"
                className="w-full pl-10 pr-10 py-3 rounded-lg border border-[#e3e7ef] bg-[#f8f9fb] text-sm text-[#161e2e] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#0b1f3f]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-[#0b1f3f] cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {showHelpNotice && (
            <div className="p-3 rounded-lg bg-[#fff4d6] border border-[#e0a526]/40 text-xs text-[#0b1f3f] space-y-1 leading-relaxed">
              <p className="font-semibold">
                Récupération d’accès par compartiment
              </p>
              <p className="text-[11px] text-slate-700">
                Chaque service dispose de son adresse mail et de son mot de passe dédié. Veuillez contacter l’Administrateur Général (<span className="font-mono font-semibold">admin@cerec-iscom.cg</span>) ou consulter la rubrique <span className="font-semibold">Rôles & Paramètres</span>.
              </p>
            </div>
          )}

          {/* Remember Session & Submit */}
          <div className="pt-1 space-y-4">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-[#e3e7ef] text-[#0b1f3f] focus:ring-[#0b1f3f]"
              />
              Rester connecté sur cet appareil
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] disabled:opacity-60 text-[#07142b] text-sm font-bold transition-colors shadow-sm cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              {submitting ? 'Vérification sécurisée…' : 'Se connecter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
