import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Free OpenStreetMap tiles: no API key, no billing, nothing to configure.
export const DEFAULT_CENTER = { lat: 16.5062, lng: 80.648 }; // Vijayawada
const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Creates a map inside the returned ref. onClick receives {lat,lng}. */
export function useMap({ center = DEFAULT_CENTER, zoom = 12, onClick } = {}) {
  const ref = useRef(null);
  const [map, setMap] = useState(null);
  const [error] = useState('');
  const clickRef = useRef(onClick);
  clickRef.current = onClick;
  useEffect(() => {
    if (!ref.current) return undefined;
    const m = L.map(ref.current, { zoomControl: true }).setView([center.lat, center.lng], zoom);
    L.tileLayer(TILES, { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
    // small helpers so pages can call map.setCenter({lat,lng}) / map.setZoom(n)
    m.setCenter = (p) => m.setView([Number(p.lat), Number(p.lng)], m.getZoom());
    m.on('click', (e) => clickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(ref.current);
    setMap(m);
    return () => { ro.disconnect(); m.remove(); setMap(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { ref, map, error };
}

export function pinIcon(emoji, color = '#b4534a') {
  return L.divIcon({
    className: 'pin',
    html: `<div style="background:${color};width:36px;height:36px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px #0004;display:grid;place-items:center;font-size:18px">${emoji}</div>`,
    iconSize: [36, 36], iconAnchor: [18, 18],
  });
}

/** Keeps a set of markers on the map, keyed by id. */
export function useMarkers(map) {
  const store = useRef(new Map());
  const upsert = useCallback((key, { lat, lng, emoji, color, title }) => {
    if (!map || lat == null || lng == null || lat === '' || lng === '') return;
    const pos = [Number(lat), Number(lng)];
    const cur = store.current.get(key);
    if (cur) {
      cur.setLatLng(pos);
      if (cur.__color !== color) { cur.setIcon(pinIcon(emoji, color)); cur.__color = color; }
      return;
    }
    const m = L.marker(pos, { icon: pinIcon(emoji, color), title }).addTo(map);
    if (title) m.bindTooltip(String(title));
    m.__color = color;
    store.current.set(key, m);
  }, [map]);
  const remove = useCallback((key) => { const m = store.current.get(key); if (m) { m.remove(); store.current.delete(key); } }, []);
  const clear = useCallback((prefix) => {
    [...store.current.keys()].filter((k) => !prefix || k.startsWith(prefix)).forEach(remove);
  }, [remove]);
  const fit = useCallback(() => {
    if (!map || !store.current.size) return;
    const pts = [...store.current.values()].map((m) => m.getLatLng());
    if (pts.length === 1) map.setView(pts[0], 15); else map.fitBounds(L.latLngBounds(pts), { padding: [50, 50] });
  }, [map]);
  return { upsert, remove, clear, fit };
}

export const distKm = (a, b) => {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
export const etaMin = (km) => Math.max(1, Math.round(km * 2)); // rough fallback: ~1.3x road distance at ~40 km/h

/** Road route + travel time from the free OSRM service. Falls back to a straight-line estimate if it is unreachable. */
export async function fetchRoute(a, b) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    const r = await fetch(url);
    const d = await r.json();
    const rt = d.routes?.[0];
    if (!rt) throw new Error('no route');
    return { km: rt.distance / 1000, min: Math.max(1, Math.round(rt.duration / 60)), line: rt.geometry.coordinates.map(([lng, lat]) => [lat, lng]) };
  } catch {
    const km = distKm(a, b);
    return { km, min: etaMin(km), line: null };
  }
}

/** Draws / clears a route line on the map. */
export function drawRoute(map, holder, line) {
  if (holder.current) { holder.current.remove(); holder.current = null; }
  if (map && line) holder.current = L.polyline(line, { color: '#2f5d62', weight: 5, opacity: 0.85 }).addTo(map);
}

/** Google Maps turn-by-turn navigation link (opens the Maps app on a phone). */
export const navLink = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
