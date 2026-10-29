package com.ambulance.preemption.controller;

import com.ambulance.preemption.service.PreemptionService;
import com.ambulance.preemption.util.ApiException;
import com.ambulance.preemption.util.Db;
import com.ambulance.preemption.util.U;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Endpoints called by the STM32 reader / signal controller.
 * The STM32 uses the plain-text "lite" endpoints because they are trivial to parse in C.
 */
@RestController
@RequestMapping("/api/reader")
public class ReaderController {
    private final Db db;
    private final PreemptionService preempt;

    public ReaderController(Db db, PreemptionService preempt) { this.db = db; this.preempt = preempt; }

    private Map<String, Object> reader(String code, String key) {
        Map<String, Object> r = (code == null || key == null) ? null
            : db.one("SELECT * FROM rfid_readers WHERE reader_code=? AND api_key=? AND is_enabled=1", code, key);
        if (r == null) throw new ApiException(401, "Bad reader credentials");
        return r;
    }

    /** JSON version: POST {reader_code, api_key, tag_uid} */
    @PostMapping("/scan")
    public Map<String, Object> scan(@RequestBody Map<String, Object> b) {
        Map<String, Object> r = reader(U.s(b, "reader_code"), U.s(b, "api_key"));
        String tag = U.s(b, "tag_uid");
        if (tag == null) throw new ApiException(400, "tag_uid is required");
        return preempt.processScan(r, tag.toUpperCase());
    }

    /** STM32 version. Reply: ACTION,SECONDS,DIRECTION,SIGNAL  e.g.  GREEN,25,N,SIG-01  or  NONE,0,N,SIG-01  (ERR on bad key) */
    @GetMapping(value = "/scan-lite", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> scanLite(@RequestParam("reader_code") String code, @RequestParam("api_key") String key,
                                           @RequestParam("tag_uid") String tag) {
        Map<String, Object> r;
        try { r = reader(code, key); } catch (ApiException e) { return ResponseEntity.status(401).body("ERR"); }
        Map<String, Object> res = preempt.processScan(r, tag.trim().toUpperCase());
        return ResponseEntity.ok(res.get("action") + "," + res.get("green_seconds") + "," + res.get("approach_direction") + "," + res.get("signal_id"));
    }

    /** Heartbeat from the STM32 so the admin can see the reader is online. */
    @GetMapping(value = "/ping", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> ping(@RequestParam("reader_code") String code, @RequestParam("api_key") String key) {
        Map<String, Object> r;
        try { r = reader(code, key); } catch (ApiException e) { return ResponseEntity.status(401).body("ERR"); }
        db.update("UPDATE rfid_readers SET last_heartbeat=NOW() WHERE id=?", r.get("id"));
        return ResponseEntity.ok("OK");
    }

    /** Remaining preempt seconds (for a controller that prefers polling). */
    @GetMapping("/state")
    public Map<String, Object> state(@RequestParam("reader_code") String code, @RequestParam("api_key") String key) {
        Map<String, Object> r = reader(code, key);
        Map<String, Object> row = db.one("SELECT GREATEST(TIMESTAMPDIFF(SECOND,NOW(),preempt_until),0) s FROM rfid_readers WHERE id=?", r.get("id"));
        int s = row == null || row.get("s") == null ? 0 : U.i(row.get("s"));
        return U.map("state", s > 0 ? "PREEMPT_GREEN" : "NORMAL", "remaining_seconds", s,
                "signal_id", r.get("signal_id"), "approach_direction", r.get("approach_direction"));
    }
}
