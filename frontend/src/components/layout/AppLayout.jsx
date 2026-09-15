import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { BottomNav } from './BottomNav.jsx';

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto overflow-x-clip pb-20 lg:pb-0">
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}