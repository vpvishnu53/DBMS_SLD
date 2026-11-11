'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Icon from './Icon';
import { enumLabel, toneOf } from '@/lib/format';

/** Status badge: colour dot + text label (status colour never carries meaning alone). */
export function Badge({ value, tone }) {
  if (value == null || value === '') return <span className="muted">—</span>;
  return (
    <span className={`badge ${tone || toneOf(value)}`}>
      <span className="dot" />
      {enumLabel(value)}
    </span>
  );
}

export function Spinner({ center }) {
  return center ? <div className="center"><div className="spinner" /></div> : <div className="spinner" />;
}

export function PageHeader({ title, sub, crumbs, children }) {
  return (
    <div className="page-head">
      <div>
        {crumbs && <div className="crumbs">{crumbs}</div>}
        <h1 className="page-title">{title}</h1>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert alert-error row">
      <span>{error.message || String(error)}</span>
      {onRetry && <><span className="spacer" /><button className="btn btn-sm" onClick={onRetry}><Icon name="refresh" size={14} />Retry</button></>}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, size }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${size === 'sm' ? 'modal-sm' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title = 'Are you sure?', message, confirmLabel = 'Delete', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const go = async () => {
    setBusy(true); setError(null);
    try { await onConfirm(); onClose(); } catch (e) { setError(e); setBusy(false); }
  };
  return (
    <Modal title={title} onClose={onClose} size="sm" footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-danger" onClick={go} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
    </>}>
      <ErrorBox error={error} />
      <p style={{ margin: 0, color: 'var(--text-2)' }}>{message}</p>
    </Modal>
  );
}

/* ------------------------------ toasts ------------------------------ */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`}>{t.message}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
