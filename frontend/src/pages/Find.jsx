import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ambulance, ArrowLeft, Clock, LocateFixed, Phone } from 'lucide-react';
import { api } from '../lib/api.js';
import { DEFAULT_CENTER, useMap, useMarkers } from '../lib/maps.js';
import { Badge, Card, Empty, MapBox, Stat } from '../components/ui.jsx';

/** Public page (no login): free ambulances near the patient, with distance and arrival time. */
export default function Find() {
  const [me, setMe] = useState(null);
  const [data, setData] = useState({ available: [], availableCount: 0, busyCount: 0 });
  const [hospitals, setHospitals] = useState([]);
  const [msg, setMsg] = useState('');
  const { ref, map, error } = useMap({ center: DEFAULT_CENTER, zoom: 12 });
  const mk = useMarkers(map);
  const fitted = useRef(false);

  const locate = useCallback(() => {
    if (!navigator.geolocation) { setMsg('Location is not supported. Showing all free ambulances.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setMsg(''); setMe({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => setMsg('Location permission denied. Allow it to see the nearest ambulance and arrival time.'),
      { enableHighAccuracy: true, timeout: 10000 });
  }, []);
  useEffect(() => { locate(); }, [locate]);

  const load = useCallback(() => {
    const q = me ? `?lat=${me.lat}&lng=${me.lng}` : '';
    api(`/public/ambulances${q}`).then(setData).catch(() => {});
  }, [me]);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  useEffect(() => { api('/public/hospitals').then(setHospitals).catch(() => {}); }, []);

  useEffect(() => {
    if (!map) return;
    mk.clear();
    if (me) mk.upsert('me', { ...me, emoji: '📍', color: '#4d7ea8', title: 'You are here' });
    hospitals.forEach((h) => mk.upsert(`h${h.id}`, { ...h, emoji: '🏥', color: '#4d7ea8', title: h.name }));
    data.available.forEach((a) => mk.upsert(`a${a.id}`, { ...a, emoji: '🚑', color: '#4f8a63', title: a.ambulance_number }));
    if (!fitted.current && (me || data.available.length)) { fitted.current = true; mk.fit(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, me, data, hospitals]);

  return (
    <>
      <div className="find-top">
        <Link to="/" className="btn sm"><ArrowLeft size={15} />Login</Link>
        <b>Find a free ambulance</b>
        <button className="btn sm" onClick={() => { fitted.current = false; locate(); }}><LocateFixed size={15} />My location</button>
      </div>
      <div className="find-wrap">
        <div className="banner">🚨 In a life-threatening emergency call <b>108</b> (or 102) immediately. This page shows free ambulances registered in this system.</div>
        {msg && <div className="banner">{msg}</div>}
        <div className="kpis">
          <Stat icon={Ambulance} label="Free ambulances nearby" value={data.availableCount} tone="green" />
          <Stat icon={Clock} label="Ambulances on an emergency run" value={data.busyCount} tone="red" />
        </div>
        <div className="find-grid">
          <Card title="Nearest first" right={<span className="mut small">updates every 8 s</span>}>
            <div className="alist">
              {!data.available.length && <Empty>No free ambulance is on duty right now. Please call 108.</Empty>}
              {data.available.map((a, i) => (
                <div className="aitem" key={a.id}>
                  <div className="row between"><b>🚑 {a.ambulance_number}</b>{i === 0 && me && <Badge value="NEAREST" tone="green" />}</div>
                  <div className="mut small">{a.ambulance_type} {a.distance_km != null && <>· {a.distance_km} km away · about <b>{a.eta_min} min</b></>}</div>
                  {a.driver_phone && <a className="small" href={`tel:${a.driver_phone}`}><Phone size={12} /> Call driver {a.driver_phone}</a>}
                </div>
              ))}
            </div>
          </Card>
          <MapBox mapRef={ref} error={error} style={{ height: 560 }} />
        </div>
      </div>
    </>
  );
}
