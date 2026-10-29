import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BedDouble, CalendarCheck, HeartPulse, Siren, Timer, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { useLive } from '../lib/live.js';
import { fillDays, fmtDT } from '../lib/format.js';
import { BarsDay, Donut, HBars } from '../components/Charts.jsx';
import { Badge, Card, Empty, Stat, useRun } from '../components/ui.jsx';

export default function HospitalDashboard() {
  const nav = useNavigate();
  const run = useRun();
  const [st, setSt] = useState(null);
  const [h, setH] = useState(null);
  const [inc, setInc] = useState({ active: [], history: [] });
  const load = useCallback(() => run(async () => { setSt(await api('/hospital/stats')); setH(await api('/hospital/me')); setInc(await api('/hospital/incoming')); }), [run]);
  useEffect(() => { load(); }, [load]);
  useLive({ 'trip:new': () => load(), 'trip:ended': () => load() });

  return (
    <>
      {h && !h.lat && <div className="banner">📍 Set your hospital location in "Profile &amp; beds" so ambulances can find you.</div>}
      <div className="kpis">
        <Stat icon={Siren} label="Incoming now" value={st?.incoming} tone="red" onClick={() => nav('/hospital/incoming')} />
        <Stat icon={CalendarCheck} label="Patients today" value={st?.today} tone="blue" />
        <Stat icon={Users} label="Total patients" value={st?.total} tone="green" />
        <Stat icon={Timer} label="Avg arrival (min)" value={st?.avgMinutes ?? '-'} tone="amber" />
        <Stat icon={HeartPulse} label="ICU beds free" value={h?.icu_beds_available} tone="red" onClick={() => nav('/hospital/profile')} />
        <Stat icon={BedDouble} label="ER beds free" value={h?.emergency_beds_available} tone="blue" onClick={() => nav('/hospital/profile')} />
      </div>
      <div className="gridA">
        <Card title="Patients · last 7 days"><BarsDay data={fillDays(st?.perDay, ['trips'])} name="Patients" /></Card>
        <Card title="By severity"><Donut data={st?.severity} /></Card>
      </div>
      <div className="gridB">
        <Card title="Top emergencies"><HBars data={st?.topProblems} /></Card>
        <Card title="Incoming right now" right={<button className="btn sm" onClick={() => nav('/hospital/incoming')}>Open live view</button>}>
          {inc.active.length ? inc.active.map((t) => (
            <div key={t.id} className="row between" style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
              <div><b>{t.problem}</b><div className="mut small">{t.ambulance_number} · {t.patient_name}</div></div><Badge value={t.severity} />
            </div>
          )) : <Empty>No ambulance on the way</Empty>}
        </Card>
      </div>
      <Card title="Recent patients">
        {inc.history.length ? (
          <div className="tablewrap"><table>
            <thead><tr><th>Arrived</th><th>Patient</th><th>Problem</th><th>Ambulance</th><th>Status</th></tr></thead>
            <tbody>{inc.history.map((t) => (
              <tr key={t.id}><td>{fmtDT(t.ended_at || t.started_at)}</td><td>{t.patient_name}</td><td>{t.problem}</td><td>{t.ambulance_number}</td><td><Badge value={t.status} /></td></tr>
            ))}</tbody>
          </table></div>
        ) : <Empty>No history yet</Empty>}
      </Card>
    </>
  );
}
