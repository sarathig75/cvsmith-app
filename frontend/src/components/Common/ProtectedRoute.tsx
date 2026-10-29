import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useUploadStore } from '../../store/uploadStore';
import { Header } from './Header';

/** Requires auth; unauthenticated visitors go to "/". Renders the nav shell around child routes. */
export function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/" replace />;
  return (
    <>
      <Header showNav />
      <main className="pt-14 md:pt-16">
        <Outlet />
      </main>
    </>
  );
}

/**
 * For "/": logged-in users go to the dashboard, except right after signing up or logging in with a CV
 * chosen on the start page: they go to the Canvas, where it is being read.
 */
export function PublicOnlyRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  const choseCv = useUploadStore((s) => s.pendingFile !== null || s.status === 'uploading' || s.status === 'confirm');
  if (token) return <Navigate to={choseCv ? '/canvas' : '/dashboard'} replace />;
  return children;
}
