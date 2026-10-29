import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useMap, useMarkers } from '../lib/maps.js';
import { fmtDT } from '../lib/format.js';
import { Badge, Field, MapBox, Modal, useRun, useToast } from '../components/ui.jsx';

const yesNo = (v) => (Number(v) ? <Badge value="Enabled" tone="green" /> : <Badge value="Disabled" tone="amber" />);

function FormModal({ title, fields, geo, initial, onClose, onSave }) {
  const [form, setForm] = useState(() => {
    const f = {};
    fields.forEach((x) => { f[x.k] = String(initial[x.k] ?? (x.options ? x.options[0] : '')); });
    if (geo) { f.lat = initial.lat ?? ''; f.lng = initial.lng ?? ''; }
    return f;
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const has = form.lat !== '' && form.lng !== '' && form.lat != null;
  const { ref, map, error } = useMap({
    center: has ? { lat: Number(form.lat), lng: Number(form.lng) } : undefined, zoom: has ? 15 : 11,
    onClick: (p) => { set('lat', +p.lat.toFixed(7)); set('lng', +p.lng.toFixed(7)); },
  });
  const mk = useMarkers(map);
  useEffect(() => { if (map && form.lat !== '' && form.lng !== '') mk.upsert('pin', { lat: form.lat, lng: form.lng, emoji: '📍', color: '#b4534a' }); }, [map, form.lat, form.lng, mk]);

  return (
    <Modal open onClose={onClose} title={title} wide={geo}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
        <div className="grid2">
          {fields.map((x) => (
            <Field key={x.k} label={x.label}>
              {x.options
                ? <select value={form[x.k]} onChange={(e) => set(x.k, e.target.value)}>{x.options.map((o) => <option key={o}>{o}</option>)}</select>
                : <input type={x.type || 'text'} step="any" value={form[x.k]} onChange={(e) => set(x.k, e.target.value)} required={x.required} />}
            </Field>
          ))}
        </div>
        {geo && (
          <>
            <div className="grid2">
              <Field label="Latitude"><input type="number" step="any" value={form.lat} onChange={(e) => set('lat', e.target.value)} /></Field>
              <Field label="Longitude"><input type="number" step="any" value={form.lng} onChange={(e) => set('lng', e.target.value)} /></Field>
            </div>
            <p className="mut small">📍 Click on the map to set the location</p>
            <MapBox mapRef={ref} error={error} style={{ height: 240, marginBottom: 14 }} />
          </>
        )}
        <button className="btn primary block lg">Save</button>
      </form>
    </Modal>
  );
}

function CrudPage({ entity, label, columns, fields, geo }) {
  const run = useRun();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => run(async () => setRows(await api(`/admin/${entity}`))), [entity, run]);
  useEffect(() => { load(); }, [load]);

  const shown = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
  const save = (form) => run(async () => {
    if (edit.id) await api(`/admin/${entity}/${edit.id}`, 'PUT', form); else await api(`/admin/${entity}`, 'POST', form);
    setEdit(null); toast('Saved'); load();
  });
  const del = (r) => window.confirm('Delete this record?') && run(async () => { await api(`/admin/${entity}/${r.id}`, 'DELETE'); toast('Deleted'); load(); });

  return (
    <>
      <div className="row between wrap">
        <div style={{ position: 'relative', width: 300, maxWidth: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--mut)' }} />
          <input style={{ paddingLeft: 36 }} placeholder={`Search ${label.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn primary" onClick={() => setEdit({})}><Plus size={16} />Add {label.replace(/s$/, '')}</button>
      </div>
      <div className="tablewrap card" style={{ padding: 0 }}>
        <table>
          <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th /></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                {columns.map((c) => <td key={c.key}>{c.render ? c.render(r) : (r[c.key] ?? '-')}</td>)}
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button className="btn sm" onClick={() => setEdit(r)}><Pencil size={14} />Edit</button>{' '}
                  <button className="btn sm danger" onClick={() => del(r)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={columns.length + 1} className="empty">Nothing here yet. Click "Add".</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && <FormModal title={`${edit.id ? 'Edit' : 'Add'} ${label.replace(/s$/, '')}`} fields={fields} geo={geo} initial={edit} onClose={() => setEdit(null)} onSave={save} />}
    </>
  );
}

export const AmbulancesPage = () => (
  <CrudPage entity="ambulances" label="Ambulances"
    columns={[
      { key: 'ambulance_number', label: 'Ambulance', render: (r) => <b>{r.ambulance_number}</b> },
      { key: 'rfid_tag_uid', label: 'RFID tag', render: (r) => (r.rfid_tag_uid ? <span className="mono">{r.rfid_tag_uid}</span> : <Badge value="not linked" tone="amber" />) },
      { key: 'ambulance_type', label: 'Type' }, { key: 'driver_name', label: 'Driver' }, { key: 'driver_phone', label: 'Phone' },
      { key: 'tag_status', label: 'Tag', render: (r) => <Badge value={r.tag_status} /> },
      { key: 'is_enabled', label: 'State', render: (r) => yesNo(r.is_enabled) },
    ]}
    fields={[
      { k: 'ambulance_number', label: 'Ambulance number', required: true }, { k: 'rfid_tag_uid', label: 'RFID tag UID (hex)' },
      { k: 'ambulance_type', label: 'Type', options: ['BASIC', 'ADVANCED', 'ICU', 'NEONATAL'] },
      { k: 'driver_name', label: 'Driver name' }, { k: 'driver_phone', label: 'Driver phone' },
      { k: 'driver_login_phone', label: 'Driver login phone (if registered)', type: 'tel' }, { k: 'owner_name', label: 'Owner / dealer' },
      { k: 'is_enabled', label: 'Enabled (1 = yes)', options: ['1', '0'] },
    ]} />
);

export const HospitalsPage = () => (
  <CrudPage entity="hospitals" label="Hospitals" geo
    columns={[
      { key: 'name', label: 'Hospital', render: (r) => <b>{r.name}</b> }, { key: 'address', label: 'Address' }, { key: 'phone', label: 'Phone' },
      { key: 'lat', label: 'Location', render: (r) => (r.lat ? `${Number(r.lat).toFixed(4)}, ${Number(r.lng).toFixed(4)}` : <Badge value="not set" tone="amber" />) },
      { key: 'icu_beds_available', label: 'ICU beds' }, { key: 'emergency_beds_available', label: 'ER beds' }, { key: 'user_login_phone', label: 'Login phone' },
    ]}
    fields={[
      { k: 'name', label: 'Hospital name', required: true }, { k: 'address', label: 'Address' }, { k: 'phone', label: 'Phone' },
      { k: 'specialties', label: 'Specialties (comma separated)' },
      { k: 'icu_beds_available', label: 'ICU beds available', type: 'number' }, { k: 'emergency_beds_available', label: 'Emergency beds available', type: 'number' },
      { k: 'user_login_phone', label: 'Reception login phone (if registered)', type: 'tel' },
    ]} />
);

export const ReadersPage = () => (
  <CrudPage entity="readers" label="RFID readers" geo
    columns={[
      { key: 'reader_code', label: 'Reader', render: (r) => <b>{r.reader_code}</b> }, { key: 'location_name', label: 'Location' }, { key: 'signal_id', label: 'Signal' },
      { key: 'approach_direction', label: 'Approach' }, { key: 'green_seconds', label: 'Green (s)' },
      { key: 'api_key', label: 'API key (put in STM32 app_config.h)', render: (r) => <span className="mono">{r.api_key}</span> },
      { key: 'last_heartbeat', label: 'Status', render: (r) => (r.last_heartbeat
        ? (Date.now() - new Date(r.last_heartbeat) < 90000 ? <span><span className="dot live" /> online</span> : <span className="mut"><span className="dot off" /> {fmtDT(r.last_heartbeat)}</span>)
        : <span className="mut"><span className="dot off" /> never</span>) },
    ]}
    fields={[
      { k: 'reader_code', label: 'Reader code (e.g. READER-002)', required: true }, { k: 'location_name', label: 'Location name' }, { k: 'signal_id', label: 'Signal / junction ID' },
      { k: 'approach_direction', label: 'Approach direction', options: ['N', 'S', 'E', 'W'] },
      { k: 'distance_to_signal_m', label: 'Distance before signal (m)', type: 'number' }, { k: 'green_seconds', label: 'Green duration (sec)', type: 'number' },
      { k: 'is_enabled', label: 'Enabled (1 = yes)', options: ['1', '0'] },
    ]} />
);
