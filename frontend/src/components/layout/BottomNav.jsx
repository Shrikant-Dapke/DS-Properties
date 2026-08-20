import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, ArrowLeftRight, Users, Handshake, FileBarChart, Settings } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { isAdmin } from '../../contexts/authContextDef.js';

const bottomItems = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/entries/new', label: 'Add', icon: PlusCircle, writeOnly: true },
  { to: '/transactions', label: 'Entries', icon: ArrowLeftRight },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/partners', label: 'Partners', icon: Handshake },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export function BottomNav() {
  const { user } = useAuth();
  const visible = bottomItems.filter(
    (item) => (!item.adminOnly || isAdmin(user)) && (!item.writeOnly || isAdmin(user) || user.role === 'operator'),
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white lg:hidden" aria-label="Mobile nav">
      <div className="grid grid-cols-6">
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
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}