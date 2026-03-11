# ระบบทะเบียนคุมบันทึกการปรับปรุงรายการบัญชี

เว็บแอป Next.js + React สำหรับบันทึกรายการบัญชี รองรับ:
- บันทึกข้อมูล 11 ช่อง
- กรองประเภทและช่วงวันที่
- นำเข้า/ส่งออก Excel (.xlsx)
- เก็บข้อมูลด้วย localStorage และซิงก์สำรองกับ Google Drive/Sheets
- วันที่ตั้งค่าอัตโนมัติเป็นวันปัจจุบันทุกครั้งที่เริ่มรายการใหม่

## เริ่มใช้งาน

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000`

## ระบบห้องพยาบาล (พอร์ตเดียว 3000)

หน้านี้อยู่ในโปรเจกต์เดียวกับ Next.js (ไม่ต้องรัน `nurse-system`):
- หน้าใช้งาน: `http://localhost:3000/nurse`
- ตรวจสุขภาพ API: `http://localhost:3000/api/nurse/health`

ไฟล์โค้ดหลักของห้องพยาบาล:
- `app/nurse/*`
- `app/api/nurse/store/route.ts`
- `app/api/nurse/health/route.ts`
- `lib/nurse-drive.ts`

Environment แนะนำใน `.env.local`:

```env
# ถ้ามี Web App คนละตัวสำหรับ nurse ให้ใส่ NURSE_* โดยตรง
NURSE_SCRIPT_URL="https://script.google.com/macros/s/REPLACE_WITH_NURSE_WEBAPP_ID/exec"
NURSE_SCRIPT_TOKEN="2026"
NURSE_AUTO_SEED="1"
```

หมายเหตุ:
- ระบบ nurse ใช้ Google Sheets ผ่าน Apps Script action `pullEntity/pushEntity`
- หากไม่ตั้ง `NURSE_SCRIPT_URL` ระบบจะใช้ `GOOGLE_SCRIPT_URL` แทน

## โหมดฐานข้อมูลระยะยาว (Google Drive/Sheets)

1. คัดลอกโค้ดจาก `google-driver/Code.gs` ไปวางใน Google Apps Script
2. ตั้งค่าใน `Code.gs` หรือ Script Properties:
   - `SPREADSHEET_ID`
   - `TOKEN`
   - `SHEET_NAME` (ค่าเริ่มต้น `records`)
3. Deploy เป็น Web app (`Execute as: Me`, `Who has access: Anyone`) และคัดลอก URL `/exec`
4. ตั้งค่า Environment Variables จาก `.env.example`
5. หน้าเว็บจะทำงานดังนี้:
   - บันทึก/นำเข้า Excel -> ซิงก์ขึ้น Google อัตโนมัติ
   - หลังล็อกอิน -> ดึงข้อมูลล่าสุดจาก Google อัตโนมัติ

### Environment Variables (แนะนำใช้ `.env.local`)

สร้างไฟล์ `.env.local`:

```env
GOOGLE_SCRIPT_URL="https://script.google.com/macros/s/REPLACE_WITH_ACCOUNTING_WEBAPP_ID/exec"
GOOGLE_SCRIPT_TOKEN="2026"
GOOGLE_NOTIFY_EMAIL=""
```

หมายเหตุสำคัญ:
- `GOOGLE_SCRIPT_URL` ต้องเป็น URL ที่ลงท้าย `/exec` (ไม่ใช่ `/edit`)
- `SPREADSHEET_ID` ใน Apps Script ต้องเป็น ID ล้วน (ไม่ใส่ `/edit`)
- อย่าพิมพ์ `KEY=value` ที่ prompt แล้วคิดว่าเป็นการแก้ไฟล์ env; ต้องบันทึกลง `.env.local` จริง

## โครงไฟล์หลัก

- `app/page.tsx`
- `app/globals.css`
- `app/layout.tsx`
- `public/logo-accounting.svg`
- `app/api/google-driver/route.ts`
- `google-driver/Code.gs`
