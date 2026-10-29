import { useCallback, useEffect, useState } from 'react';
import { Check, Play, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { useLive } from '../lib/live.js';
import { fmtDT } from '../lib/format.js';
import { Badge, Card, Field, useRun, useToast } from '../components/ui.jsx';

export function Approvals() {
  const run = useRun();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const load = useCallback(() => run(async () => setRows(await api('/admin/users'))), [run]);
  useEffect(() => { load(); }, [load]);
  const resetPin = (u) => { const pin = window.prompt(`New PIN (4-6 digits) for ${u.name}:`); if (pin) run(async () => { await api(`/admin/users/${u.id}/reset-pin`, 'POST', { pin }); toast('PIN changed'); }); };
  const set = (id, status) => run(async () => { await api(`/admin/users/${id}`, 'PATCH', { status }); toast('Updated'); load(); });
  return (
    <Card title="Registrations" right={<span className="mut small">Approving a driver also enables their ambulance. Then link the RFID tag in Ambulances.</span>}>
      <div className="tablewrap"><table>
        <thead><tr><th>Name</th><th>Role</th><th>Phone (login)</th><th>Ambulance / hospital</th><th>Status</th><th /></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td><b>{u.name}</b></td><td>{u.role}</td><td>{u.phone}</td><td>{u.ambulance_number || u.hospital_name}</td>
              <td><Badge value={u.status} /></td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button className="btn sm" onClick={() => resetPin(u)}>Reset PIN</button>{' '}
                {u.status !== 'APPROVED' && <button className="btn sm ok" onClick={() => set(u.id, 'APPROVED')}><Check size={14} />Approve</button>}{' '}
                {u.status !== 'REJECTED' && <button className="btn sm danger" onClick={() => set(u.id, 'REJECTED')}><X size={14} />Reject</button>}
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="empty">No registrations yet</td></tr>}
        </tbody>
      </table></div>
    </Card>
  );
}

export function ScanLog() {
  const run = useRun();
  const [rows, setRows] = useState([]);
  const [readers, setReaders] = useState([]);
  const [form, setForm] = useState({ reader_code: '', tag_uid: '' });
  const [out, setOut] = useState(null);
  const load = useCallback(() => run(async () => { setRows(await api('/admin/scans')); setReaders(await api('/admin/readers')); }), [run]);
  useEffect(() => { load(); }, [load]);
  useLive({ scan: () => load() });

  const sim = (e) => {
    e.preventDefault();
    run(async () => setOut(await api('/admin/simulate', 'POST', { ...form, reader_code: form.reader_code || readers[0]?.reader_code })));
  };
  return (
    <>
      <Card title="Simulate a reader scan" right={<span className="mut small">Test the whole chain without hardware</span>}>
        <form className="row wrap" style={{ alignItems: 'flex-end' }} onSubmit={sim}>
          <Field label="Reader"><select value={form.reader_code} onChange={(e) => setForm({ ...form, reader_code: e.target.value })}>{readers.map((r) => <option key={r.id}>{r.reader_code}</option>)}</select></Field>
          <div className="grow"><Field label="Tag UID"><input required placeholder="E2000017221101441890" value={form.tag_uid} onChange={(e) => setForm({ ...form, tag_uid: e.target.value })} /></Field></div>
          <button className="btn primary" style={{ marginBottom: 12 }}><Play size={15} />Scan</button>
        </form>
        {out && (out.action === 'GREEN'
          ? <div className="banner" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}>🟢 PREEMPT: signal {out.signal_id} ({out.approach_direction}) green for {out.green_seconds}s</div>
          : <div className="banner">⚪ {String(out.result).replace(/_/g, ' ')}: signal stays normal</div>)}
      </Card>
      <Card title="Latest scans" right={<span className="small"><span className="dot live" /> live</span>}>
        <div className="tablewrap"><table>
          <thead><tr><th>Time</th><th>Reader</th><th>Tag</th><th>Ambulance</th><th>Result</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}><td>{fmtDT(s.scanned_at)}</td><td><b>{s.reader_code}</b><div className="mut small">{s.location_name}</div></td><td className="mono">{s.tag_uid}</td><td>{s.ambulance_number || '-'}</td><td><Badge value={s.result} /></td></tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="empty">No scans yet</td></tr>}
          </tbody>
        </table></div>
      </Card>
    </>
  );
}
