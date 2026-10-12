import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
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

/** For "/": logged-in users are sent straight to the canvas. */
export function PublicOnlyRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  if (token) return <Navigate to="/canvas" replace />;
  return children;
}
