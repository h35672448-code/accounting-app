 "use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NURSE_SHIFT_EVENT, type ShiftRecord, loadShiftSchedule } from "./lib/shiftSchedule";
import styles from "./nurse.module.css";

const quickActions = [
  {
    href: "/nurse/news",
    icon: "📰",
    title: "ข่าวห้องพยาบาล",
    text: "ติดตามประกาศวัคซีน กิจกรรมสุขภาพ และข้อมูลสำคัญรายสัปดาห์",
    iconClass: styles.iconBlue
  },
  {
    href: "/nurse/dashboard#today-shift",
    icon: "👩‍⚕️",
    title: "เวรวันนี้",
    text: "ดูตารางเจ้าหน้าที่เวร ช่วงเวลา และช่องทางติดต่อฉุกเฉิน",
    iconClass: styles.iconGreen
  },
  {
    href: "/nurse/symptom",
    icon: "🩺",
    title: "แจ้งอาการ",
    text: "บันทึกอาการล่วงหน้าเพื่อจัดคิวและลดเวลารอหน้าห้องพยาบาล",
    iconClass: styles.iconOrange
  },
  {
    href: "/nurse/queue",
    icon: "📋",
    title: "ดูคิว",
    text: "ตรวจสอบคิวผู้ป่วยและสถานะล่าสุดแบบเรียลไทม์",
    iconClass: styles.iconBlue
  },
  {
    href: "/nurse/review",
    icon: "💬",
    title: "ประเมินบริการ",
    text: "ให้คะแนนการบริการ ความรวดเร็ว และความพึงพอใจ",
    iconClass: styles.iconYellow
  },
  {
    href: "/nurse/video",
    icon: "📹",
    title: "วิดีโอคอล",
    text: "เปิดห้องคอลติดตามอาการเบื้องต้นได้ทันที",
    iconClass: styles.iconBlue
  },
  {
    href: "/nurse/login",
    icon: "🔐",
    title: "Admin Login",
    text: "เข้าสู่ระบบผู้ดูแลเพื่อจัดการข้อมูลนักศึกษา ยา คิว และรายงาน",
    iconClass: styles.iconRed
  }
];

export default function NurseHomePage() {
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);

  useEffect(() => {
    const syncShifts = () => setShifts(loadShiftSchedule());
    syncShifts();
    window.addEventListener(NURSE_SHIFT_EVENT, syncShifts);
    window.addEventListener("storage", syncShifts);
    return () => {
      window.removeEventListener(NURSE_SHIFT_EVENT, syncShifts);
      window.removeEventListener("storage", syncShifts);
    };
  }, []);

  return (
    <>
      <section className={styles.cardGrid}>
        {quickActions.map((card) => (
          <Link key={card.title} href={card.href} className={`${styles.menuCard} ${styles.menuCardCompact}`}>
            <span className={`${styles.cardIcon} ${card.iconClass}`}>{card.icon}</span>
            <h3 className={styles.cardTitle}>{card.title}</h3>
          </Link>
        ))}
      </section>

      <section className={styles.gridTwo}>
        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>ข่าวประจำวันนี้</h3>
          </div>
          <ul className={styles.listPlain}>
            <li>เปิดลงทะเบียนฉีดวัคซีนไข้หวัดใหญ่ วันที่ 18-20 มีนาคม 2026</li>
            <li>แนะนำให้นักศึกษาดื่มน้ำอย่างน้อย 6-8 แก้วต่อวันช่วงอากาศร้อน</li>
            <li>นักศึกษาที่มีโรคประจำตัวควรอัปเดตข้อมูลในระบบทุกต้นภาค</li>
          </ul>
          <Link href="/nurse/news" className={`${styles.button} ${styles.btnPrimary}`}>
            📰 ดูข่าวทั้งหมด
          </Link>
        </article>

        <article className={styles.panel} id="today-shift">
          <div>
            <h3 className={styles.sectionTitle}>เวรวันนี้</h3>
          </div>
          {shifts.map((shift) => (
            <div key={shift.id} className={styles.shiftCard}>
              <p className={styles.infoText}>
                {shift.label} ({shift.time})
              </p>
              <p className={styles.infoValue}>
                {shift.nurse} | {shift.contact}
              </p>
            </div>
          ))}
          <Link href="/nurse/dashboard#today-shift-editor" className={`${styles.button} ${styles.btnSoft}`}>
            ✏️ แก้ไขเวร
          </Link>
        </article>
      </section>
    </>
  );
}
