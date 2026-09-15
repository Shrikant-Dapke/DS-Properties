import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  PlusCircle,
  ArrowLeftRight,
  FileBarChart,
  Ellipsis,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { ROLES } from '../../utils/constants.js';
import { MoreSheet } from './MoreSheet.jsx';

const primaryItems = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/entries/new', labelKey: 'nav.add', icon: PlusCircle, roles: [ROLES.PARTNER, ROLES.DEVELOPER] },
  { to: '/transactions', labelKey: 'nav.transactions', icon: ArrowLeftRight },
  { to: '/reports', labelKey: 'nav.reports', icon: FileBarChart },
];

// Destinations that live inside the More sheet (kept in sync with
// MoreSheet): the More tab highlights while any of them is active.
const morePaths = ['/customers', '/partners', '/categories', '/approvals', '/users', '/audit', '/settings'];

// Five fixed tabs — Dashboard | Add | Transactions | Reports | More — so
// labels never shrink or overlap, with secondary destinations in a sheet.
export function BottomNav() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const visible = primaryItems.filter(
    (item) => !item.roles || item.roles.includes(user?.role),
  );
  const moreActive = morePaths.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Mobile nav">
        <div style={{ gridTemplateColumns: `repeat(${visible.length + 1}, minmax(0, 1fr))` }} className="grid">
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium ${
                  isActive ? 'text-emerald-700' : 'text-slate-500'
                }`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{t(item.labelKey)}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label={t('nav.more')}
            className={`flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium ${
              moreActive ? 'text-emerald-700' : 'text-slate-500'
            }`}
          >
            <Ellipsis className="h-5 w-5 shrink-0" />
            <span className="truncate">{t('nav.more')}</span>
          </button>
        </div>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
