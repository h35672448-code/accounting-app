CREATE DATABASE IF NOT EXISTS nurse_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nurse_system;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'nurse', 'viewer') NOT NULL DEFAULT 'nurse',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_code VARCHAR(20) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  department VARCHAR(120) NOT NULL,
  class_room VARCHAR(50) NOT NULL,
  allergy_note TEXT,
  chronic_note TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_students_name (first_name, last_name),
  INDEX idx_students_department (department)
);

CREATE TABLE IF NOT EXISTS medicines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  medicine_code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  image_url VARCHAR(500),
  stock_qty INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 10,
  expire_date DATE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_medicine_name (name),
  INDEX idx_medicine_stock (stock_qty)
);

CREATE TABLE IF NOT EXISTS visits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  symptom TEXT NOT NULL,
  severity ENUM('ปกติ', 'ปานกลาง', 'หนัก') NOT NULL DEFAULT 'ปกติ',
  triage_status ENUM('รอคัดกรอง', 'กำลังตรวจ', 'จ่ายยาแล้ว', 'ส่งโรงพยาบาล', 'เสร็จสิ้น') NOT NULL DEFAULT 'รอคัดกรอง',
  nurse_id INT,
  visit_at DATETIME NOT NULL,
  parent_notified TINYINT(1) NOT NULL DEFAULT 0,
  event_note TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_visits_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_visits_nurse FOREIGN KEY (nurse_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_visits_visit_at (visit_at),
  INDEX idx_visits_severity (severity),
  INDEX idx_visits_status (triage_status)
);

CREATE TABLE IF NOT EXISTS visit_medicines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  visit_id INT NOT NULL,
  medicine_id INT NOT NULL,
  qty INT NOT NULL,
  dosage VARCHAR(100),
  instruction TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_visit_medicine_visit FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
  CONSTRAINT fk_visit_medicine_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT,
  INDEX idx_visit_medicines_visit (visit_id)
);

CREATE TABLE IF NOT EXISTS medicine_stock_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  medicine_id INT NOT NULL,
  actor_id INT,
  action_type ENUM('add', 'issue', 'adjust') NOT NULL,
  qty_before INT NOT NULL,
  qty_change INT NOT NULL,
  qty_after INT NOT NULL,
  note VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_logs_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE,
  CONSTRAINT fk_stock_logs_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_stock_logs_medicine (medicine_id),
  INDEX idx_stock_logs_created (created_at)
);

CREATE TABLE IF NOT EXISTS news (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  detail TEXT NOT NULL,
  image_url VARCHAR(500),
  published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  author_id INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_news_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_news_published (published_at)
);

CREATE TABLE IF NOT EXISTS feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  visit_id INT,
  mood ENUM('ดีมาก', 'ดี', 'ปานกลาง', 'แย่') NOT NULL,
  comment TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_feedback_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_visit FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL,
  INDEX idx_feedback_created (created_at)
);

CREATE TABLE IF NOT EXISTS alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alert_type ENUM('severity', 'stock') NOT NULL,
  status ENUM('open', 'ack', 'resolved') NOT NULL DEFAULT 'open',
  message VARCHAR(255) NOT NULL,
  visit_id INT,
  medicine_id INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  CONSTRAINT fk_alert_visit FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE,
  INDEX idx_alert_status (status),
  INDEX idx_alert_created (created_at)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(50) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id INT,
  before_json JSON,
  after_json JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_entity (entity, entity_id),
  INDEX idx_audit_created (created_at)
);
