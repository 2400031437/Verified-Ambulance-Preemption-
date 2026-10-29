package com.ambulance.preemption.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/** Checks the JWT and that the role matches the URL area: /api/admin, /api/driver, /api/hospital. */
@Component
public class AuthInterceptor implements HandlerInterceptor {
    private final JwtUtil jwt;

    public AuthInterceptor(JwtUtil jwt) { this.jwt = jwt; }

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) throws Exception {
        if ("OPTIONS".equals(req.getMethod())) return true; // CORS pre-flight
        String path = req.getRequestURI();
        String token = null;
        String h = req.getHeader("Authorization");
        if (h != null && h.startsWith("Bearer ")) token = h.substring(7);
        else if (path.equals("/api/stream")) token = req.getParameter("token"); // EventSource cannot send headers
        try {
            Claims c = jwt.parse(token);
            String role = c.get("role", String.class);
            String need = path.startsWith("/api/admin") ? "admin" : path.startsWith("/api/driver") ? "driver"
                    : path.startsWith("/api/hospital") ? "hospital" : null;
            if (need != null && !need.equals(role)) { fail(res, 403, "Forbidden"); return false; }
            req.setAttribute("uid", Integer.parseInt(c.getSubject()));
            req.setAttribute("role", role);
            return true;
        } catch (Exception e) {
            fail(res, 401, "Please login again");
            return false;
        }
    }

    private void fail(HttpServletResponse res, int status, String msg) throws Exception {
        res.setStatus(status);
        res.setContentType("application/json");
        res.getWriter().write("{\"error\":\"" + msg + "\"}");
    }
}
