import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  ArrowLeftRight,
  Users,
  Handshake,
  Tags,
  FileBarChart,
  Settings,
  UserCog,
  ScrollText,
  LogOut,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import { ROLE_LABELS } from '../../utils/constants.js';
import { isAdmin } from '../../contexts/authContextDef.js';
import { ChangePasswordModal } from './ChangePasswordModal.jsx';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/entries/new', label: 'Add Entry', icon: PlusCircle, writeOnly: true },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/partners', label: 'Partners', icon: Handshake },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
  { to: '/users', label: 'Users', icon: UserCog, adminOnly: true },
  { to: '/audit', label: 'Audit Log', icon: ScrollText, adminOnly: true },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);

  const visible = navItems.filter(
    (item) => (!item.adminOnly || isAdmin(user)) && (!item.writeOnly || isAdmin(user) || user.role === 'operator'),
  );

  const handleLogout = async () => {
    await logout();
    toast.info('Logged out');
    navigate('/login');
  };

  return (
    <aside className="hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">
          DS
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">DS Properties</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Financial Tracking</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-100 px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
            {user.fullName?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-800">{user.fullName || user.username}</p>
            <p className="text-[10px] text-slate-400">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>
        <button
          onClick={() => setShowChangePassword(true)}
          className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        >
          <KeyRound className="h-3.5 w-3.5" /> Change password
        </button>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        >
          <LogOut className="h-3.5 w-3.5" /> Log out
        </button>
      </div>
      <ChangePasswordModal open={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </aside>
  );
}