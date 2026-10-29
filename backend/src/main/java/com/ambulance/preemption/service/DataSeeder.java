package com.ambulance.preemption.service;

import com.ambulance.preemption.util.Db;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

/** Creates / syncs the single admin login and (optionally) demo data on every start. */
@Component
public class DataSeeder implements CommandLineRunner {
    private final Db db;
    private final String phone, pin;
    private final boolean demo;
    private final BCryptPasswordEncoder enc = new BCryptPasswordEncoder();

    public DataSeeder(Db db, @Value("${app.admin.phone}") String phone, @Value("${app.admin.pin}") String pin,
                      @Value("${app.seed-demo}") boolean demo) {
        this.db = db; this.phone = phone; this.pin = pin; this.demo = demo;
    }

    private int user(String name, String ph, String pn, String role, String question, String answer) {
        Map<String, Object> u = db.one("SELECT id FROM users WHERE phone=?", ph);
        if (u != null) return ((Number) u.get("id")).intValue();
        return db.insert("INSERT INTO users(name,phone,pin_hash,recovery_question,recovery_answer_hash,role,status) VALUES(?,?,?,?,?,?,'APPROVED')",
                name, ph, enc.encode(pn), question, answer == null ? null : enc.encode(answer), role);
    }

    @Override
    public void run(String... args) {
        // exactly ONE admin: its phone + PIN always come from application.properties
        Map<String, Object> admin = db.one("SELECT id FROM users WHERE role='admin' LIMIT 1");
        if (admin == null) {
            db.update("INSERT INTO users(name,phone,pin_hash,role,status) VALUES('Dealer Admin',?,?,'admin','APPROVED')", phone, enc.encode(pin));
        } else {
            db.update("UPDATE users SET phone=?, pin_hash=? WHERE id=?", phone, enc.encode(pin), admin.get("id"));
        }
        System.out.println("ADMIN LOGIN  ->  phone: " + phone + "   PIN: " + pin);

        if (demo) {
            db.update("INSERT IGNORE INTO rfid_readers(reader_code,api_key,location_name,signal_id,approach_direction,lat,lng,distance_to_signal_m,green_seconds) VALUES('READER-001','demo-reader-key','Demo junction approach','SIG-01','N',16.5062,80.6480,300,25)");
            db.update("INSERT IGNORE INTO ambulances(ambulance_number,rfid_tag_uid,driver_name,ambulance_type) VALUES('AP00-DEMO-0001','E2000017221101441890','Demo Driver','ADVANCED')");
            if (db.count("SELECT COUNT(*) FROM hospitals WHERE name LIKE 'Demo %'") == 0) {
                int hu = user("Demo Hospital Reception", "9000000002", "2222", "hospital", "Demo question: your hospital?", "demo");
                db.update("INSERT INTO hospitals(user_id,name,address,phone,lat,lng,specialties,icu_beds_available,emergency_beds_available) VALUES(?,?,?,?,?,?,?,?,?)",
                        hu, "Demo City Hospital", "Demo Road, Vijayawada", "9000000002", 16.5193, 80.6305, "Cardiology,Trauma,Neurology", 4, 6);
                db.update("INSERT INTO hospitals(name,address,phone,lat,lng,specialties,icu_beds_available,emergency_beds_available) VALUES(?,?,?,?,?,?,?,?)",
                        "Demo Care Hospital", "Demo Street, Vijayawada", "9000000003", 16.4890, 80.6620, "Emergency,Orthopaedics", 2, 3);
                db.update("INSERT INTO hospitals(name,address,phone,lat,lng,specialties,icu_beds_available,emergency_beds_available) VALUES(?,?,?,?,?,?,?,?)",
                        "Demo Heart Centre", "Demo Nagar, Vijayawada", "9000000004", 16.5330, 80.6560, "Cardiology", 3, 2);
            }
            Map<String, Object> amb = db.one("SELECT id,driver_user_id FROM ambulances WHERE ambulance_number='AP00-DEMO-0001'");
            if (amb != null && amb.get("driver_user_id") == null) {
                int du = user("Demo Driver", "9000000001", "1111", "driver", "Demo question: your ambulance?", "demo");
                db.update("UPDATE ambulances SET driver_user_id=?, driver_name='Demo Driver', driver_phone='9000000001' WHERE id=?", du, amb.get("id"));
            }
            System.out.println("DEMO LOGINS  ->  driver 9000000001 / 1111   |   hospital 9000000002 / 2222");
        }
    }
}
