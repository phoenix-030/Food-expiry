import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { ToastContext } from './toastContextObject';

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const timeoutRef = useRef(null);

  const dismissToast = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback((message, { position = 'top-right', type = 'success' } = {}) => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    setToast({ message, position, type });
    timeoutRef.current = window.setTimeout(() => {
      setToast(null);
      timeoutRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <div
          className={`toast-notification toast-notification-${toast.type}${toast.position === 'center' ? ' toast-notification-centered' : ''}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {toast.type === 'error'
            ? <AlertCircle className="toast-icon" size={22} aria-hidden="true" />
            : <CheckCircle2 className="toast-icon" size={22} aria-hidden="true" />}
          <span>{toast.message}</span>
          <button
            type="button"
            className="toast-dismiss"
            onClick={dismissToast}
            aria-label="Dismiss notification"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
};
