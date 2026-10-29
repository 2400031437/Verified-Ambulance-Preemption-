package com.ambulance.preemption.controller;

import com.ambulance.preemption.service.PreemptionService;
import com.ambulance.preemption.util.ApiException;
import com.ambulance.preemption.util.Db;
import com.ambulance.preemption.util.U;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

/** Admin / dealer console API: ambulances, hospitals, RFID readers, approvals, scan log. */
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final Db db;
    private final PreemptionService preempt;

    public AdminController(Db db, PreemptionService preempt) { this.db = db; this.preempt = preempt; }

    /** which table, which columns the admin may write, how to list, and how to link a registered user by phone */
    record Ent(String table, String required, List<String> cols, String list, String linkField, String linkRole, String linkCol) {}

    private static final Map<String, Ent> ENT = Map.of(
        "ambulances", new Ent("ambulances", "ambulance_number",
            List.of("ambulance_number", "rfid_tag_uid", "ambulance_type", "driver_name", "driver_phone", "owner_name", "is_enabled"),
            "SELECT a.*,u.phone driver_login_phone FROM ambulances a LEFT JOIN users u ON u.id=a.driver_user_id ORDER BY a.id DESC",
            "driver_login_phone", "driver", "driver_user_id"),
        "hospitals", new Ent("hospitals", "name",
            List.of("name", "address", "phone", "lat", "lng", "specialties", "icu_beds_available", "emergency_beds_available"),
            "SELECT h.*,u.phone user_login_phone FROM hospitals h LEFT JOIN users u ON u.id=h.user_id ORDER BY h.id DESC",
            "user_login_phone", "hospital", "user_id"),
        "readers", new Ent("rfid_readers", "reader_code",
            List.of("reader_code", "location_name", "signal_id", "approach_direction", "lat", "lng", "distance_to_signal_m", "green_seconds", "is_enabled"),
            "SELECT * FROM rfid_readers ORDER BY id DESC", null, null, null));

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        return U.map(
            "ambulances", db.count("SELECT COUNT(*) FROM ambulances"),
            "hospitals", db.count("SELECT COUNT(*) FROM hospitals"),
            "readers", db.count("SELECT COUNT(*) FROM rfid_readers"),
            "activeTrips", db.count("SELECT COUNT(*) FROM trips WHERE status='ACTIVE'"),
            "pendingUsers", db.count("SELECT COUNT(*) FROM users WHERE status='PENDING'"),
            "preemptionsToday", db.count("SELECT COUNT(*) FROM scan_events WHERE result='PREEMPT' AND DATE(scanned_at)=CURDATE()"));
    }


    /** Numbers for the dashboard charts. */
    @GetMapping("/analytics")
    public Map<String, Object> analytics() {
        Map<String, Object> avg = db.one("SELECT ROUND(AVG(TIMESTAMPDIFF(MINUTE,started_at,ended_at)),1) m FROM trips WHERE status='ARRIVED'");
        return U.map(
            "scansPerDay", db.list("SELECT DATE(scanned_at) day, SUM(result='PREEMPT') preempt, COUNT(*) total FROM scan_events WHERE scanned_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(scanned_at) ORDER BY day"),
            "tripsPerDay", db.list("SELECT DATE(started_at) day, COUNT(*) trips FROM trips WHERE started_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(started_at) ORDER BY day"),
            "scanResults", db.list("SELECT result name, COUNT(*) n FROM scan_events GROUP BY result"),
            "tripStatus", db.list("SELECT status name, COUNT(*) n FROM trips GROUP BY status"),
            "severity", db.list("SELECT severity name, COUNT(*) n FROM trips GROUP BY severity"),
            "topProblems", db.list("SELECT problem name, COUNT(*) n FROM trips GROUP BY problem ORDER BY n DESC LIMIT 5"),
            "avgTripMinutes", avg == null ? null : avg.get("m"),
            "readersOnline", db.count("SELECT COUNT(*) FROM rfid_readers WHERE last_heartbeat >= DATE_SUB(NOW(), INTERVAL 90 SECOND)"),
            "recentTrips", db.list("SELECT t.id,t.problem,t.severity,t.status,t.started_at,a.ambulance_number,h.name hospital_name FROM trips t JOIN ambulances a ON a.id=t.ambulance_id JOIN hospitals h ON h.id=t.hospital_id ORDER BY t.id DESC LIMIT 6"));
    }

    @GetMapping("/live")
    public Map<String, Object> live() {
        return U.map(
            "ambulances", db.list("SELECT id,ambulance_number,tag_status,last_lat lat,last_lng lng FROM ambulances WHERE last_lat IS NOT NULL"),
            "hospitals", db.list("SELECT id,name,lat,lng FROM hospitals WHERE lat IS NOT NULL"),
            "readers", db.list("SELECT id,reader_code,location_name,lat,lng FROM rfid_readers WHERE lat IS NOT NULL"));
    }

    @GetMapping("/users")
    public List<Map<String, Object>> users() {
        return db.list("SELECT u.id,u.name,u.phone,u.role,u.status,a.ambulance_number,h.name hospital_name "
            + "FROM users u LEFT JOIN ambulances a ON a.driver_user_id=u.id LEFT JOIN hospitals h ON h.user_id=u.id "
            + "WHERE u.role<>'admin' ORDER BY FIELD(u.status,'PENDING','APPROVED','REJECTED'), u.id DESC");
    }

    @PatchMapping("/users/{id}")
    public Map<String, Object> setStatus(@PathVariable int id, @RequestBody Map<String, Object> b) {
        String status = U.s(b, "status");
        if (!List.of("APPROVED", "REJECTED", "PENDING").contains(status)) throw new ApiException(400, "Bad status");
        db.update("UPDATE users SET status=? WHERE id=? AND role<>'admin'", status, id);
        if ("APPROVED".equals(status)) db.update("UPDATE ambulances SET is_enabled=1 WHERE driver_user_id=?", id);
        return U.map("ok", true);
    }

    /** For users who forgot both PIN and security answer. */
    @PostMapping("/users/{id}/reset-pin")
    public Map<String, Object> resetPin(@PathVariable int id, @RequestBody Map<String, Object> b) {
        String pin = U.s(b, "pin");
        if (pin == null || !pin.matches("[0-9]{4,6}")) throw new ApiException(400, "PIN must be 4 to 6 digits");
        db.update("UPDATE users SET pin_hash=? WHERE id=? AND role<>'admin'", new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().encode(pin), id);
        return U.map("ok", true);
    }

    @GetMapping("/scans")
    public List<Map<String, Object>> scans() {
        return db.list("SELECT s.*,r.reader_code,r.location_name,a.ambulance_number FROM scan_events s "
            + "JOIN rfid_readers r ON r.id=s.reader_id LEFT JOIN ambulances a ON a.id=s.ambulance_id ORDER BY s.id DESC LIMIT 50");
    }

    /** Test the whole chain without hardware. */
    @PostMapping("/simulate")
    public Map<String, Object> simulate(@RequestBody Map<String, Object> b) {
        Map<String, Object> reader = db.one("SELECT * FROM rfid_readers WHERE reader_code=?", U.s(b, "reader_code"));
        if (reader == null) throw new ApiException(404, "Reader not found");
        String tag = U.s(b, "tag_uid");
        if (tag == null) throw new ApiException(400, "Tag UID is required");
        return preempt.processScan(reader, tag.toUpperCase());
    }

    // ---------- generic CRUD for ambulances / hospitals / readers ----------
    private Ent ent(String name) {
        Ent e = ENT.get(name);
        if (e == null) throw new ApiException(404, "Unknown");
        return e;
    }

    private Map<String, Object> clean(Ent e, Map<String, Object> b) {
        Map<String, Object> o = new LinkedHashMap<>();
        for (String c : e.cols()) if (b.containsKey(c)) o.put(c, U.s(b, c));
        if (e.linkField() != null && b.containsKey(e.linkField())) {
            String raw = U.s(b, e.linkField());
            if (raw == null) o.put(e.linkCol(), null);
            else {
                String ph = U.phone(raw);
                if (ph == null) throw new ApiException(400, "Enter a valid 10-digit login phone number");
                Map<String, Object> u = db.one("SELECT id FROM users WHERE phone=? AND role=?", ph, e.linkRole());
                if (u == null) throw new ApiException(400, "No registered " + e.linkRole() + " account with that phone number");
                o.put(e.linkCol(), u.get("id"));
            }
        }
        return o;
    }

    @GetMapping("/{e}")
    public List<Map<String, Object>> list(@PathVariable String e) { return db.list(ent(e).list()); }

    @PostMapping("/{e}")
    public Map<String, Object> create(@PathVariable String e, @RequestBody Map<String, Object> b) {
        Ent en = ent(e);
        if (U.s(b, en.required()) == null) throw new ApiException(400, en.required() + " is required");
        Map<String, Object> o = clean(en, b);
        if (e.equals("readers")) o.put("api_key", UUID.randomUUID().toString().replace("-", ""));
        String cols = String.join(",", o.keySet());
        String marks = String.join(",", Collections.nCopies(o.size(), "?"));
        int id = db.insert("INSERT INTO " + en.table() + "(" + cols + ") VALUES(" + marks + ")", o.values().toArray());
        return U.map("id", id);
    }

    @PutMapping("/{e}/{id}")
    public Map<String, Object> update(@PathVariable String e, @PathVariable int id, @RequestBody Map<String, Object> b) {
        Ent en = ent(e);
        Map<String, Object> o = clean(en, b);
        if (!o.isEmpty()) {
            String set = String.join("=?,", o.keySet()) + "=?";
            List<Object> args = new ArrayList<>(o.values());
            args.add(id);
            db.update("UPDATE " + en.table() + " SET " + set + " WHERE id=?", args.toArray());
        }
        return U.map("ok", true);
    }

    @DeleteMapping("/{e}/{id}")
    public Map<String, Object> delete(@PathVariable String e, @PathVariable int id) {
        db.update("DELETE FROM " + ent(e).table() + " WHERE id=?", id);
        return U.map("ok", true);
    }
}
