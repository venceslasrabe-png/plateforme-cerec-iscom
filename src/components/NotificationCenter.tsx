import {
  Bell,
  Check,
  CheckCheck,
  CreditCard,
  UserPlus,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Campus, ModuleId, SystemNotification, UserRole } from '../types/cerec';
import { canAccessModule } from '../utils/permissions';

interface NotificationCenterProps {
  notifications: SystemNotification[];
  activeRole: UserRole;
  campusFilter: Campus | 'Tous';
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigate: (module: ModuleId) => void;
}

function formatNotifTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} · ${hours}:${mins}`;
  } catch {
    return iso.slice(0, 16);
  }
}

export function NotificationCenter({
  notifications,
  activeRole,
  campusFilter,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const scoped = notifications.filter(
    (n) =>
      n.targetRoles.includes(activeRole) &&
      (campusFilter === 'Tous' || n.campus === campusFilter)
  );
  const unreadCount = scoped.filter(
    (n) => !n.readByRoles.includes(activeRole)
  ).length;

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const handleItemClick = (n: SystemNotification) => {
    if (!n.readByRoles.includes(activeRole)) {
      onMarkRead(n.id);
    }
    if (n.targetModule && canAccessModule(activeRole, n.targetModule)) {
      onNavigate(n.targetModule);
    }
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications (${unreadCount} non lue${unreadCount > 1 ? 's' : ''})`}
        title="Centre de notifications"
        className={`relative inline-flex items-center justify-center p-2 rounded-lg border transition-colors cursor-pointer ${
          unreadCount > 0
            ? 'border-[#e0a526] bg-[#fffaf0] text-[#0b1f3f] hover:bg-[#fff4d6]'
            : 'border-[#e3e7ef] bg-[#f8f9fb] text-[#0b1f3f] hover:border-[#0b1f3f]'
        }`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#e0a526] text-[#07142b] font-mono text-[10px] font-bold leading-none tabular-nums">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-full sm:mt-2 sm:w-96 bg-white border border-[#e3e7ef] rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 bg-[#0b1f3f] text-white flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-tight">
                Notifications & Alertes
              </p>
              <p className="text-[11px] text-slate-300 truncate">
                {unreadCount > 0
                  ? `${unreadCount} notification(s) non lue(s)`
                  : 'Aucune nouvelle notification'}
                {campusFilter !== 'Tous' ? ` · ${campusFilter}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#143263] hover:bg-[#1a3e78] text-[11px] font-semibold text-[#eab33a] cursor-pointer"
                >
                  <CheckCheck className="w-3 h-3" />
                  Tout lire
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer les notifications"
                className="p-1 rounded text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[68vh] overflow-y-auto divide-y divide-[#e3e7ef]">
            {scoped.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-1.5">
                <Bell className="w-6 h-6 text-slate-300 mx-auto" />
                <p className="text-xs font-medium text-slate-600">
                  Aucune notification pour ce profil.
                </p>
                <p className="text-[11px] text-slate-400">
                  Les alertes d’inscription et d’encaissement apparaîtront ici en temps réel.
                </p>
              </div>
            ) : (
              scoped.slice(0, 25).map((n) => {
                const isUnread = !n.readByRoles.includes(activeRole);
                const isInscription = n.category === 'inscription';
                return (
                  <div
                    key={n.id}
                    className={`p-3.5 transition-colors flex items-start gap-3 ${
                      isUnread ? 'bg-[#fffcf5]' : 'bg-white hover:bg-slate-50/70'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${
                        isInscription
                          ? 'bg-[#eef2f9] border-[#0b1f3f]/15 text-[#0b1f3f]'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      }`}
                    >
                      {isInscription ? (
                        <UserPlus className="w-4 h-4" />
                      ) : (
                        <CreditCard className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <button
                        type="button"
                        onClick={() => handleItemClick(n)}
                        className="w-full text-left cursor-pointer group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#0b1f3f] group-hover:underline truncate">
                            {n.title}
                          </span>
                          {isUnread && (
                            <span
                              title="Non lue"
                              className="w-2 h-2 rounded-sm bg-[#e0a526] shrink-0"
                            />
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-snug mt-0.5">
                          {n.message}
                        </p>
                      </button>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                          {n.campus} · {formatNotifTimestamp(n.createdAt)}
                        </span>
                        {isUnread && (
                          <button
                            type="button"
                            onClick={() => onMarkRead(n.id)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0b1f3f] hover:text-[#c58b12] cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            Marquer lu
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
