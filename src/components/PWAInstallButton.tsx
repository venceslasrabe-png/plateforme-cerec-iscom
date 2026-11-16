import { Check, Copy, Download, Smartphone, WifiOff, X } from 'lucide-react';
import React, { useState } from 'react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  onNotify?: (msg: string) => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  onNotify,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (isInstalled) {
    return null;
  }

  const appOrigin =
    typeof window !== 'undefined' ? window.location.origin : '';

  const copyAppUrl = async () => {
    if (!appOrigin) return;
    try {
      await navigator.clipboard.writeText(appOrigin);
      setCopiedUrl(true);
      onNotify?.('Adresse de l’application copiée.');
      window.setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      onNotify?.('Copie manuelle requise.');
    }
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        onNotify?.('Application CEREC-ISCOM installée sur cet appareil.');
      }
      return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        title={
          isInstallable
            ? 'Installer l’application mobile CEREC-ISCOM'
            : 'Installer sur Android / iOS ou générer l’APK via PWABuilder'
        }
        className={
          compact
            ? 'inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[#e0a526] bg-[#fff4d6] hover:bg-[#fde9b4] text-[#0b1f3f] text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer'
            : 'inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] text-[#07142b] text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer'
        }
      >
        {isInstallable ? (
          <Download className="w-3.5 h-3.5" />
        ) : (
          <Smartphone className="w-3.5 h-3.5" />
        )}
        <span>
          {isInstallable
            ? 'Installer l’App'
            : isIOS
            ? 'Installer iOS'
            : 'App Mobile / APK'}
        </span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142b]/75 p-4">
          <div className="bg-white border border-[#e3e7ef] rounded-xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-xl text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#0b1f3f] text-[#eab33a] flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0b1f3f]">
                    Installation Mobile & Fichier APK
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Groupe CEREC-ISCOM — Mode application autonome
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Fermer"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="rounded-lg bg-[#f8f9fb] border border-[#e3e7ef] p-3.5 text-xs text-slate-700 space-y-1.5">
                <p className="font-bold text-[#0b1f3f]">Installation sur iPhone / iPad</p>
                <p>1. Ouvrez la plateforme dans <strong>Safari</strong>.</p>
                <p>2. Appuyez sur le bouton <strong>Partager</strong> en bas de l’écran.</p>
                <p>3. Sélectionnez <strong>Sur l’écran d’accueil</strong> puis validez.</p>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-700">
                <div className="rounded-lg bg-[#f8f9fb] border border-[#e3e7ef] p-3.5 space-y-1.5">
                  <p className="font-bold text-[#0b1f3f]">
                    1. Installation directe sur Android (Chrome)
                  </p>
                  <p>
                    Ouvrez l’URL de l’application dans <strong>Google Chrome</strong> sur Android,
                    appuyez sur le menu <strong>⋮</strong> en haut à droite puis choisissez{' '}
                    <strong>Installer l’application</strong>.
                  </p>
                </div>

                <div className="rounded-lg bg-[#f8f9fb] border border-[#e3e7ef] p-3.5 space-y-2">
                  <p className="font-bold text-[#0b1f3f]">
                    2. Générer le fichier .apk signé (PWABuilder)
                  </p>
                  <p>
                    La plateforme expose un manifeste PWA et un Service Worker conformes. Copiez
                    l’URL publique ci-dessous et collez-la sur <strong>pwabuilder.com</strong> pour
                    télécharger le paquet Android <strong>(.apk)</strong> prêt à installer :
                  </p>
                  {appOrigin && (
                    <div className="flex items-center gap-2 pt-1">
                      <code className="flex-1 px-2.5 py-1.5 rounded bg-white border border-[#e3e7ef] font-mono text-[11px] text-[#0b1f3f] truncate">
                        {appOrigin}
                      </code>
                      <button
                        type="button"
                        onClick={copyAppUrl}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#0b1f3f] text-white text-[11px] font-semibold shrink-0 cursor-pointer"
                      >
                        {copiedUrl ? (
                          <Check className="w-3.5 h-3.5 text-[#eab33a]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-[#eab33a]" />
                        )}
                        {copiedUrl ? 'Copié' : 'Copier'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-[#b45309] border border-[#f59e0b] px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Hors ligne — Interface en cache, synchronisation serveur en attente.</span>
    </div>
  );
};
