import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button.jsx';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-6xl font-bold text-emerald-700">404</p>
      <h1 className="text-lg font-semibold text-slate-800">Page not found</h1>
      <p className="max-w-sm text-sm text-slate-500">The page you're looking for doesn't exist or you don't have access to it.</p>
      <Link to="/">
        <Button>Go to dashboard</Button>
      </Link>
    </div>
  );
}