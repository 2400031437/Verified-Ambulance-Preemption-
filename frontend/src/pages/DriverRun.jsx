import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Navigation, Phone, Save, XCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import { useLive } from '../lib/live.js';
import { distKm, drawRoute, fetchRoute, navLink, useMap, useMarkers } from '../lib/maps.js';
import { useGps } from '../lib/gps.jsx';
import { Badge, Card, Field, MapBox, useRun, useToast } from '../components/ui.jsx';

const PROBLEMS = ['Cardiac arrest / chest pain', 'Road accident / trauma', 'Stroke symptoms', 'Pregnancy / labour', 'Breathing difficulty', 'Burns', 'Unconscious', 'Other'];
const EMPTY = { problem: '', severity: 'SERIOUS', patient_name: '', patient_age: '', patient_gender: '', hospital_id: '', notes: '' };

export default function DriverRun() {
  const run = useRun();
  const toast = useToast();
  const [amb, setAmb] = useState(null);
  const [trip, setTrip] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const { pos, error: gpsError } = useGps();
  const [eta, setEta] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const { ref, map, error } = useMap();
  const mk = useMarkers(map);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(() => run(async () => {
    const d = await api('/driver/me');
    setAmb(d.ambulance); setTrip(d.trip);
    setHospitals(await api('/driver/hospitals'));
  }), [run]);
  useEffect(() => { load(); }, [load]);

  useLive({
    'trip:ended': () => { toast('Trip finished. Tag is back to NORMAL.'); load(); },
    'trip:ack': (e) => toast(`🏥 ${e.hospital}: ${e.hospital_ack}${e.hospital_note ? ` – ${e.hospital_note}` : ''}`),
    preempt: (e) => toast(`🟢 Signal ${e.signal_id || ''} cleared at ${e.location || e.reader_code}`),
    'hospital:update': () => load(),
  });

  // markers
  const centered = useRef(false);
  useEffect(() => {
    if (!map || !pos) return;
    mk.upsert('me', { ...pos, emoji: '🚑', color: trip ? '#b4534a' : '#4f8a63', title: 'You' });
    if (!centered.current) { centered.current = true; map.setCenter(pos); map.setZoom(14); }
  }, [map, pos, trip, mk]);
  useEffect(() => {
    if (!map) return;
    mk.clear('h');
    if (trip) mk.upsert('hd', { lat: trip.hospital_lat, lng: trip.hospital_lng, emoji: '🏥', color: '#4d7ea8', title: trip.hospital_name });
    else hospitals.forEach((h) => mk.upsert(`h${h.id}`, { ...h, emoji: '🏥', color: '#4d7ea8', title: h.name }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, trip, hospitals]);

  // road route + ETA to the hospital (refreshed every ~15 s, free OSRM service)
  const lastRoute = useRef(0);
  const line = useRef(null);
  useEffect(() => {
    if (!trip) { drawRoute(map, line, null); setEta(''); return; }
    if (!map || !pos || Date.now() - lastRoute.current < 15000) return;
    lastRoute.current = Date.now();
    fetchRoute(pos, { lat: Number(trip.hospital_lat), lng: Number(trip.hospital_lng) })
      .then((r) => { drawRoute(map, line, r.line); setEta(`${r.km.toFixed(1)} km · ${r.min} min`); });
  }, [map, trip, pos]);

  const sorted = useMemo(() => hospitals
    .map((h) => ({ ...h, km: pos ? distKm(pos, { lat: Number(h.lat), lng: Number(h.lng) }) : null }))
    .sort((a, b) => (pos ? a.km - b.km : a.name.localeCompare(b.name))), [hospitals, pos]);

  const ready = amb && Number(amb.is_enabled) && amb.rfid_tag_uid;
  const save = (e) => {
    e.preventDefault();
    setBusy(true);
    run(async () => {
      await api('/driver/trip', 'POST', form);
      toast('✅ Saved. Tag ACTIVATED and hospital alerted.');
      setForm(EMPTY); await load();
    }).finally(() => setBusy(false));
  };
  const end = (status) => run(async () => { await api('/driver/trip/end', 'POST', { status }); await load(); });

  return (
    <div className="page-grid">
      <div className="gap" style={{ alignContent: 'start' }}>
        {amb && (
          <div className={`tagcard ${amb.tag_status}`} style={{ padding: 16 }}>
            <span style={{ opacity: 0.85, fontWeight: 600, fontSize: 12 }}>RFID TAG</span><b style={{ fontSize: 24 }}>{amb.tag_status}</b>
            <span className="small">{amb.ambulance_number} · {amb.ambulance_type}</span>
          </div>
        )}
        {gpsError && <div className="banner">📍 {gpsError}</div>}
        {amb && !ready && <div className="banner">⏳ Not verified yet. The admin must approve you and link an RFID tag.</div>}

        {trip ? (
          <Card title="🚨 Emergency run active">
            <div className="gap">
              <div className="row wrap"><Badge value={trip.severity} /><b>{trip.problem}</b></div>
              <div className="mut small">Patient: {trip.patient_name} {trip.patient_age ? `· ${trip.patient_age} yrs` : ''} {trip.patient_gender || ''}</div>
              <div><b>🏥 {trip.hospital_name}</b><div className="mut small">{trip.hospital_address}</div>
                {trip.hospital_phone && <a className="small" href={`tel:${trip.hospital_phone}`}><Phone size={12} /> {trip.hospital_phone}</a>}</div>
              <div className="small">Hospital status: <Badge value={trip.hospital_ack} /> {trip.hospital_note}</div>
              <div className="mut small">The tag is ACTIVE: road-side readers turn signals green for you. It returns to NORMAL when you reach the hospital.</div>
              <a className="btn primary block" href={navLink(trip.hospital_lat, trip.hospital_lng)} target="_blank" rel="noreferrer"><Navigation size={16} />Open turn-by-turn navigation</a>
              <div className="row">
                <button className="btn ok grow" onClick={() => end('ARRIVED')}><CheckCircle2 size={16} />Arrived</button>
                <button className="btn danger grow" onClick={() => window.confirm('Cancel the run and deactivate the tag?') && end('CANCELLED')}><XCircle size={16} />Cancel</button>
              </div>
            </div>
          </Card>
        ) : (
          <Card title="🚨 Emergency details">
            <form onSubmit={save}>
              <Field label="Patient problem *">
                <div className="chips">{PROBLEMS.map((p) => <button type="button" key={p} className={`chip ${form.problem === p ? 'on' : ''}`} onClick={() => set('problem', p)}>{p}</button>)}</div>
                <input value={form.problem} onChange={(e) => set('problem', e.target.value)} placeholder="Select above or type" required />
              </Field>
              <Field label="Severity">
                <select value={form.severity} onChange={(e) => set('severity', e.target.value)}>
                  <option value="CRITICAL">🔴 Critical</option><option value="SERIOUS">🟠 Serious</option><option value="STABLE">🟢 Stable</option>
                </select>
              </Field>
              <div className="grid3">
                <Field label="Patient name"><input value={form.patient_name} onChange={(e) => set('patient_name', e.target.value)} placeholder="Unknown" /></Field>
                <Field label="Age"><input type="number" min="0" max="120" value={form.patient_age} onChange={(e) => set('patient_age', e.target.value)} /></Field>
                <Field label="Gender"><select value={form.patient_gender} onChange={(e) => set('patient_gender', e.target.value)}><option value="">-</option><option>Male</option><option>Female</option><option>Other</option></select></Field>
              </div>
              <Field label={`Destination hospital * ${pos ? '(★ = nearest)' : ''}`}>
                <select required value={form.hospital_id} onChange={(e) => set('hospital_id', e.target.value)}>
                  <option value="">Select hospital…</option>
                  {sorted.map((h, i) => <option key={h.id} value={h.id}>{i === 0 && pos ? '★ ' : ''}{h.name}{h.km != null ? ` · ${h.km.toFixed(1)} km` : ''} · ICU {h.icu_beds_available ?? 0} · ER {h.emergency_beds_available ?? 0}</option>)}
                </select>
              </Field>
              <Field label="Notes for hospital (optional)"><textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Vitals, allergies, bystander info…" /></Field>
              <button className="btn primary block lg" disabled={!ready || busy}><Save size={18} />Save &amp; ACTIVATE TAG</button>
            </form>
          </Card>
        )}
      </div>
      <MapBox mapRef={ref} error={error} style={{ minHeight: 420 }}>{eta && <div className="mapfloat">🏥 {eta}</div>}</MapBox>
    </div>
  );
}
