import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { X } from 'lucide-react';

/* ---------- toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = useCallback((msg, type = '') => {
    const id = Math.random();
    setItems((l) => [...l, { id, msg, type }]);
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toasts">{items.map((t) => <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>)}</div>
    </ToastCtx.Provider>
  );
}
/** run an async action and show errors as toasts */
export function useRun() {
  const toast = useToast();
  return useCallback(async (fn) => { try { return await fn(); } catch (e) { toast(e.message, 'err'); return undefined; } }, [toast]);
}

/* ---------- modal ---------- */
export function Modal({ open, onClose, title, subtitle, wide, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet ${wide ? 'wide' : ''}`}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div><h2>{title}</h2>{subtitle && <p className="mut small" style={{ margin: '4px 0 0' }}>{subtitle}</p>}</div>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div style={{ marginTop: 14 }}>{children}</div>
      </div>
    </div>
  );
}

/* ---------- small pieces ---------- */
const TONES = { CRITICAL: 'red', SERIOUS: 'amber', STABLE: 'green', ACTIVE: 'red', NORMAL: 'green', PENDING: 'amber', APPROVED: 'green', REJECTED: 'red',
  ARRIVED: 'green', CANCELLED: 'amber', EXPIRED: 'amber', ACKNOWLEDGED: 'blue', READY: 'green', PREEMPT: 'red', IGNORED_NORMAL: 'amber', UNKNOWN_TAG: 'amber', DISABLED: 'amber' };
export const Badge = ({ value, tone }) => <span className={`badge ${tone || TONES[value] || ''}`}>{String(value ?? '-').replace(/_/g, ' ')}</span>;

export const Stat = ({ icon: Icon, label, value, tone = 'red', onClick }) => (
  <div className={`card stat tone-${tone}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
    <div className="ico"><Icon size={22} /></div>
    <div><b>{value ?? '-'}</b><span>{label}</span></div>
  </div>
);

export const Card = ({ title, right, children, style }) => (
  <div className="card" style={style}>
    {(title || right) && <div className="head"><h3>{title}</h3>{right}</div>}
    {children}
  </div>
);

export const Empty = ({ children = 'Nothing here yet' }) => <div className="empty">{children}</div>;
export const Field = ({ label, children }) => <div className="field"><label>{label}</label>{children}</div>;

export function MapBox({ mapRef, error, children, style }) {
  return (
    <div className="map" style={style}>
      <div ref={mapRef} className="map-canvas" />
      {error && <div className="nomap"><div>🗺️<br />{error}</div></div>}
      {children}
    </div>
  );
}
