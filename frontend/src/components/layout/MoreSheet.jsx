import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Handshake,
  Tags,
  ShieldCheck,
  UserCog,
  ScrollText,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import { ROLES } from '../../utils/constants.js';

const sheetItems = [
  { to: '/customers', labelKey: 'nav.customers', icon: Users },
  { to: '/partners', labelKey: 'nav.partners', icon: Handshake },
  { to: '/categories', labelKey: 'nav.categories', icon: Tags },
  { to: '/approvals', labelKey: 'nav.approvals', icon: ShieldCheck, roles: [ROLES.ADMIN, ROLES.PARTNER, ROLES.DEVELOPER] },
  { to: '/users', labelKey: 'nav.users', icon: UserCog, roles: [ROLES.ADMIN, ROLES.PARTNER, ROLES.DEVELOPER] },
  { to: '/audit', labelKey: 'nav.audit', icon: ScrollText },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
];

// Overflow destinations for the 5-item mobile bar: full-height rows in a
// bottom-anchored sheet (no shrinking, no overlap), plus the mobile logout
// that has no other home outside the desktop sidebar.
export function MoreSheet({ open, onClose }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  if (!open) return null;

  const visible = sheetItems.filter(
    (item) => !item.roles || item.roles.includes(user?.role),
  );

  const handleLogout = async () => {
    onClose();
    await logout();
    toast.info(t('auth.logout'));
    navigate('/login');
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t('nav.more')}>
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-xl">
        <div className="mb-1 flex items-center justify-between px-2">
          <p className="text-sm font-semibold text-slate-800">{t('nav.more')}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav>
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex min-h-[52px] items-center gap-3 rounded-xl px-3 text-[15px] font-medium ${
                  isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'
                }`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {t(item.labelKey)}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {t('auth.logout')}
          </button>
        </nav>
      </div>
    </div>
  );
}
