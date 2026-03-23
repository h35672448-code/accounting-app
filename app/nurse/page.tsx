"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentRole } from "./lib/auth";
import { NURSE_SHIFT_EVENT, type ShiftRecord, loadShiftSchedule } from "./lib/shiftSchedule";
import styles from "./nurse.module.css";

const primaryActions = [
  {
    href: "/nurse/dashboard#today-shift",
    icon: "👩‍⚕️",
    title: "เวรวันนี้",
    text: "ดูรายชื่อเจ้าหน้าที่เวรและช่องทางติดต่อในวันนี้",
    iconClass: styles.iconGreen
  },
  {
    href: "/nurse/symptom",
    icon: "🩺",
    title: "แจ้งอาการ",
    text: "กรอกอาการล่วงหน้าเพื่อลดเวลารอคิวหน้าห้องพยาบาล",
    iconClass: styles.iconOrange
  },
  {
    href: "/nurse/queue",
    icon: "📋",
    title: "ดูคิว",
    text: "ติดตามสถานะคิวผู้ป่วยและการเรียกคิวล่าสุด",
    iconClass: styles.iconBlue
  }
];

const focusTools = [
  { href: "/nurse/students", icon: "🎓", title: "นักศึกษา" },
  { href: "/nurse/treatment", icon: "🧾", title: "ประวัติการรักษา" },
  { href: "/nurse/visits", icon: "📑", title: "ประวัติการจ่ายยา" },
  { href: "/nurse/medicines", icon: "💊", title: "คลังยา" }
];

const utilityActions = {
  admin: [
    { href: "/nurse/dashboard", icon: "📊", title: "Dashboard" },
    { href: "/nurse/news", icon: "📰", title: "ข่าว" },
    { href: "/nurse/review", icon: "💬", title: "ประเมิน" },
    { href: "/nurse/video", icon: "📹", title: "วิดีโอคอล" }
  ],
  guest: [
    { href: "/nurse/news", icon: "📰", title: "ข่าว" },
    { href: "/nurse/review", icon: "💬", title: "ประเมิน" },
    { href: "/nurse/video", icon: "📹", title: "วิดีโอคอล" },
    { href: "/nurse/login", icon: "🔐", title: "Login" }
  ]
};

export default function NurseHomePage() {
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [role, setRole] = useState<"admin" | "user" | "guest">("guest");

  useEffect(() => {
    const syncShifts = () => setShifts(loadShiftSchedule());
    const syncRole = () => setRole(getCurrentRole());
    syncShifts();
    syncRole();
    window.addEventListener(NURSE_SHIFT_EVENT, syncShifts);
    window.addEventListener("storage", syncShifts);
    window.addEventListener("storage", syncRole);
    window.addEventListener("focus", syncRole);
    return () => {
      window.removeEventListener(NURSE_SHIFT_EVENT, syncShifts);
      window.removeEventListener("storage", syncShifts);
      window.removeEventListener("storage", syncRole);
      window.removeEventListener("focus", syncRole);
    };
  }, []);

  const secondaryActions = role === "admin" ? utilityActions.admin : utilityActions.guest;

  return (
    <>
      <section className={styles.cardGrid}>
        {primaryActions.map((card) => (
          <Link key={card.title} href={card.href} className={`${styles.menuCard} ${styles.menuCardCompact}`}>
            <span className={`${styles.cardIcon} ${card.iconClass}`}>{card.icon}</span>
            <h3 className={styles.cardTitle}>{card.title}</h3>
            <p className={styles.cardText}>{card.text}</p>
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
          {role === "admin" ? (
            <Link href="/nurse/dashboard#today-shift-editor" className={`${styles.button} ${styles.btnSoft}`}>
              ✏️ แก้ไขเวร
            </Link>
          ) : (
            <Link href="/nurse/login" className={`${styles.button} ${styles.btnSoft}`}>
              🔐 เข้าสู่ระบบเพื่อแก้เวร
            </Link>
          )}
        </article>
      </section>

      <section className={styles.secondaryMenuRow} aria-label="เมนูข้อมูลหลัก">
        {focusTools.map((item) => (
          <Link key={item.href} href={item.href} className={styles.secondaryMenuLink}>
            <span className={styles.secondaryMenuIcon}>{item.icon}</span>
            <span>{item.title}</span>
          </Link>
        ))}
      </section>

      <section className={styles.toolShelf} aria-label="เมนูเพิ่มเติม">
        <div className={styles.toolShelfHead}>
          <h3 className={styles.sectionTitle}>เมนูเพิ่มเติม</h3>
        </div>
        <div className={styles.toolShelfGrid}>
          {secondaryActions.map((item) => (
            <Link key={item.href} href={item.href} className={styles.toolPill}>
              <span className={styles.toolPillIcon}>{item.icon}</span>
              <span>{item.title}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
