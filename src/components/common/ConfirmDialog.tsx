import React from 'react';
import { AlertTriangle, Trash2, RotateCcw, X, Loader2 } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  icon?: 'trash' | 'restore' | 'warning';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  details,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  icon = 'warning',
  isLoading = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'bg-rose-50 text-rose-700 border border-rose-200',
          btnBg: 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs',
          badge: 'bg-rose-100 text-rose-800 font-bold'
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-50 text-amber-700 border border-amber-200',
          btnBg: 'bg-amber-600 hover:bg-amber-500 text-white shadow-xs',
          badge: 'bg-amber-100 text-amber-800 font-bold'
        };
      case 'primary':
      default:
        return {
          iconBg: 'bg-orange-50 text-orange-700 border border-orange-200',
          btnBg: 'bg-orange-600 hover:bg-orange-500 text-white shadow-xs',
          badge: 'bg-orange-100 text-orange-800 font-bold'
        };
    }
  };

  const styles = getVariantStyles();

  const renderIcon = () => {
    if (icon === 'trash') return <Trash2 className="w-6 h-6" />;
    if (icon === 'restore') return <RotateCcw className="w-6 h-6" />;
    return <AlertTriangle className="w-6 h-6" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header decoration bar */}
        <div className={`h-1.5 w-full ${variant === 'danger' ? 'bg-gradient-to-r from-rose-600 to-rose-400' : 'bg-gradient-to-r from-orange-600 to-amber-400'}`} />

        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className={`p-3 rounded-2xl ${styles.iconBg} shrink-0`}>
              {renderIcon()}
            </div>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="p-1.5 text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4">
            <h3 className="text-lg font-bold text-zinc-950 tracking-tight">
              {title}
            </h3>
            <p className="text-sm text-zinc-600 mt-2 leading-relaxed font-medium">
              {description}
            </p>

            {details && details.length > 0 && (
              <div className="mt-3 p-3 bg-slate-50/80 rounded-xl border border-zinc-200 space-y-1.5">
                {details.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-zinc-700 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 ${styles.btnBg}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
