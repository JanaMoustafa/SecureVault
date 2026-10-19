import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

/**
 * ProtectedRoute — wraps a route so only authenticated users can access it.
 *
 * Props:
 *   children     — content to render when authenticated
 *   role         — (optional) required role, e.g. 'admin'
 *   fallback     — redirect path when unauthenticated (default: '/login')
 *   authenticated — (optional) override for testing; bypasses store check
 *   onRedirect   — (optional) callback fired before redirect (for tests)
 */
export default function ProtectedRoute({
  children,
  role,
  fallback = '/login',
  authenticated,
  onRedirect,
}) {
  const { user, accessToken } = useAuthStore();

  // Allow test override via prop
  const isAuthenticated =
    authenticated !== undefined ? authenticated : !!(accessToken && user);

  if (!isAuthenticated) {
    onRedirect?.();
    return <Navigate to={fallback} replace />;
  }

  if (role && user?.role !== role) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
