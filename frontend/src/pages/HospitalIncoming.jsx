import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useLive } from '../lib/live.js';
import { distKm, etaMin, useMap, useMarkers } from '../lib/maps.js';
import { Badge, Card, Empty, MapBox, useRun, useToast } from '../components/ui.jsx';

const PREP = [
  [/cardiac|chest|heart/i, 'ECG + defibrillator ready, cath lab / cardiologist on call, IV access'],
  [/stroke|paralys|speech/i, 'CT scan slot, neurologist alert, thrombolysis kit, note time of symptom onset'],
  [/accident|trauma|fracture|bleed|injur/i, 'Trauma team, O-negative blood, OT on standby, orthopaedic / surgeon'],
  [/pregnan|labour|labor|delivery/i, 'Labour room, gynaecologist, NICU / paediatrician alert'],
  [/breath|asthma|oxygen/i, 'Oxygen, nebuliser / ventilator, pulmonologist'],
  [/burn/i, 'Burn unit, IV fluids, pain control, plastic surgeon'],
  [/unconscious|collapse|seizure/i, 'Resuscitation bay, glucose check, neurologist, CT'],
];
const prep = (p) => (PREP.find((x) => x[0].test(p)) || [null, 'Emergency bay and duty doctor ready'])[1];

function beep() {
  try { const c = new AudioContext(); const o = c.createOscillator(); o.frequency.value = 880; o.connect(c.destination); o.start(); setTimeout(() => { o.stop(); c.close(); }, 450); } catch { /* ignore */ }
}

export default function HospitalIncoming() {
  const run = useRun();
  const toast = useToast();
  const [hosp, setHosp] = useState(null);
  const [trips, setTrips] = useState([]);
  const [notes, setNotes] = useState({});
  const { ref, map, error } = useMap();
  const mk = useMarkers(map);

  const load = useCallback(() => run(async () => {
    const d = await api('/hospital/incoming');
    mk.clear('a');
    setTrips(d.active);
    setNotes((n) => { const o = { ...n }; d.active.forEach((t) => { if (o[t.id] === undefined) o[t.id] = t.hospital_note || ''; }); return o; });
  }), [run, mk]);

  useEffect(() => { run(async () => setHosp(await api('/hospital/me'))); load(); }, [run, load]);

  useEffect(() => {
    if (!map || !hosp?.lat) return;
    mk.upsert('home', { lat: hosp.lat, lng: hosp.lng, emoji: '🏥', color: '#4d7ea8', title: hosp.name });
    map.setCenter({ lat: Number(hosp.lat), lng: Number(hosp.lng) });
  }, [map, hosp, mk]);
  useEffect(() => {
    if (!map) return;
    trips.forEach((t) => { if (t.last_lat) mk.upsert(`a${t.ambulance_id}`, { lat: t.last_lat, lng: t.last_lng, emoji: '🚑', color: '#b4534a', title: t.ambulance_number }); });
  }, [map, trips, mk]);

  useLive({
    'trip:new': (t) => { beep(); toast(`🚨 New patient: ${t.problem} (${t.ambulance_number})`); load(); },
    'trip:ended': () => load(),
    preempt: (e) => toast(`🟢 Signal cleared for ${e.ambulance_number} at ${e.location || e.reader_code}`),
    location: (e) => setTrips((ts) => ts.map((t) => (t.id === e.trip_id ? { ...t, last_lat: e.lat, last_lng: e.lng } : t))),
  });

  const ack = (id, hospital_ack) => run(async () => {
    await api(`/hospital/trips/${id}`, 'PATCH', { hospital_ack, hospital_note: notes[id] });
    toast('Driver notified'); load();
  });
  const etaOf = (t) => {
    if (!t.last_lat) return 'Waiting for ambulance GPS…';
    if (!hosp?.lat) return 'Set hospital location to see ETA';
    const km = distKm({ lat: Number(t.last_lat), lng: Number(t.last_lng) }, { lat: Number(hosp.lat), lng: Number(hosp.lng) });
    return `📍 ${km.toFixed(1)} km away · ETA ~${etaMin(km)} min`;
  };

  return (
    <div className="page-grid">
      <div className="gap" style={{ alignContent: 'start' }}>
        <div className="row between"><h3>🚨 Incoming patients <Badge value={trips.length} tone="red" /></h3><span className="small"><span className="dot live" /> live</span></div>
        {!trips.length && <Card><Empty>No ambulance on the way</Empty></Card>}
        {trips.map((t) => (
          <div key={t.id} className={`card alert ${t.severity}`}>
            <div className="row between"><div className="row"><Badge value={t.severity} /><Badge value={t.hospital_ack} /></div><b>{t.ambulance_number}</b></div>
            <h3 style={{ fontSize: 18 }}>{t.problem}</h3>
            <div>👤 <b>{t.patient_name}</b> <span className="mut">{t.patient_age ? `· ${t.patient_age} yrs` : ''} {t.patient_gender || ''}</span></div>
            {t.notes && <div className="mut small">📝 {t.notes}</div>}
            <div className="small">🚑 {t.ambulance_type} · {t.driver_name} {t.driver_phone && <a href={`tel:${t.driver_phone}`}>{t.driver_phone}</a>}</div>
            <b>{etaOf(t)}</b>
            <div className="prep">🧰 <b>Suggested preparation:</b> {prep(t.problem)}</div>
            <textarea rows={2} placeholder="Message to driver / team (e.g. Bay 2 ready, take the east gate)" value={notes[t.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [t.id]: e.target.value }))} />
            <div className="row"><button className="btn grow" onClick={() => ack(t.id, 'ACKNOWLEDGED')}>👍 Acknowledge</button><button className="btn ok grow" onClick={() => ack(t.id, 'READY')}>✅ Team ready</button></div>
          </div>
        ))}
      </div>
      <MapBox mapRef={ref} error={error} style={{ minHeight: 420 }} />
    </div>
  );
}
