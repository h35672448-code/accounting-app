# ระบบทะเบียนคุมบันทึกการปรับปรุงรายการบัญชี

เว็บแอป Next.js + React สำหรับบันทึกรายการบัญชี รองรับ:
- บันทึกข้อมูล 11 ช่อง
- กรองประเภทและช่วงวันที่
- นำเข้า/ส่งออก Excel (.xlsx)
- เก็บข้อมูลด้วย localStorage
- ซิงก์ข้อมูลขึ้น/ลง Google Sheets (ผ่าน Google Apps Script Driver)
- วันที่ตั้งค่าอัตโนมัติเป็นวันปัจจุบันทุกครั้งที่เริ่มรายการใหม่

## เริ่มใช้งาน

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000`

## เชื่อม Google Sheets/Drive (แบบเบา)

1. คัดลอกโค้ดจาก `google-driver/Code.gs` ไปที่ Google Apps Script
2. ตั้งค่าในสคริปต์:
   - `SPREADSHEET_ID` (ถ้าเป็นสคริปต์แยก)
   - `TOKEN` (ถ้าต้องการล็อก)
   - `NOTIFY_EMAIL` (ถ้าต้องการให้ส่งเมลหลังซิงก์)
3. Deploy เป็น Web App แล้วคัดลอก URL ที่ลงท้าย `/exec`
4. สร้างไฟล์ `.env.local` จาก `.env.example` แล้วใส่ค่า:

```bash
cp .env.example .env.local
```

```env
GOOGLE_SCRIPT_URL="https://script.google.com/macros/s/XXXXXXXXXXXX/exec"
GOOGLE_SCRIPT_TOKEN=""
GOOGLE_NOTIFY_EMAIL=""
```

5. รัน `npm run dev` ใหม่
6. การซิงก์:
   - ระบบจะอัปขึ้น Google อัตโนมัติเมื่อ `เพิ่ม/แก้ไข/ลบ/นำเข้า`
   - ปุ่ม `☁️ ดึงจาก Google` ใช้ดึงข้อมูลล่าสุดกลับมา

## โครงไฟล์หลัก

- `app/page.tsx`
- `app/globals.css`
- `app/layout.tsx`
- `public/logo-accounting.svg`
- `app/api/google-driver/route.ts`
- `google-driver/Code.gs`
