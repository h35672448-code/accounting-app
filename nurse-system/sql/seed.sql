USE nurse_system;

INSERT INTO users (username, password_hash, role)
VALUES
  ('admin', '$2a$10$//sDtVDCKt/GbgZvSBRxzepTPEAQaw7powsUDQa2N.fDvNenSae.m', 'admin')
ON DUPLICATE KEY UPDATE
  role = VALUES(role),
  is_active = 1;

INSERT INTO students (student_code, first_name, last_name, department, class_room, allergy_note)
VALUES
  ('66012001', 'กิตติพงษ์', 'สายชล', 'ช่างยนต์', 'ปวช.2/1', 'แพ้เพนิซิลลิน'),
  ('66013044', 'พิมพ์ชนก', 'คำแก้ว', 'คอมพิวเตอร์ธุรกิจ', 'ปวช.2/2', NULL)
ON DUPLICATE KEY UPDATE
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  department = VALUES(department),
  class_room = VALUES(class_room),
  allergy_note = VALUES(allergy_note);

INSERT INTO medicines (medicine_code, name, stock_qty, reorder_level, expire_date)
VALUES
  ('MED-001', 'Paracetamol 500mg', 50, 10, '2027-03-30'),
  ('MED-011', 'Oral Rehydration Salt', 8, 10, '2026-10-12')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  stock_qty = VALUES(stock_qty),
  reorder_level = VALUES(reorder_level),
  expire_date = VALUES(expire_date);
