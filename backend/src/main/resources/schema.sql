-- Tables are created automatically at start-up (safe to run many times).

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) NOT NULL UNIQUE,
  pin_hash VARCHAR(255) NOT NULL,
  recovery_question VARCHAR(160) NULL,
  recovery_answer_hash VARCHAR(255) NULL,
  role ENUM('admin','driver','hospital') NOT NULL,
  status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hospitals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255),
  phone VARCHAR(20),
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  specialties VARCHAR(255),
  icu_beds_available INT DEFAULT 0,
  emergency_beds_available INT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ambulances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ambulance_number VARCHAR(30) NOT NULL UNIQUE,
  rfid_tag_uid VARCHAR(64) NULL UNIQUE,
  driver_user_id INT NULL UNIQUE,
  driver_name VARCHAR(100),
  driver_phone VARCHAR(20),
  ambulance_type ENUM('BASIC','ADVANCED','ICU','NEONATAL') DEFAULT 'BASIC',
  owner_name VARCHAR(100),
  tag_status ENUM('NORMAL','ACTIVE') NOT NULL DEFAULT 'NORMAL',
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  on_duty TINYINT(1) NOT NULL DEFAULT 0,
  last_lat DECIMAL(10,7) NULL,
  last_lng DECIMAL(10,7) NULL,
  last_seen DATETIME NULL,
  FOREIGN KEY (driver_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS rfid_readers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reader_code VARCHAR(40) NOT NULL UNIQUE,
  api_key VARCHAR(64) NOT NULL,
  location_name VARCHAR(150),
  signal_id VARCHAR(40),
  approach_direction ENUM('N','S','E','W') DEFAULT 'N',
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  distance_to_signal_m INT DEFAULT 300,
  green_seconds INT DEFAULT 25,
  preempt_until DATETIME NULL,
  last_heartbeat DATETIME NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS trips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ambulance_id INT NOT NULL,
  driver_user_id INT NOT NULL,
  hospital_id INT NOT NULL,
  patient_name VARCHAR(100),
  patient_age INT NULL,
  patient_gender VARCHAR(10),
  problem VARCHAR(255) NOT NULL,
  severity ENUM('CRITICAL','SERIOUS','STABLE') DEFAULT 'SERIOUS',
  notes VARCHAR(500),
  status ENUM('ACTIVE','ARRIVED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  hospital_ack ENUM('PENDING','ACKNOWLEDGED','READY') NOT NULL DEFAULT 'PENDING',
  hospital_note VARCHAR(500),
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  FOREIGN KEY (ambulance_id) REFERENCES ambulances(id),
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  INDEX idx_trip_status (status), INDEX idx_trip_hospital (hospital_id)
);

CREATE TABLE IF NOT EXISTS scan_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reader_id INT NOT NULL,
  tag_uid VARCHAR(64),
  ambulance_id INT NULL,
  trip_id INT NULL,
  result ENUM('PREEMPT','IGNORED_NORMAL','UNKNOWN_TAG','DISABLED') NOT NULL,
  scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reader_id) REFERENCES rfid_readers(id) ON DELETE CASCADE,
  INDEX idx_scan_time (scanned_at)
);
