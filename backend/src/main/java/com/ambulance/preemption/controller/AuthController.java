package com.ambulance.preemption.controller;

import com.ambulance.preemption.security.JwtUtil;
import com.ambulance.preemption.security.LoginGuard;
import com.ambulance.preemption.util.ApiException;
import com.ambulance.preemption.util.Db;
import com.ambulance.preemption.util.U;
import java.util.Map;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** One login for everybody: phone number + PIN. The role stored in the database decides which dashboard opens. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final Db db;
    private final JwtUtil jwt;
    private final LoginGuard guard;
    private final BCryptPasswordEncoder enc = new BCryptPasswordEncoder();

    public AuthController(Db db, JwtUtil jwt, LoginGuard guard) { this.db = db; this.jwt = jwt; this.guard = guard; }

    private static String checkPin(String pin) {
        if (pin == null || !pin.matches("[0-9]{4,6}")) throw new ApiException(400, "PIN must be 4 to 6 digits");
        return pin;
    }

    private static String norm(String a) { return a == null ? "" : a.trim().toLowerCase().replaceAll("\\s+", " "); }

    /** Drivers and hospitals register themselves; the admin approves them. */
    @PostMapping("/register")
    public Map<String, Object> register(@RequestBody Map<String, Object> b) {
        String role = U.s(b, "role"), name = U.s(b, "name"), phone = U.phone(U.s(b, "phone")), pin = U.s(b, "pin");
        String question = U.s(b, "recovery_question"), answer = U.s(b, "recovery_answer");
        if (!"driver".equals(role) && !"hospital".equals(role)) throw new ApiException(400, "Choose driver or hospital");
        if (name == null) throw new ApiException(400, "Name is required");
        if (phone == null) throw new ApiException(400, "Enter a valid 10-digit phone number");
        checkPin(pin);
        if (!pin.equals(U.s(b, "confirm_pin"))) throw new ApiException(400, "PIN and confirm PIN do not match");
        if (question == null || answer == null) throw new ApiException(400, "Choose a security question and answer (used if you forget your PIN)");
        if (db.count("SELECT COUNT(*) FROM users WHERE phone=?", phone) > 0) throw new ApiException(409, "This phone number is already registered");

        String ambNo = U.s(b, "ambulance_number"), hospName = U.s(b, "hospital_name");
        Map<String, Object> amb = null;
        if ("driver".equals(role)) {
            if (ambNo == null) throw new ApiException(400, "Ambulance number is required");
            amb = db.one("SELECT id,driver_user_id FROM ambulances WHERE ambulance_number=?", ambNo);
            if (amb != null && amb.get("driver_user_id") != null) throw new ApiException(409, "That ambulance already has a driver account");
        } else if (hospName == null) throw new ApiException(400, "Hospital name is required");

        int uid = db.insert("INSERT INTO users(name,phone,pin_hash,recovery_question,recovery_answer_hash,role) VALUES(?,?,?,?,?,?)",
                name, phone, enc.encode(pin), question, enc.encode(norm(answer)), role);
        if ("driver".equals(role)) {
            if (amb != null) db.update("UPDATE ambulances SET driver_user_id=?,driver_name=?,driver_phone=? WHERE id=?", uid, name, phone, amb.get("id"));
            else {
                String type = U.s(b, "ambulance_type") == null ? "BASIC" : U.s(b, "ambulance_type");
                db.update("INSERT INTO ambulances(ambulance_number,ambulance_type,driver_user_id,driver_name,driver_phone,is_enabled) VALUES(?,?,?,?,?,0)",
                        ambNo, type, uid, name, phone);
            }
        } else {
            db.update("INSERT INTO hospitals(user_id,name,address,phone) VALUES(?,?,?,?)", uid, hospName, U.s(b, "address"), phone);
        }
        return U.map("ok", true, "message", "Registered! The admin must approve your account before you can log in.");
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, Object> b) {
        String phone = U.phone(U.s(b, "phone")), pin = U.s(b, "pin");
        String key = "login:" + (phone == null ? "invalid" : phone);
        guard.check(key);
        Map<String, Object> u = phone == null ? null : db.one("SELECT * FROM users WHERE phone=?", phone);
        if (u == null || pin == null || !enc.matches(pin, (String) u.get("pin_hash"))) {
            guard.fail(key);
            throw new ApiException(401, "Wrong phone number or PIN");
        }
        guard.ok(key);
        String status = (String) u.get("status");
        if ("PENDING".equals(status)) throw new ApiException(403, "Your account is waiting for admin approval");
        if ("REJECTED".equals(status)) throw new ApiException(403, "Your registration was rejected. Contact the admin.");
        int id = U.i(u.get("id"));
        String role = (String) u.get("role"), name = (String) u.get("name");
        return U.map("token", jwt.sign(id, role, name), "user", U.map("id", id, "name", name, "phone", u.get("phone"), "role", role));
    }

    /** Forgot PIN, step 1: show the security question of this phone number. */
    @PostMapping("/forgot/question")
    public Map<String, Object> question(@RequestBody Map<String, Object> b) {
        String phone = U.phone(U.s(b, "phone"));
        Map<String, Object> u = phone == null ? null : db.one("SELECT role,recovery_question FROM users WHERE phone=?", phone);
        if (u == null) throw new ApiException(404, "No account found for this phone number");
        if ("admin".equals(u.get("role")))
            throw new ApiException(403, "The admin PIN can only be changed in application.properties (app.admin.pin), then restart the backend");
        if (u.get("recovery_question") == null) throw new ApiException(400, "No security question saved. Ask the admin to reset your PIN.");
        return U.map("question", u.get("recovery_question"));
    }

    /** Forgot PIN, step 2: answer + new PIN. */
    @PostMapping("/forgot/reset")
    public Map<String, Object> reset(@RequestBody Map<String, Object> b) {
        String phone = U.phone(U.s(b, "phone")), newPin = U.s(b, "new_pin");
        checkPin(newPin);
        String key = "reset:" + (phone == null ? "invalid" : phone);
        guard.check(key);
        Map<String, Object> u = phone == null ? null : db.one("SELECT id,role,recovery_answer_hash FROM users WHERE phone=?", phone);
        if (u == null || "admin".equals(u.get("role")) || u.get("recovery_answer_hash") == null
                || !enc.matches(norm(U.s(b, "answer")), (String) u.get("recovery_answer_hash"))) {
            guard.fail(key);
            throw new ApiException(401, "The answer is not correct");
        }
        guard.ok(key);
        db.update("UPDATE users SET pin_hash=? WHERE id=?", enc.encode(newPin), u.get("id"));
        return U.map("ok", true, "message", "PIN changed. You can login now.");
    }
}
