import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  PlusCircle,
  ArrowLeftRight,
  Users,
  Handshake,
  FileBarChart,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { isAdmin } from '../../contexts/authContextDef.js';

const bottomItems = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/entries/new', labelKey: 'nav.addEntry', icon: PlusCircle, writeOnly: true },
  { to: '/transactions', labelKey: 'nav.transactions', icon: ArrowLeftRight },
  { to: '/customers', labelKey: 'nav.customers', icon: Users },
  { to: '/partners', labelKey: 'nav.partners', icon: Handshake },
  { to: '/reports', labelKey: 'nav.reports', icon: FileBarChart },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, adminOnly: true },
  { to: '/approvals', labelKey: 'nav.approvals', icon: ShieldCheck, adminOnly: true },
];

export function BottomNav() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const visible = bottomItems.filter(
    (item) => (!item.adminOnly || isAdmin(user)) && (!item.writeOnly || isAdmin(user)),
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white lg:hidden" aria-label="Mobile nav">
      <div style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }} className="grid">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                isActive ? 'text-emerald-700' : 'text-slate-500'
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            {t(item.labelKey)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
