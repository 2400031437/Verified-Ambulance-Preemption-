# Verified Ambulance Preemption System
Spring Boot + MySQL backend · React (Vite) frontend · STM32 RFID reader

```
ambulance-preemption-system/
├── pom.xml            (root pom: so "import the root folder" also finds a pom.xml)
├── backend/           Spring Boot project  (has its own pom.xml, mvnw, mvnw.cmd)
├── frontend/          Vite + React        (npm install / npm run dev)
└── stm32-firmware/    STM32 code + wiring  (see its README.md)
```

## 0. Install once
| Tool | Version | Check |
|---|---|---|
| JDK | 17 or newer (21 is fine) | `java -version` |
| MySQL Server | 8.x, running | `mysql --version` |
| Node.js | 18 or newer | `node -v` |
| VS Code + "Extension Pack for Java" + "Spring Boot Extension Pack" | | |

Maven does **not** need to be installed: `backend/mvnw` downloads it by itself (internet needed the first time).

## 1. Backend (Spring Boot + MySQL)
1. Open `backend/src/main/resources/application.properties` and change the MySQL password if yours is not `root`:
   `spring.datasource.password=${DB_PASSWORD:root}` → put your password in place of `root`.
   The database `ambulance_db` and all tables are created automatically.
2. Run it (choose ONE way):
   - **Terminal (simplest):**
     ```
     cd backend
     ./mvnw spring-boot:run          (Windows:  mvnw.cmd spring-boot:run)
     ```
   - **VS Code:** File → Open Folder → the `backend` folder (or the root folder). Wait for "Java: Ready" at the bottom,
     open `PreemptionApplication.java` and click **Run** above `main`.
   - **Spring Tool Suite / Eclipse:** File → Import → Maven → Existing Maven Projects → select the **`backend`** folder (or the root folder), then Run As → Spring Boot App.
3. Success looks like `Started PreemptionApplication` and these lines in the console:
   ```
   ADMIN LOGIN  ->  phone: 9999999999   PIN: 1234
   DEMO LOGINS  ->  driver 9000000001 / 1111   |   hospital 9000000002 / 2222
   ```
   Backend address: http://localhost:8080

## 2. Frontend (VS Code)
Open the `frontend` folder in VS Code, then in its terminal:
```
npm install
npm run dev
```
Open **http://localhost:5173**. Start the backend first. Vite forwards `/api` to port 8080, so nothing else to configure.
Maps use free OpenStreetMap: **no Google key, no billing, nothing to set up.**

## 3. Login (one page for everybody)
Enter **phone number + PIN**; the system checks the role in the database and opens the right dashboard.

| Who | Phone | PIN |
|---|---|---|
| Admin (only one) | `9999999999` | `1234`  ← change `app.admin.phone` / `app.admin.pin` in `application.properties`, restart |
| Demo driver | `9000000001` | `1111` |
| Demo hospital | `9000000002` | `2222` |

* **Sign up**: driver or hospital registers (name, phone, PIN, security question, ambulance / hospital details). The admin must approve them in *Approvals*.
* **Forgot PIN**: phone number → security question → new PIN. If the answer is forgotten, the admin uses *Approvals → Reset PIN*.
  The admin PIN is changed only in `application.properties`.
* 5 wrong PINs lock that phone number for 5 minutes.
* Set `app.seed-demo=false` to remove the demo hospitals / driver for real use.

## 4. Test the whole flow without hardware (10 minutes)
1. Login as **driver** (9000000001 / 1111) → *Dashboard* → **Go on duty** (allow location in the browser).
2. Open a private window → http://localhost:5173/find → you see **1 free ambulance** with distance and arrival time.
3. Driver → *Emergency run* → fill problem + choose hospital → **Save & ACTIVATE TAG**. Route, time and a "turn-by-turn navigation" button (opens Google Maps app on a phone) appear. The tag is now ACTIVE and the ambulance disappears from the Find page (it counts under "on an emergency run").
4. Login as **hospital** (9000000002 / 2222) in another window → *Incoming patients*: alert with patient problem, severity, live ambulance on map, **Acknowledge / Ready**.
5. Login as **admin** → *Scan log & test* → simulate tag `E2000017221101441890` on `READER-001` → result `PREEMPT` (green for N seconds). With hardware the STM32 does this by itself.
6. Driver presses **Arrived** (or reaches the hospital within 120 m): tag returns to NORMAL.

## 5. Hardware (STM32) link
See `stm32-firmware/README.md`. The STM32 calls `GET /api/reader/scan-lite?reader_code=...&api_key=...&tag_uid=...` on the PC's IP address
(port 8080, allow it in the firewall) and obeys the reply `GREEN,25,N,SIG-01`. Create each reader in *Admin → RFID readers* and copy its API key into `app_config.h`.
Browser test of the link (no hardware):
`http://localhost:8080/api/reader/scan-lite?reader_code=READER-001&api_key=demo-reader-key&tag_uid=E2000017221101441890`

## 6. Typical problems
| Message | Fix |
|---|---|
| "no pom.xml" when importing | Import the `backend` folder (or the root folder of this zip, which now has a pom.xml). Do not import the `frontend` folder or a folder that contains the zip folder. |
| `Access denied for user 'root'` | Wrong MySQL password in `application.properties` (or set env var `DB_PASSWORD`). |
| `Communications link failure` | MySQL is not running. Start the MySQL service. |
| `Port 8080 already in use` | Close the other program, or set `server.port=8081` and change the target in `frontend/vite.config.js`. |
| Frontend shows "Database error / Failed to fetch" | Backend is not running yet. Start it, refresh. |
| `mvnw: Permission denied` (Linux/macOS) | `chmod +x backend/mvnw` |
| Map is grey | Needs internet for map tiles. |
| Browser does not share GPS on a phone | GPS needs HTTPS; use `localhost` on a PC, or serve behind HTTPS. |

## 7. What was added to make the system more effective
* Severity + suggested preparation for the hospital, bed availability (ICU / ER), nearest hospital first for the driver.
* Tag returns to NORMAL automatically: Arrived/Cancel button, arrival geofence (120 m), 120-minute timeout.
* Duty status and live GPS so patients can see free ambulances nearby (`/find`).
* Scan log, reader online status and live admin map/charts.
* Ideas for later: SMS/WhatsApp alert to hospital, a physical "ACTIVATE" button on the ambulance wired to the STM32, speech-to-text patient details, per-junction green-wave routing.

## Verification status
Checked in my build environment: the frontend installs and builds (`npm run build`); `schema.sql` and the new queries run on a MariaDB server (twice, to check it is repeatable);
Java files pass a syntax parse. **Not run here:** the Spring Boot application itself (Maven Central is blocked in my sandbox), the pages in a real browser,
and the STM32/RFID/ESP8266 on real hardware. If anything fails on first run, send me the exact console message.
