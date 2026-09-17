import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

/**
 * Wraps any route that requires a logged-in user.
 * Redirects to "/" (Login page) if not authenticated.
 * Shows a loading spinner while auth state is being initialised.
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="protected-route-loader">
        <div className="protected-route-spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
