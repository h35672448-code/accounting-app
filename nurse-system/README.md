# Nurse System (Express API)

Backend สำหรับระบบห้องพยาบาลวิทยาลัย รองรับ 2 โหมดฐานข้อมูล:
- `mysql` (MySQL/MariaDB)
- `drive` (Google Drive ผ่าน Google Sheets + Apps Script)

## 1) ติดตั้ง

```bash
cd nurse-system
npm install
cp .env.example .env
```

## 2) เลือกโหมดฐานข้อมูล

### โหมด MySQL (`DATA_PROVIDER=mysql`)

ตั้งค่าใน `.env`:

```env
DATA_PROVIDER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=...
DB_NAME=nurse_system
```

สร้างฐานข้อมูล:

```bash
mysql -u root -p < sql/schema.sql
mysql -u root -p < sql/seed.sql
```

### โหมด Drive (`DATA_PROVIDER=drive`)

ตั้งค่าใน `.env`:

```env
DATA_PROVIDER=drive
DRIVE_SCRIPT_URL=https://script.google.com/macros/s/xxx/exec
DRIVE_TOKEN=your_token
DRIVE_AUTO_SEED=1
```

ขั้นตอนตั้งค่า Apps Script:
1. เปิดไฟล์ [google-driver/Code.gs](/Users/suthat/Documents/New project/nurse-system/google-driver/Code.gs)
2. วางใน Google Apps Script
3. ตั้ง Script Properties:
   - `SPREADSHEET_ID`
   - `TOKEN`
4. Deploy เป็น Web app (`Execute as: Me`, `Who has access: Anyone`)
5. เอา URL `/exec` มาใส่ `DRIVE_SCRIPT_URL`

> เมื่อเปิด `DRIVE_AUTO_SEED=1` ระบบจะเติมข้อมูลตั้งต้นอัตโนมัติถ้าแต่ละชีตยังว่าง

### ตัวอย่าง `.env` สำหรับโหมด Drive

```env
PORT=4000
DATA_PROVIDER=drive
DRIVE_SCRIPT_URL=https://script.google.com/macros/s/REPLACE_WITH_NURSE_WEBAPP_ID/exec
DRIVE_TOKEN=2026
DRIVE_AUTO_SEED=1
JWT_SECRET=replace-with-a-long-random-secret
CORS_ORIGIN=http://localhost:3000
UPLOAD_DIR=public/uploads
```

หมายเหตุสำคัญ:
- `DRIVE_SCRIPT_URL` ต้องลงท้าย `/exec`
- `SPREADSHEET_ID` ใน Script Properties ต้องเป็น ID ล้วน (ห้ามมี `/edit`)
- อย่าพิมพ์ `KEY=value` ที่ prompt แล้วคิดว่าแก้ env แล้ว; ต้องบันทึกลงไฟล์ `.env` จริง

## 3) รันเซิร์ฟเวอร์

```bash
npm run dev
```

API base URL: `http://localhost:4000/api`

Health check:
- `GET /api/health`

## 4) ผู้ใช้เริ่มต้น

- username: `admin`
- password: `admin1234`

แนะนำเปลี่ยนรหัสผ่านทันทีด้วย:
- `POST /api/auth/change-password`

## 5) API หลัก

### Auth
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/change-password`

### Students
- `GET /api/students?q=`
- `GET /api/students/:id`
- `GET /api/students/:id/visits`
- `POST /api/students`
- `PUT /api/students/:id`
- `DELETE /api/students/:id`

### Visits
- `GET /api/visits?q=&severity=&status=&date_from=&date_to=`
- `POST /api/visits`
- `PUT /api/visits/:id`
- `POST /api/visits/:id/dispatch-hospital`
- `POST /api/visits/:id/notify-parent`
- `POST /api/visits/:id/event-note`
- `DELETE /api/visits/:id`

### Medicines
- `GET /api/medicines?q=&low_stock=1`
- `GET /api/medicines/alerts/low-stock`
- `POST /api/medicines` (multipart: `image`)
- `PUT /api/medicines/:id` (multipart: `image`)
- `POST /api/medicines/:id/issue`
- `DELETE /api/medicines/:id`

### News
- `GET /api/news`
- `POST /api/news` (multipart: `image`)
- `PUT /api/news/:id` (multipart: `image`)
- `DELETE /api/news/:id`

### Feedback
- `POST /api/feedback` (public)
- `GET /api/feedback`
- `DELETE /api/feedback/:id`

### Dashboard
- `GET /api/dashboard/stats`

## 6) หมายเหตุ

- รูปภาพเก็บที่ `public/uploads/{medicines|news}`
- อัปโหลดรองรับ JPEG/PNG/WEBP สูงสุด 5MB
- Endpoint ส่วนใหญ่ต้องส่ง `Authorization: Bearer <token>`
