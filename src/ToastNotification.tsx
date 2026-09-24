import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 3800) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      toasts: [],
      showToast: (msg: string) => console.log('[Toast fallback]', msg),
      removeToast: () => {},
    };
  }
  return context;
};

export const ToastContainer: React.FC<{ toasts: ToastItem[]; onRemove: (id: string) => void }> = ({
  toasts,
  onRemove,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 z-[99999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3 sm:px-0"
    >
      {toasts.map((toast) => {
        const typeStyles = {
          success: 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100 shadow-emerald-950/50',
          error: 'bg-rose-950/95 border-rose-500/50 text-rose-100 shadow-rose-950/50',
          warning: 'bg-amber-950/95 border-amber-500/50 text-amber-100 shadow-amber-950/50',
          info: 'bg-slate-900/95 border-blue-500/50 text-slate-100 shadow-slate-950/50',
        }[toast.type];

        const icon = {
          success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
          error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
          info: <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />,
        }[toast.type];

        return (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto border rounded-2xl p-3.5 shadow-2xl backdrop-blur-md flex items-start gap-3 transition-all animate-fadeIn ${typeStyles}`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-snug break-words">{toast.message}</p>
            </div>
            <button
              onClick={() => onRemove(toast.id)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              aria-label="Fechar notificação"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
