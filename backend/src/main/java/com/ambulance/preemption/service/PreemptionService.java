package com.ambulance.preemption.service;

import com.ambulance.preemption.util.Db;
import com.ambulance.preemption.util.U;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Core logic: what happens when an RFID reader scans a tag, and trip start/end. */
@Service
public class PreemptionService {
    private final Db db;
    private final Events events;
    private final int maxTripMinutes;

    public PreemptionService(Db db, Events events, @Value("${app.max-trip-minutes}") int maxTripMinutes) {
        this.db = db;
        this.events = events;
        this.maxTripMinutes = maxTripMinutes;
    }

    /** Called for every tag the STM32 reader sees (or the admin simulator). */
    public Map<String, Object> processScan(Map<String, Object> reader, String tagUid) {
        Map<String, Object> amb = db.one("SELECT * FROM ambulances WHERE rfid_tag_uid=?", tagUid);
        String result;
        Map<String, Object> trip = null;
        if (amb == null) result = "UNKNOWN_TAG";
        else if (U.i(amb.get("is_enabled")) == 0) result = "DISABLED";
        else if (!"ACTIVE".equals(amb.get("tag_status"))) result = "IGNORED_NORMAL";
        else {
            result = "PREEMPT";
            trip = db.one("SELECT * FROM trips WHERE ambulance_id=? AND status='ACTIVE' ORDER BY id DESC LIMIT 1", amb.get("id"));
            db.update("UPDATE rfid_readers SET preempt_until=DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE id=?",
                    reader.get("green_seconds"), reader.get("id"));
        }
        db.update("INSERT INTO scan_events(reader_id,tag_uid,ambulance_id,trip_id,result) VALUES(?,?,?,?,?)",
                reader.get("id"), tagUid, amb == null ? null : amb.get("id"), trip == null ? null : trip.get("id"), result);

        Map<String, Object> evt = U.map("reader_code", reader.get("reader_code"), "location", reader.get("location_name"),
                "signal_id", reader.get("signal_id"), "ambulance_number", amb == null ? null : amb.get("ambulance_number"),
                "tag_uid", tagUid, "result", result, "at", Instant.now().toString());
        events.emit("scan", evt, "admin");
        if (trip != null) events.emit("preempt", evt, "hospital:" + trip.get("hospital_id"), "driver:" + trip.get("driver_user_id"));

        boolean green = "PREEMPT".equals(result);
        return U.map("result", result, "action", green ? "GREEN" : "NONE",
                "green_seconds", green ? reader.get("green_seconds") : 0,
                "signal_id", reader.get("signal_id"), "approach_direction", reader.get("approach_direction"));
    }

    /** SAVE button: create the trip and switch the tag to ACTIVE in one transaction. */
    @Transactional
    public void startTrip(Object ambulanceId, Object driverUserId, Object hospitalId, String patientName, String age,
                          String gender, String problem, String severity, String notes) {
        db.update("INSERT INTO trips(ambulance_id,driver_user_id,hospital_id,patient_name,patient_age,patient_gender,problem,severity,notes) VALUES(?,?,?,?,?,?,?,?,?)",
                ambulanceId, driverUserId, hospitalId, patientName == null ? "Unknown" : patientName, age, gender, problem, severity, notes);
        db.update("UPDATE ambulances SET tag_status='ACTIVE', on_duty=1 WHERE id=?", ambulanceId);
    }

    /** Ends a trip and puts the tag back to NORMAL (arrived / cancelled / expired). */
    public void endTrip(Map<String, Object> trip, String status) {
        db.update("UPDATE trips SET status=?, ended_at=NOW() WHERE id=? AND status='ACTIVE'", status, trip.get("id"));
        db.update("UPDATE ambulances SET tag_status='NORMAL' WHERE id=?", trip.get("ambulance_id"));
        events.emit("trip:ended", U.map("trip_id", trip.get("id"), "status", status, "ambulance_id", trip.get("ambulance_id")),
                "driver:" + trip.get("driver_user_id"), "hospital:" + trip.get("hospital_id"), "admin");
    }

    /** Safety net: a tag can never stay ACTIVE forever. */
    @Scheduled(fixedDelay = 60000)
    public void expireOldTrips() {
        List<Map<String, Object>> old = db.list("SELECT * FROM trips WHERE status='ACTIVE' AND started_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)", maxTripMinutes);
        for (Map<String, Object> t : old) endTrip(t, "EXPIRED");
    }

    public static double distM(double lat1, double lng1, double lat2, double lng2) {
        double r = 6371000;
        double p1 = Math.toRadians(lat1), p2 = Math.toRadians(lat2);
        double dp = Math.toRadians(lat2 - lat1), dl = Math.toRadians(lng2 - lng1);
        double h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
        return 2 * r * Math.asin(Math.sqrt(h));
    }
}
