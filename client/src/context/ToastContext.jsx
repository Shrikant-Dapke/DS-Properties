import { createContext, useContext, useState, useCallback, useRef } from 'react';
import Toast from '../components/Toast.jsx';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timers = useRef({});

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const add = useCallback(
    (type, message, opts = {}) => {
      idRef.current += 1;
      const id = idRef.current;
      const duration = opts.duration ?? (type === 'error' ? 6000 : 4000);
      setToasts((prev) => [...prev, { id, type, message }].slice(-4));
      if (duration > 0) {
        timers.current[id] = setTimeout(() => remove(id), duration);
      }
      return id;
    },
    [remove]
  );

  const value = {
    toast: {
      success: (m, o) => add('success', m, o),
      error: (m, o) => add('error', m, o),
      warning: (m, o) => add('warning', m, o),
      info: (m, o) => add('info', m, o),
    },
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op fallback if used outside provider (e.g. tests)
    return {
      toast: { success() {}, error() {}, warning() {}, info() {} },
      remove() {},
    };
  }
  return ctx;
}
