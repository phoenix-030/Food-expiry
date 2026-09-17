import { useContext } from 'react';
import { AuthContext } from './authContextObject';

/**
 * Hook to access auth state.
 * Separated into its own file to fix Vite Fast Refresh HMR error
 * (a file cannot export both React components and hooks).
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
