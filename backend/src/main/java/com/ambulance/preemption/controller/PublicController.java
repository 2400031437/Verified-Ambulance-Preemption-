package com.ambulance.preemption.controller;

import com.ambulance.preemption.service.PreemptionService;
import com.ambulance.preemption.util.Db;
import com.ambulance.preemption.util.U;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Open endpoints (no login): used by the login page and the "Find ambulance" page for patients. */
@RestController
public class PublicController {
    private final Db db;
    private final int maxAgeMin;
    private final boolean showPhone;

    public PublicController(Db db, @Value("${app.available-max-age-min}") int maxAgeMin,
                            @Value("${app.public-show-driver-phone}") boolean showPhone) {
        this.db = db; this.maxAgeMin = maxAgeMin; this.showPhone = showPhone;
    }

    @GetMapping("/api/public/stats")
    public Map<String, Object> stats() {
        return U.map("onDuty", db.count("SELECT COUNT(*) FROM ambulances WHERE tag_status='ACTIVE'"),
                "hospitals", db.count("SELECT COUNT(*) FROM hospitals"),
                "preemptions", db.count("SELECT COUNT(*) FROM scan_events WHERE result='PREEMPT'"));
    }

    /** Free (on duty, not on an emergency run, GPS fresh) ambulances, nearest first when lat/lng are given. */
    @GetMapping("/api/public/ambulances")
    public Map<String, Object> ambulances(@RequestParam(value = "lat", required = false) Double lat,
                                          @RequestParam(value = "lng", required = false) Double lng) {
        List<Map<String, Object>> rows = db.list(
            "SELECT id,ambulance_number,ambulance_type,driver_phone,last_lat,last_lng FROM ambulances "
            + "WHERE is_enabled=1 AND on_duty=1 AND tag_status='NORMAL' AND last_lat IS NOT NULL "
            + "AND last_seen >= DATE_SUB(NOW(), INTERVAL ? MINUTE)", maxAgeMin);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            double alat = U.d(r.get("last_lat")), alng = U.d(r.get("last_lng"));
            Double km = (lat == null || lng == null) ? null : PreemptionService.distM(lat, lng, alat, alng) / 1000.0;
            out.add(U.map("id", r.get("id"), "ambulance_number", r.get("ambulance_number"), "ambulance_type", r.get("ambulance_type"),
                    "driver_phone", showPhone ? r.get("driver_phone") : null, "lat", alat, "lng", alng,
                    "distance_km", km == null ? null : Math.round(km * 10) / 10.0,
                    // rough road estimate: 1.3 x straight line at ~40 km/h in city traffic
                    "eta_min", km == null ? null : Math.max(1, (int) Math.round(km * 1.3 / 40.0 * 60.0))));
        }
        if (lat != null && lng != null) out.sort(Comparator.comparingDouble(m -> (Double) m.get("distance_km")));
        return U.map("available", out,
                "availableCount", out.size(),
                "busyCount", db.count("SELECT COUNT(*) FROM ambulances WHERE is_enabled=1 AND tag_status='ACTIVE'"));
    }

    /** Hospitals with a location, for the public map. */
    @GetMapping("/api/public/hospitals")
    public List<Map<String, Object>> hospitals() {
        return db.list("SELECT h.id,h.name,h.address,h.phone,h.lat,h.lng,h.specialties,h.icu_beds_available,h.emergency_beds_available "
            + "FROM hospitals h LEFT JOIN users u ON u.id=h.user_id WHERE h.lat IS NOT NULL AND (u.id IS NULL OR u.status='APPROVED')");
    }
}
