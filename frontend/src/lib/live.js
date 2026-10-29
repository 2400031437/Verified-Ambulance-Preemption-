import { useEffect, useRef } from 'react';
import { getToken, streamUrl } from './api.js';

/** Real-time events from Spring Boot (Server-Sent Events). Usage: useLive({ 'trip:new': e => ..., location: e => ... }) */
export function useLive(handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!getToken()) return undefined;
    const es = new EventSource(streamUrl());
    Object.keys(ref.current).forEach((name) => {
      es.addEventListener(name, (m) => {
        try { ref.current[name]?.(JSON.parse(m.data)); } catch (e) { console.error(e); }
      });
    });
    return () => es.close();
  }, []);
}
