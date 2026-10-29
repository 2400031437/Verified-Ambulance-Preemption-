package com.ambulance.preemption.controller;

import com.ambulance.preemption.service.Events;
import com.ambulance.preemption.service.PreemptionService;
import com.ambulance.preemption.util.ApiException;
import com.ambulance.preemption.util.Db;
import com.ambulance.preemption.util.U;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

/** Ambulance driver API. */
@RestController
@RequestMapping("/api/driver")
public class DriverController {
    private final Db db;
    private final PreemptionService preempt;
    private final Events events;
    private final double arrivalRadius;

    public DriverController(Db db, PreemptionService preempt, Events events, @Value("${app.arrival-radius-m}") double arrivalRadius) {
        this.db = db; this.preempt = preempt; this.events = events; this.arrivalRadius = arrivalRadius;
    }

    private Map<String, Object> ambulanceOf(int uid) { return db.one("SELECT * FROM ambulances WHERE driver_user_id=?", uid); }

    private Map<String, Object> activeTrip(Object ambId) {
        return db.one("SELECT t.*,h.name hospital_name,h.address hospital_address,h.phone hospital_phone,h.lat hospital_lat,h.lng hospital_lng "
            + "FROM trips t JOIN hospitals h ON h.id=t.hospital_id WHERE t.ambulance_id=? AND t.status='ACTIVE' ORDER BY t.id DESC LIMIT 1", ambId);
    }

    @GetMapping("/me")
    public Map<String, Object> me(@RequestAttribute("uid") Integer uid) {
        Map<String, Object> amb = ambulanceOf(uid);
        return U.map("ambulance", amb, "trip", amb == null ? null : activeTrip(amb.get("id")));
    }


    /** "Go on duty": a free ambulance shows up on the public Find-ambulance page while on duty. */
    @PostMapping("/duty")
    public Map<String, Object> duty(@RequestAttribute("uid") Integer uid, @RequestBody Map<String, Object> b) {
        Map<String, Object> amb = ambulanceOf(uid);
        if (amb == null) throw new ApiException(404, "No ambulance linked to your account");
        if (U.i(amb.get("is_enabled")) == 0) throw new ApiException(400, "Your ambulance is not verified yet");
        String v = U.s(b, "on_duty");
        boolean on = "true".equalsIgnoreCase(v) || "1".equals(v);
        db.update("UPDATE ambulances SET on_duty=? WHERE id=?", on ? 1 : 0, amb.get("id"));
        return U.map("ok", true, "on_duty", on);
    }

    @GetMapping("/stats")
    public Map<String, Object> stats(@RequestAttribute("uid") Integer uid) {
        Map<String, Object> amb = ambulanceOf(uid);
        if (amb == null) return U.map("total", 0, "today", 0, "avgMinutes", null, "signalsCleared", 0, "perDay", List.of(), "recent", List.of());
        Object id = amb.get("id");
        Map<String, Object> avg = db.one("SELECT ROUND(AVG(TIMESTAMPDIFF(MINUTE,started_at,ended_at)),1) m FROM trips WHERE ambulance_id=? AND status='ARRIVED'", id);
        return U.map(
            "total", db.count("SELECT COUNT(*) FROM trips WHERE ambulance_id=?", id),
            "today", db.count("SELECT COUNT(*) FROM trips WHERE ambulance_id=? AND DATE(started_at)=CURDATE()", id),
            "avgMinutes", avg == null ? null : avg.get("m"),
            "signalsCleared", db.count("SELECT COUNT(*) FROM scan_events WHERE ambulance_id=? AND result='PREEMPT'", id),
            "perDay", db.list("SELECT DATE(started_at) day, COUNT(*) trips FROM trips WHERE ambulance_id=? AND started_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(started_at) ORDER BY day", id),
            "recent", db.list("SELECT t.id,t.problem,t.severity,t.status,t.started_at,h.name hospital_name FROM trips t JOIN hospitals h ON h.id=t.hospital_id WHERE t.ambulance_id=? ORDER BY t.id DESC LIMIT 6", id));
    }

    @GetMapping("/hospitals")
    public List<Map<String, Object>> hospitals() {
        return db.list("SELECT h.id,h.name,h.address,h.phone,h.lat,h.lng,h.specialties,h.icu_beds_available,h.emergency_beds_available "
            + "FROM hospitals h LEFT JOIN users u ON u.id=h.user_id WHERE h.lat IS NOT NULL AND (u.id IS NULL OR u.status='APPROVED')");
    }

