# Frontend (Vite + React)
```
npm install
npm run dev      # http://localhost:5173  (start the Spring Boot backend first)
npm run build    # production build in dist/
```
`/api` is proxied to http://localhost:8080 (see vite.config.js). Maps: free OpenStreetMap + OSRM routing, no API key.
Pages: `/` login (all roles) · `/signup` · `/forgot` · `/find` (public: free ambulances near me) · `/admin` · `/driver` · `/hospital`.
