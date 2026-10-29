import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Ambulance, Building2, Siren, Timer, UserCheck, Zap, RadioTower } from 'lucide-react';
import { api } from '../lib/api.js';
import { useLive } from '../lib/live.js';
import { useMap, useMarkers } from '../lib/maps.js';
import { fillDays, fmtDT, timeAgo } from '../lib/format.js';
import { AreaTrend, BarsDay, Donut, HBars } from '../components/Charts.jsx';
import { Badge, Card, Empty, MapBox, Stat, useRun } from '../components/ui.jsx';

export default function AdminDashboard() {
  const nav = useNavigate();
  const run = useRun();
  const [stats, setStats] = useState(null);
  const [an, setAn] = useState(null);
  const [feed, setFeed] = useState([]);
  const { ref, map, error } = useMap();
  const mk = useMarkers(map);

  const load = useCallback(() => run(async () => {
    setStats(await api('/admin/stats'));
    setAn(await api('/admin/analytics'));
  }), [run]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!map) return;
    run(async () => {
      const L = await api('/admin/live');
      L.hospitals.forEach((h) => mk.upsert(`h${h.id}`, { ...h, emoji: '🏥', color: '#4d7ea8', title: h.name }));
      L.readers.forEach((r) => mk.upsert(`r${r.id}`, { ...r, emoji: '📡', color: '#7a6a9a', title: r.reader_code }));
      L.ambulances.forEach((a) => mk.upsert(`a${a.id}`, { ...a, emoji: '🚑', color: a.tag_status === 'ACTIVE' ? '#b4534a' : '#4f8a63', title: a.ambulance_number }));
      mk.fit();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  const push = (icon, text) => setFeed((f) => [{ id: Math.random(), icon, text, at: new Date().toISOString() }, ...f].slice(0, 30));
  useLive({
    location: (e) => mk.upsert(`a${e.ambulance_id}`, { lat: e.lat, lng: e.lng, emoji: '🚑', color: e.active ? '#b4534a' : '#4f8a63', title: e.ambulance_number }),
    scan: (e) => { push(e.result === 'PREEMPT' ? '🟢' : '⚪', `${e.reader_code}: ${e.result.replace(/_/g, ' ')}${e.ambulance_number ? ` (${e.ambulance_number})` : ''}`); load(); },
    'trip:new': (e) => { push('🚨', `${e.ambulance_number} → ${e.hospital_name}: ${e.problem}`); load(); },
    'trip:ended': (e) => { push('🏁', `Trip #${e.trip_id} ${e.status.toLowerCase()}`); load(); },
  });

  const days = fillDays(an?.scansPerDay, ['preempt', 'total']);
  const trips = fillDays(an?.tripsPerDay, ['trips']);

  return (
    <>
      <div className="kpis">
        <Stat icon={Ambulance} label="Ambulances" value={stats?.ambulances} tone="blue" />
        <Stat icon={Building2} label="Hospitals" value={stats?.hospitals} tone="green" />
        <Stat icon={RadioTower} label="Readers online" value={stats ? `${an?.readersOnline ?? 0} / ${stats.readers}` : '-'} tone="amber" />
        <Stat icon={Siren} label="Active emergencies" value={stats?.activeTrips} tone="red" />
        <Stat icon={Zap} label="Signals cleared today" value={stats?.preemptionsToday} tone="red" />
        <Stat icon={Timer} label="Avg trip (min)" value={an?.avgTripMinutes ?? '-'} tone="blue" />
        <Stat icon={UserCheck} label="Pending approvals" value={stats?.pendingUsers} tone="amber" onClick={() => nav('/admin/approvals')} />
      </div>

      <div className="gridA">
        <Card title="Live map" right={<span className="mut small">🚑 ambulance · 🏥 hospital · 📡 reader</span>}>
          <MapBox mapRef={ref} error={error} style={{ height: 400 }} />
        </Card>
        <Card title="Live activity" right={<span className="small"><span className="dot live" /> live</span>}>
          <div className="feed">
            {feed.length === 0 && <Empty>Waiting for events…</Empty>}
            {feed.map((f) => (
              <div className="item" key={f.id}><span style={{ fontSize: 18 }}>{f.icon}</span><div><div>{f.text}</div><div className="mut small">{timeAgo(f.at)}</div></div></div>
            ))}
          </div>
        </Card>
      </div>

      <div className="gridB">
        <Card title="Signals cleared · last 7 days">
          <AreaTrend data={days} series={[{ key: 'preempt', name: 'Signals cleared', color: '#b4534a' }, { key: 'total', name: 'All scans', color: '#4d7ea8' }]} />
        </Card>
        <Card title="Emergency trips · last 7 days"><BarsDay data={trips} /></Card>
      </div>

      <div className="grid3">
        <Card title="Scan results"><Donut data={an?.scanResults} /></Card>
        <Card title="Trip outcomes"><Donut data={an?.tripStatus} /></Card>
        <Card title="Top emergencies"><HBars data={an?.topProblems} /></Card>
      </div>

      <Card title="Recent trips" right={<Activity size={18} className="mut" />}>
        {an?.recentTrips?.length ? (
          <div className="tablewrap"><table>
            <thead><tr><th>Time</th><th>Ambulance</th><th>Hospital</th><th>Problem</th><th>Severity</th><th>Status</th></tr></thead>
            <tbody>{an.recentTrips.map((t) => (
              <tr key={t.id}><td>{fmtDT(t.started_at)}</td><td><b>{t.ambulance_number}</b></td><td>{t.hospital_name}</td><td>{t.problem}</td><td><Badge value={t.severity} /></td><td><Badge value={t.status} /></td></tr>
            ))}</tbody>
          </table></div>
        ) : <Empty>No trips yet</Empty>}
      </Card>
    </>
  );
}