    /** SAVE = create trip + ACTIVATE tag + alert the hospital. */
    @PostMapping("/trip")
    public Map<String, Object> startTrip(@RequestAttribute("uid") Integer uid, @RequestBody Map<String, Object> b) {
        Map<String, Object> amb = ambulanceOf(uid);
        if (amb == null) throw new ApiException(404, "No ambulance linked to your account");
        if (U.i(amb.get("is_enabled")) == 0 || amb.get("rfid_tag_uid") == null)
            throw new ApiException(400, "Your ambulance is not verified yet: admin must link an RFID tag and enable it");
        if (activeTrip(amb.get("id")) != null) throw new ApiException(409, "A trip is already active");
        String problem = U.s(b, "problem"), hospitalId = U.s(b, "hospital_id");
        if (problem == null || hospitalId == null) throw new ApiException(400, "Patient problem and hospital are required");
        if (db.one("SELECT id FROM hospitals WHERE id=?", hospitalId) == null) throw new ApiException(404, "Hospital not found");
        String sev = U.s(b, "severity");
        if (!List.of("CRITICAL", "SERIOUS", "STABLE").contains(sev)) sev = "SERIOUS";

        preempt.startTrip(amb.get("id"), uid, hospitalId, U.s(b, "patient_name"), U.s(b, "patient_age"),
                U.s(b, "patient_gender"), problem, sev, U.s(b, "notes"));

        Map<String, Object> trip = activeTrip(amb.get("id"));
        Map<String, Object> payload = new LinkedHashMap<>(trip);
        payload.put("ambulance_number", amb.get("ambulance_number"));
        payload.put("ambulance_type", amb.get("ambulance_type"));
        payload.put("driver_name", amb.get("driver_name"));
        payload.put("driver_phone", amb.get("driver_phone"));
        payload.put("last_lat", amb.get("last_lat"));
        payload.put("last_lng", amb.get("last_lng"));
        events.emit("trip:new", payload, "hospital:" + hospitalId, "admin");
        return U.map("ok", true, "trip", trip);
    }

    @PostMapping("/trip/end")
    public Map<String, Object> endTrip(@RequestAttribute("uid") Integer uid, @RequestBody(required = false) Map<String, Object> b) {
        Map<String, Object> amb = ambulanceOf(uid);
        Map<String, Object> trip = amb == null ? null : activeTrip(amb.get("id"));
        if (trip == null) throw new ApiException(404, "No active trip");
        preempt.endTrip(trip, "CANCELLED".equals(U.s(b, "status")) ? "CANCELLED" : "ARRIVED");
        return U.map("ok", true);
    }

    /** Live GPS from the driver's phone. Also auto-completes the trip when the ambulance reaches the hospital. */
    @PostMapping("/location")
    public Map<String, Object> location(@RequestAttribute("uid") Integer uid, @RequestBody Map<String, Object> b) {
        double lat, lng;
        try {
            lat = Double.parseDouble(U.s(b, "lat"));
            lng = Double.parseDouble(U.s(b, "lng"));
        } catch (Exception ex) { throw new ApiException(400, "Bad coordinates"); }
        Map<String, Object> amb = ambulanceOf(uid);
        if (amb == null) throw new ApiException(404, "No ambulance");
        db.update("UPDATE ambulances SET last_lat=?,last_lng=?,last_seen=NOW() WHERE id=?", lat, lng, amb.get("id"));
        Map<String, Object> trip = activeTrip(amb.get("id"));
        Map<String, Object> evt = U.map("ambulance_id", amb.get("id"), "ambulance_number", amb.get("ambulance_number"),
                "lat", lat, "lng", lng, "active", trip != null, "trip_id", trip == null ? null : trip.get("id"));
        events.emit("location", evt, "admin");
        boolean arrived = false;
        if (trip != null) {
            events.emit("location", evt, "hospital:" + trip.get("hospital_id"));
            double d = PreemptionService.distM(lat, lng, U.d(trip.get("hospital_lat")), U.d(trip.get("hospital_lng")));
            if (d < arrivalRadius) { preempt.endTrip(trip, "ARRIVED"); arrived = true; }
        }
        return U.map("ok", true, "arrived", arrived);
    }
}
