import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AppLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  function onLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const linkClass = ({ isActive }) =>
    `font-sans text-sm ${isActive ? 'text-lavender' : 'text-chalk/70 hover:text-chalk'}`;

  return (
    <div className="min-h-screen bg-chalk">
      <header className="bg-navy text-chalk">
        <div className="mx-auto flex max-w-content items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <span className="font-display text-xl">DS Properties</span>
            <nav className="flex gap-4">
              <NavLink to="/" end className={linkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/customers" className={linkClass}>
                Customers
              </NavLink>
              <NavLink to="/plots" className={linkClass}>
                Plots
              </NavLink>
              <NavLink to="/payments" className={linkClass}>
                Payments
              </NavLink>
              <NavLink to="/expenses" className={linkClass}>
                Expenses
              </NavLink>
              <NavLink to="/income" className={linkClass}>
                Income
              </NavLink>
              <NavLink to="/reports" className={linkClass}>
                Reports
              </NavLink>
              <NavLink to="/categories" className={linkClass}>
                Categories
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs uppercase tracking-widest text-lavender">
              {user?.name || 'Admin'}
            </span>
            <button
              onClick={onLogout}
              className="rounded border border-lavender/40 px-3 py-1 font-sans text-xs text-lavender transition-colors duration-200 hover:bg-lavender/10"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-content px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
