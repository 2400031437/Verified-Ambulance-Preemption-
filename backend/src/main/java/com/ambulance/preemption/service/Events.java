package com.ambulance.preemption.service;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Real-time push to the browsers using Server-Sent Events.
 * Rooms: "admin", "driver:&lt;userId&gt;", "hospital:&lt;hospitalId&gt;".
 */
@Component
public class Events {
    private final Map<String, List<SseEmitter>> rooms = new ConcurrentHashMap<>();

    public SseEmitter subscribe(String room) {
        SseEmitter em = new SseEmitter(0L); // never times out
        rooms.computeIfAbsent(room, k -> new CopyOnWriteArrayList<>()).add(em);
        Runnable remove = () -> drop(em);
        em.onCompletion(remove);
        em.onTimeout(remove);
        em.onError(e -> remove.run());
        try {
            em.send(SseEmitter.event().name("hello").data("{}", MediaType.APPLICATION_JSON));
        } catch (Exception e) { drop(em); }
        return em;
    }

    public void emit(String event, Object payload, String... roomNames) {
        Set<SseEmitter> targets = new HashSet<>();
        for (String r : roomNames) {
            List<SseEmitter> l = rooms.get(r);
            if (l != null) targets.addAll(l);
        }
        for (SseEmitter em : targets) {
            try {
                em.send(SseEmitter.event().name(event).data(payload, MediaType.APPLICATION_JSON));
            } catch (Exception e) { drop(em); }
        }
    }

    private void drop(SseEmitter em) {
        for (List<SseEmitter> l : rooms.values()) l.remove(em);
    }

    /** keeps connections alive through proxies */
    @Scheduled(fixedRate = 25000)
    public void ping() {
        Set<SseEmitter> all = new HashSet<>();
        for (List<SseEmitter> l : rooms.values()) all.addAll(l);
        for (SseEmitter em : all) {
            try { em.send(SseEmitter.event().comment("ping")); } catch (Exception e) { drop(em); }
        }
    }
}
