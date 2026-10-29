import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const Ctx = createContext({ pos: null, error: '' });
export const useGps = () => useContext(Ctx);

/** Watches the driver's phone GPS on every driver page and sends it to the server every 4 seconds. */
export function GpsProvider({ children }) {
  const [pos, setPos] = useState(null);
  const [error, setError] = useState('');
  const last = useRef(0);
  useEffect(() => {
    if (!navigator.geolocation) { setError('GPS is not supported on this device'); return undefined; }
    const id = navigator.geolocation.watchPosition((p) => {
      const c = { lat: p.coords.latitude, lng: p.coords.longitude };
      setPos(c); setError('');
      if (Date.now() - last.current > 4000) { last.current = Date.now(); api('/driver/location', 'POST', c).catch(() => {}); }
    }, (e) => setError(`Allow location access in the browser: ${e.message}`), { enableHighAccuracy: true, maximumAge: 1000 });
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  return <Ctx.Provider value={{ pos, error }}>{children}</Ctx.Provider>;
}
