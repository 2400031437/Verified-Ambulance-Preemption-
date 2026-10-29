package com.ambulance.preemption.controller;

import com.ambulance.preemption.service.Events;
import com.ambulance.preemption.util.ApiException;
import com.ambulance.preemption.util.Db;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Live updates (locations, alerts, signal events) pushed to each role's browser. */
@RestController
public class StreamController {
    private final Events events;
    private final Db db;

    public StreamController(Events events, Db db) { this.events = events; this.db = db; }

    @GetMapping("/api/stream")
    public SseEmitter stream(@RequestAttribute("uid") Integer uid, @RequestAttribute("role") String role) {
        if ("admin".equals(role)) return events.subscribe("admin");
        if ("driver".equals(role)) return events.subscribe("driver:" + uid);
        Map<String, Object> h = db.one("SELECT id FROM hospitals WHERE user_id=?", uid);
        if (h == null) throw new ApiException(404, "Hospital profile not found");
        return events.subscribe("hospital:" + h.get("id"));
    }
}
