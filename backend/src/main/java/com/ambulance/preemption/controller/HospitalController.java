package com.ambulance.preemption.controller;

import com.ambulance.preemption.service.Events;
import com.ambulance.preemption.util.ApiException;
import com.ambulance.preemption.util.Db;
import com.ambulance.preemption.util.U;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

/** Hospital reception API. */
@RestController
@RequestMapping("/api/hospital")
public class HospitalController {
    private static final List<String> COLS = List.of("name", "address", "phone", "lat", "lng", "specialties", "icu_beds_available", "emergency_beds_available");
    private static final String SEL = "SELECT t.*,a.ambulance_number,a.ambulance_type,a.driver_name,a.driver_phone,a.last_lat,a.last_lng "
        + "FROM trips t JOIN ambulances a ON a.id=t.ambulance_id WHERE t.hospital_id=?";

    private final Db db;
    private final Events events;

    public HospitalController(Db db, Events events) { this.db = db; this.events = events; }

    private Map<String, Object> hospitalOf(int uid) {
        Map<String, Object> h = db.one("SELECT * FROM hospitals WHERE user_id=?", uid);
        if (h == null) throw new ApiException(404, "Hospital profile not found");
        return h;
    }

    @GetMapping("/me")
    public Map<String, Object> me(@RequestAttribute("uid") Integer uid) { return hospitalOf(uid); }

    @PutMapping("/me")
    public Map<String, Object> updateMe(@RequestAttribute("uid") Integer uid, @RequestBody Map<String, Object> b) {
        Map<String, Object> h = hospitalOf(uid);
        Map<String, Object> o = new LinkedHashMap<>();
        for (String c : COLS) if (b.containsKey(c)) o.put(c, U.s(b, c));
        if (!o.isEmpty()) {
            List<Object> args = new ArrayList<>(o.values());
            args.add(h.get("id"));
            db.update("UPDATE hospitals SET " + String.join("=?,", o.keySet()) + "=? WHERE id=?", args.toArray());
        }
        Map<String, Object> upd = new LinkedHashMap<>();
        upd.put("id", h.get("id"));
        upd.putAll(o);
        events.emit("hospital:update", upd, "admin");
        // drivers heading to this hospital see the new location / beds instantly
        for (Map<String, Object> t : db.list("SELECT driver_user_id FROM trips WHERE hospital_id=? AND status='ACTIVE'", h.get("id")))
            events.emit("hospital:update", upd, "driver:" + t.get("driver_user_id"));
        return U.map("ok", true);
    }


    @GetMapping("/stats")
    public Map<String, Object> stats(@RequestAttribute("uid") Integer uid) {
        Map<String, Object> h = hospitalOf(uid);
        Object id = h.get("id");
        Map<String, Object> avg = db.one("SELECT ROUND(AVG(TIMESTAMPDIFF(MINUTE,started_at,ended_at)),1) m FROM trips WHERE hospital_id=? AND status='ARRIVED'", id);
        return U.map(
            "incoming", db.count("SELECT COUNT(*) FROM trips WHERE hospital_id=? AND status='ACTIVE'", id),
            "today", db.count("SELECT COUNT(*) FROM trips WHERE hospital_id=? AND DATE(started_at)=CURDATE()", id),
            "total", db.count("SELECT COUNT(*) FROM trips WHERE hospital_id=?", id),
            "avgMinutes", avg == null ? null : avg.get("m"),
            "perDay", db.list("SELECT DATE(started_at) day, COUNT(*) trips FROM trips WHERE hospital_id=? AND started_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(started_at) ORDER BY day", id),
            "severity", db.list("SELECT severity name, COUNT(*) n FROM trips WHERE hospital_id=? GROUP BY severity", id),
            "topProblems", db.list("SELECT problem name, COUNT(*) n FROM trips WHERE hospital_id=? GROUP BY problem ORDER BY n DESC LIMIT 5", id));
    }

    @GetMapping("/incoming")
    public Map<String, Object> incoming(@RequestAttribute("uid") Integer uid) {
        Map<String, Object> h = hospitalOf(uid);
        return U.map(
            "active", db.list(SEL + " AND t.status='ACTIVE' ORDER BY FIELD(t.severity,'CRITICAL','SERIOUS','STABLE'), t.started_at", h.get("id")),
            "history", db.list(SEL + " AND t.status<>'ACTIVE' ORDER BY t.id DESC LIMIT 15", h.get("id")));
    }

    @PatchMapping("/trips/{id}")
    public Map<String, Object> ack(@RequestAttribute("uid") Integer uid, @PathVariable int id, @RequestBody Map<String, Object> b) {
        Map<String, Object> h = hospitalOf(uid);
        Map<String, Object> t = db.one("SELECT * FROM trips WHERE id=? AND hospital_id=?", id, h.get("id"));
        if (t == null) throw new ApiException(404, "Trip not found");
        String ack = "READY".equals(U.s(b, "hospital_ack")) ? "READY" : "ACKNOWLEDGED";
        String note = U.s(b, "hospital_note");
        db.update("UPDATE trips SET hospital_ack=?,hospital_note=? WHERE id=?", ack, note, id);
        events.emit("trip:ack", U.map("trip_id", id, "hospital_ack", ack, "hospital_note", note, "hospital", h.get("name")),
                "driver:" + t.get("driver_user_id"), "admin");
        return U.map("ok", true);
    }
}
