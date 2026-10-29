package com.ambulance.preemption.util;

import java.util.LinkedHashMap;
import java.util.Map;

/** Small helpers so controllers stay short. */
public final class U {
    private U() {}

    /** Builds a map from key,value,key,value... (null values allowed, order kept). */
    public static Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    /** Trimmed string value of a JSON field, or null if missing/blank. */
    public static String s(Map<String, Object> body, String key) {
        if (body == null) return null;
        Object v = body.get(key);
        if (v == null) return null;
        String t = v.toString().trim();
        return t.isEmpty() ? null : t;
    }

    /** Normalises an Indian mobile number to 10 digits (accepts +91 / 0 prefixes). Returns null if invalid. */
    public static String phone(String raw) {
        if (raw == null) return null;
        String d = raw.replaceAll("[^0-9]", "");
        if (d.length() == 12 && d.startsWith("91")) d = d.substring(2);
        else if (d.length() == 11 && d.startsWith("0")) d = d.substring(1);
        return d.matches("[0-9]{10}") ? d : null;
    }

    public static int i(Object o) { return o == null ? 0 : ((Number) o).intValue(); }

    public static double d(Object o) { return ((Number) o).doubleValue(); }
}
