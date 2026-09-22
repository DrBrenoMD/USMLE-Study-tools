import React from 'react';
import { useToastStore } from '../lib/toast';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      {toasts.map((toast) => {
        let borderClass = 'border-blue-500/40 bg-gray-900/90 text-white';
        let Icon = Info;
        if (toast.type === 'success') {
          borderClass = 'border-emerald-500/40 bg-gray-900/90 text-emerald-300';
          Icon = CheckCircle2;
        } else if (toast.type === 'error') {
          borderClass = 'border-rose-500/40 bg-gray-900/90 text-rose-300';
          Icon = AlertCircle;
        } else if (toast.type === 'warning') {
          borderClass = 'border-amber-500/40 bg-gray-900/90 text-amber-300';
          Icon = AlertCircle;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-3 duration-200 ${borderClass}`}
          >
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 shrink-0" />
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-white transition-colors p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
