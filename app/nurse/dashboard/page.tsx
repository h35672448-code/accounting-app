 "use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import styles from "../nurse.module.css";
import { type ShiftRecord, getDefaultShifts, loadShiftSchedule, saveShiftSchedule } from "../lib/shiftSchedule";

const adminSidebar = [
  { href: "#overview", label: "Dashboard" },
  { href: "/nurse/students", label: "นักศึกษา" },
  { href: "/nurse/queue", label: "คิวผู้ป่วย" },
  { href: "/nurse/treatment", label: "บันทึกการรักษา" },
  { href: "/nurse/medicines", label: "คลังยา" },
  { href: "/nurse/news", label: "ข่าว" },
  { href: "#reports", label: "รายงาน" }
];

const statCards = [
  { label: "จำนวนผู้ป่วยวันนี้", value: "42", hint: "รวมคิวเดินเข้า + จองล่วงหน้า" },
  { label: "คิวรอ", value: "9", hint: "รอตรวจภายใน 20 นาที" },
  { label: "ยาใกล้หมด", value: "5", hint: "ต่ำกว่าระดับ Reorder" },
  { label: "อาการหนัก", value: "2", hint: "มีการส่งต่อโรงพยาบาล" }
];

export default function DashboardPage() {
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setShifts(loadShiftSchedule());
  }, []);

  const shiftRows = useMemo(() => (shifts.length > 0 ? shifts : getDefaultShifts()), [shifts]);

  function handleShiftInput(id: ShiftRecord["id"], field: keyof Omit<ShiftRecord, "id">) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setShifts((prev) => {
        const base = prev.length > 0 ? prev : getDefaultShifts();
        return base.map((item) => (item.id === id ? { ...item, [field]: event.target.value } : item));
      });
    };
  }

  function handleSaveShifts() {
    saveShiftSchedule(shiftRows);
    setMessage("บันทึกเวรเรียบร้อย");
  }

  return (
    <>
      <section className={styles.adminShell}>
        <aside className={styles.sidebarPanel}>
          <h3 className={styles.sectionTitle}>เมนูผู้ดูแล</h3>
          <nav className={styles.sidebarNav}>
            {adminSidebar.map((item) => (
              <Link key={item.label} href={item.href} className={styles.sidebarLink}>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className={styles.mainPanel}>
          <section id="overview" className={styles.statGrid}>
            {statCards.map((card) => (
              <article key={card.label} className={styles.statCard}>
                <p className={styles.statLabel}>{card.label}</p>
                <p className={styles.statValue}>{card.value}</p>
                <span className={`${styles.badge} ${styles.badgeNormal}`}>{card.hint}</span>
              </article>
            ))}
          </section>

          <section className={styles.panel}>
            <div>
              <h3 className={styles.sectionTitle}>ปุ่มลัดหลัก</h3>
            </div>
            <div className={styles.toolbar}>
              <Link href="/nurse/queue" className={`${styles.button} ${styles.btnPrimary}`}>
                📋 ดูคิว
              </Link>
              <Link href="/nurse/medicines" className={`${styles.button} ${styles.btnSuccess}`}>
                💊 เพิ่มยา
              </Link>
              <Link href="/nurse/news" className={`${styles.button} ${styles.btnWarning}`}>
                📰 เพิ่มข่าว
              </Link>
              <Link href="/nurse/treatment" className={`${styles.button} ${styles.btnSoft}`}>
                🩺 บันทึกการรักษา
              </Link>
              <Link href="/nurse/video" className={`${styles.button} ${styles.btnSoft}`}>
                📹 วิดีโอคอล
              </Link>
            </div>
          </section>

          <section className={styles.gridTwo}>
            <article className={styles.panel}>
              <div>
                <h3 className={styles.sectionTitle}>คิวล่าสุด</h3>
              </div>
              <ul className={styles.listPlain}>
                <li>คิว #12 | ปวดท้องเฉียบพลัน | รอตรวจ</li>
                <li>คิว #13 | วิงเวียน | กำลังตรวจ</li>
                <li>คิว #14 | แน่นหน้าอก | ส่งโรงพยาบาล</li>
              </ul>
            </article>

            <article className={styles.panel}>
              <div>
                <h3 className={styles.sectionTitle}>แจ้งเตือนคลังยา</h3>
              </div>
              <ul className={styles.listPlain}>
                <li>Paracetamol 500mg เหลือ 12 เม็ด</li>
                <li>ORS เหลือ 6 ซอง</li>
                <li>Antihistamine เหลือ 4 แผง</li>
              </ul>
            </article>
          </section>

          <section id="reports" className={styles.panel}>
            <div>
              <h3 className={styles.sectionTitle}>รายงานสถิติ</h3>
            </div>
            <div className={styles.toolbar}>
              <button className={`${styles.button} ${styles.btnPrimary}`}>📈 รายงานรายวัน</button>
              <button className={`${styles.button} ${styles.btnPrimary}`}>📊 รายงานรายเดือน</button>
              <button className={`${styles.button} ${styles.btnSoft}`}>👨‍🎓 รายงานนักศึกษา</button>
              <button className={`${styles.button} ${styles.btnSoft}`}>💊 รายงานการใช้ยา</button>
              <button className={`${styles.button} ${styles.btnWarning}`}>📥 Export PDF</button>
              <button className={`${styles.button} ${styles.btnWarning}`}>📥 Export Excel</button>
            </div>
          </section>

          <section id="today-shift-editor" className={styles.panel}>
            <div>
              <h3 className={styles.sectionTitle}>แก้ไขเวรวันนี้</h3>
            </div>

            {message ? <div className={styles.statusBanner}>{message}</div> : null}

            <div className={styles.shiftEditorGrid}>
              {shiftRows.map((shift) => (
                <article key={shift.id} className={styles.shiftEditorCard}>
                  <h4 className={styles.cardTitle}>{shift.label}</h4>
                  <div className={styles.formGrid}>
                    <div>
                      <label className={styles.label}>ช่วงเวลา</label>
                      <input className={styles.input} value={shift.time} onChange={handleShiftInput(shift.id, "time")} />
                    </div>
                    <div>
                      <label className={styles.label}>ผู้รับเวร</label>
                      <input className={styles.input} value={shift.nurse} onChange={handleShiftInput(shift.id, "nurse")} />
                    </div>
                    <div>
                      <label className={styles.label}>ช่องทางติดต่อ</label>
                      <input className={styles.input} value={shift.contact} onChange={handleShiftInput(shift.id, "contact")} />
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className={styles.toolbar}>
              <button className={`${styles.button} ${styles.btnPrimary}`} type="button" onClick={handleSaveShifts}>
                💾 บันทึกเวร
              </button>
              <button
                className={`${styles.button} ${styles.btnSoft}`}
                type="button"
                onClick={() => {
                  setShifts(getDefaultShifts());
                  setMessage("รีเซ็ตเวรเป็นค่าเริ่มต้นแล้ว");
                }}
              >
                รีเซ็ตเวร
              </button>
            </div>
          </section>
        </div>
      </section>
    </>
  );
}
