import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AppLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function onLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const linkClass = ({ isActive }) =>
    `nav-link font-sans text-sm ${isActive ? 'text-lavender' : 'text-chalk/70 hover:text-chalk'}`;

  return (
    <div className="min-h-screen bg-chalk">
      <header className="bg-navy text-chalk print:hidden">
        <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-6">
            <span className="shrink-0 font-display text-xl">DS Properties</span>
            <nav className="flex gap-4 overflow-x-auto" aria-label="Primary">
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
              <NavLink to="/partners" className={linkClass}>
                Partners
              </NavLink>
              <NavLink to="/receipts" className={linkClass}>
                Receipts
              </NavLink>
              <NavLink to="/reports" className={linkClass}>
                Reports
              </NavLink>
              <NavLink to="/categories" className={linkClass}>
                Categories
              </NavLink>
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span className="hidden font-mono text-xs uppercase tracking-widest text-lavender sm:inline">
              {user?.name || 'Admin'}
            </span>
            <button
              onClick={onLogout}
              className="rounded border border-lavender/40 px-3 py-1 font-sans text-xs text-lavender transition-colors duration-200 hover:bg-lavender/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-content px-6 py-8">
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
