package com.ambulance.preemption.util;

import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private ResponseEntity<Map<String, Object>> err(int status, String msg) {
        return ResponseEntity.status(status).body(U.map("error", msg));
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> api(ApiException e) { return err(e.status, e.getMessage()); }

    @ExceptionHandler(DuplicateKeyException.class)
    public ResponseEntity<Map<String, Object>> dup(DuplicateKeyException e) {
        return err(409, "Duplicate value: that phone number / tag / code already exists");
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, Object>> db(DataAccessException e) {
        e.printStackTrace();
        return err(500, "Database error. Check MySQL is running and application.properties is correct.");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> other(Exception e) {
        e.printStackTrace();
        return err(500, "Server error: " + e.getMessage());
    }
}
