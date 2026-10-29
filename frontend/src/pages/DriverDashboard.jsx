import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Route, Siren, Timer, Zap } from 'lucide-react';
import { api } from '../lib/api.js';
import { useLive } from '../lib/live.js';
import { fillDays, fmtDT } from '../lib/format.js';
import { BarsDay } from '../components/Charts.jsx';
import { Badge, Card, Empty, Stat, useRun } from '../components/ui.jsx';

export default function DriverDashboard() {
  const nav = useNavigate();
  const run = useRun();
  const [me, setMe] = useState(null);
  const [st, setSt] = useState(null);
  const load = useCallback(() => run(async () => { setMe(await api('/driver/me')); setSt(await api('/driver/stats')); }), [run]);
  useEffect(() => { load(); }, [load]);
  useLive({ 'trip:ended': () => load(), 'trip:ack': () => load(), preempt: () => load() });

  const toggleDuty = () => run(async () => { await api('/driver/duty', 'POST', { on_duty: !Number(me.ambulance.on_duty) }); await load(); });
  const amb = me?.ambulance;
  const ready = amb && Number(amb.is_enabled) && amb.rfid_tag_uid;
  return (
    <>
      {!amb && me && <div className="banner">No ambulance is linked to your account yet. Please contact the admin.</div>}
      {amb && !ready && <div className="banner">⏳ Your ambulance is not verified yet. The admin must approve you and link an RFID tag.</div>}
      {amb && ready && (
        <div className="card row between wrap">
          <div><b>Duty status: {Number(amb.on_duty) ? 'ON DUTY' : 'OFF DUTY'}</b>
            <div className="mut small">{Number(amb.on_duty) ? 'Patients nearby can see this ambulance as available (keep this page open so GPS is shared).' : 'Go on duty to appear as a free ambulance for nearby patients.'}</div></div>
          <button className={`btn ${Number(amb.on_duty) ? 'danger' : 'ok'}`} onClick={toggleDuty}>{Number(amb.on_duty) ? 'Go off duty' : 'Go on duty'}</button>
        </div>
      )}
      <div className="gridA">
        <div className={`tagcard ${amb?.tag_status || 'NORMAL'}`}>
          <span style={{ opacity: 0.85, fontWeight: 600 }}>RFID TAG STATUS</span>
          <b>{amb?.tag_status || '-'}</b>
          <span>{amb ? <>🚑 {amb.ambulance_number} · {amb.ambulance_type} · <span className="mono">{amb.rfid_tag_uid || 'tag not linked'}</span></> : ' '}</span>
          {me?.trip && <span style={{ marginTop: 6 }}>🏥 Heading to <b>{me.trip.hospital_name}</b> · hospital {String(me.trip.hospital_ack).toLowerCase()}</span>}
          <div style={{ marginTop: 10 }}>
            <button className="btn lg" style={{ background: '#fff', color: '#26363a' }} disabled={!ready} onClick={() => nav('/driver/run')}>
              <Siren size={18} />{me?.trip ? 'Open active run' : 'Start emergency run'}
            </button>
          </div>
        </div>
        <Card title="How activation works">
          <ol className="mut" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, fontSize: 14 }}>
            <li>Fill the patient problem and choose the hospital</li>
            <li>Press <b>Save &amp; activate tag</b></li>
            <li>Signals turn green when the reader scans your tag</li>
            <li>The tag turns NORMAL again when you arrive</li>
          </ol>
        </Card>
      </div>

      <div className="kpis">
        <Stat icon={Route} label="Total runs" value={st?.total} tone="blue" />
        <Stat icon={CalendarCheck} label="Runs today" value={st?.today} tone="green" />
        <Stat icon={Timer} label="Avg run (min)" value={st?.avgMinutes ?? '-'} tone="amber" />
        <Stat icon={Zap} label="Signals cleared for you" value={st?.signalsCleared} tone="red" />
      </div>

      <div className="gridB">
        <Card title="Runs · last 7 days"><BarsDay data={fillDays(st?.perDay, ['trips'])} name="Runs" /></Card>
        <Card title="Recent runs">
          {st?.recent?.length ? (
            <div className="tablewrap"><table>
              <thead><tr><th>When</th><th>Problem</th><th>Hospital</th><th>Status</th></tr></thead>
              <tbody>{st.recent.map((t) => (
                <tr key={t.id}><td>{fmtDT(t.started_at)}</td><td>{t.problem}<div><Badge value={t.severity} /></div></td><td>{t.hospital_name}</td><td><Badge value={t.status} /></td></tr>
              ))}</tbody>
            </table></div>
          ) : <Empty>No runs yet</Empty>}
        </Card>
      </div>
    </>
  );
}
