import { useEffect, useState } from 'react';
import { Crosshair, Save } from 'lucide-react';
import { api } from '../lib/api.js';
import { useMap, useMarkers } from '../lib/maps.js';
import { Card, Field, MapBox, useRun, useToast } from '../components/ui.jsx';

const KEYS = ['name', 'address', 'phone', 'specialties', 'icu_beds_available', 'emergency_beds_available', 'lat', 'lng'];

export default function HospitalProfile() {
  const run = useRun();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const { ref, map, error } = useMap({ onClick: (p) => { set('lat', +p.lat.toFixed(7)); set('lng', +p.lng.toFixed(7)); } });
  const mk = useMarkers(map);

  useEffect(() => { run(async () => { const h = await api('/hospital/me'); const f = {}; KEYS.forEach((k) => { f[k] = h[k] ?? ''; }); setForm(f); }); }, [run]);
  useEffect(() => {
    if (!map || !form || form.lat === '' || form.lng === '') return;
    mk.upsert('pin', { lat: form.lat, lng: form.lng, emoji: '🏥', color: '#4d7ea8', title: form.name });
    map.setCenter({ lat: Number(form.lat), lng: Number(form.lng) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, form?.lat, form?.lng]);

  const here = () => navigator.geolocation.getCurrentPosition(
    (p) => { set('lat', +p.coords.latitude.toFixed(7)); set('lng', +p.coords.longitude.toFixed(7)); },
    () => toast('Location permission denied', 'err'));
  const save = (e) => { e.preventDefault(); run(async () => { await api('/hospital/me', 'PUT', form); toast('Profile saved. Drivers see the update instantly.'); }); };
  if (!form) return null;

  return (
    <div className="gridB">
      <Card title="Hospital profile & bed availability">
        <form onSubmit={save}>
          <Field label="Hospital name"><input required value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Address"><input value={form.address} onChange={(e) => set('address', e.target.value)} /></Field>
          <div className="grid2">
            <Field label="Phone"><input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Specialties"><input placeholder="Cardiology, Trauma, Neuro" value={form.specialties} onChange={(e) => set('specialties', e.target.value)} /></Field>
            <Field label="ICU beds free"><input type="number" min="0" value={form.icu_beds_available} onChange={(e) => set('icu_beds_available', e.target.value)} /></Field>
            <Field label="Emergency beds free"><input type="number" min="0" value={form.emergency_beds_available} onChange={(e) => set('emergency_beds_available', e.target.value)} /></Field>
            <Field label="Latitude"><input type="number" step="any" value={form.lat} onChange={(e) => set('lat', e.target.value)} /></Field>
            <Field label="Longitude"><input type="number" step="any" value={form.lng} onChange={(e) => set('lng', e.target.value)} /></Field>
          </div>
          <div className="row">
            <button type="button" className="btn" onClick={here}><Crosshair size={16} />Use my location</button>
            <button className="btn primary grow"><Save size={16} />Save profile</button>
          </div>
          <p className="mut small">📍 You can also click the map to place your hospital.</p>
        </form>
      </Card>
      <MapBox mapRef={ref} error={error} style={{ minHeight: 440 }} />
    </div>
  );
}
