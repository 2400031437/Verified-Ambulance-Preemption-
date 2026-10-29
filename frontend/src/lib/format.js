export const fmtDT = (s) => (s ? new Date(s).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-');
export const fmtDay = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric' }) : '');
export function timeAgo(s) {
  if (!s) return 'never';
  const sec = Math.max(0, Math.round((Date.now() - new Date(s)) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)} h ago`;
  return fmtDT(s);
}
/** Fills the last 7 days so charts never have gaps. rows: [{day, ...}] */
export function fillDays(rows, keys) {
  const map = new Map((rows || []).map((r) => [String(r.day).slice(0, 10), r]));
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const r = map.get(key) || {};
    const o = { day: key };
    keys.forEach((k) => { o[k] = Number(r[k] || 0); });
    out.push(o);
  }
  return out;
}
