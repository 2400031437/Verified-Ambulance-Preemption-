package com.ambulance.preemption.security;

import com.ambulance.preemption.util.ApiException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/** A PIN has few combinations, so lock a phone number for 5 minutes after 5 wrong tries. */
@Component
public class LoginGuard {
    private static final int MAX_FAILS = 5;
    private static final long LOCK_MS = 5 * 60 * 1000L;
    private final Map<String, long[]> state = new ConcurrentHashMap<>(); // key -> {fails, lockedUntil}

    public void check(String key) {
        long[] s = state.get(key);
        if (s != null && s[1] > System.currentTimeMillis())
            throw new ApiException(429, "Too many wrong attempts. Try again in " + ((s[1] - System.currentTimeMillis()) / 60000 + 1) + " minute(s).");
    }

    public void fail(String key) {
        long[] s = state.computeIfAbsent(key, k -> new long[2]);
        synchronized (s) {
            if (s[1] != 0 && s[1] <= System.currentTimeMillis()) { s[0] = 0; s[1] = 0; }
            s[0]++;
            if (s[0] >= MAX_FAILS) { s[1] = System.currentTimeMillis() + LOCK_MS; s[0] = 0; }
        }
    }

    public void ok(String key) { state.remove(key); }
}
