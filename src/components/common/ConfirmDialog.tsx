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
          iconBg: 'bg-rose-500/10 text-rose-700 font-bold border border border-black',
          btnBg: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50',
          badge: 'bg-rose-500/15 text-rose-700 font-bold'
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-500/10 text-amber-700 font-bold border border border-black',
          btnBg: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/50',
          badge: 'bg-amber-500/15 text-amber-700 font-bold'
        };
      case 'primary':
      default:
        return {
          iconBg: 'bg-orange-500/10 text-orange-700 font-bold border border-orange-500/20',
          btnBg: 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-950/50',
          badge: 'bg-orange-500/15 text-orange-700 font-bold'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-white border border border-black rounded-2xl shadow-2xl shadow-black overflow-hidden animate-in zoom-in-95 duration-200"
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
              className="p-1.5 text-zinc-900 font-semibold hover:text-zinc-950 font-bold hover:bg-white/5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4">
            <h3 className="text-lg font-bold text-zinc-950 font-bold tracking-tight">
              {title}
            </h3>
            <p className="text-sm text-zinc-950 font-bold mt-2 leading-relaxed">
              {description}
            </p>

            {details && details.length > 0 && (
              <div className="mt-3 p-3 bg-white rounded-xl border border border-black space-y-1.5">
                {details.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-zinc-900 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
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
              className="px-4 py-2 text-xs font-semibold text-zinc-950 font-bold hover:text-white bg-white/5 hover:bg-white/10 border border border-black rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 ${styles.btnBg}`}
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
