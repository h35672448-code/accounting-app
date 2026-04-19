"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentRole } from "./lib/auth";
import { NURSE_SHIFT_EVENT, type ShiftRecord, getDefaultShifts, loadShiftSchedule, saveShiftSchedule } from "./lib/shiftSchedule";
import { fetchShiftScheduleFromStore } from "./lib/shiftStore";
import styles from "./nurse.module.css";

const publicActions = [
  {
    href: "/nurse/news",
    icon: "📰",
    title: "ข่าว",
    text: "",
    iconClass: styles.iconBlue
  },
  {
    href: "#today-shift",
    icon: "👩‍⚕️",
    title: "เวรวันนี้",
    text: "",
    iconClass: styles.iconGreen
  }
];

const primaryActions = [
  {
    href: "/nurse/dashboard#today-shift",
    icon: "👩‍⚕️",
    title: "เวรวันนี้",
    text: "",
    iconClass: styles.iconGreen
  },
  {
    href: "/nurse/symptom",
    icon: "🩺",
    title: "แจ้งอาการ",
    text: "",
    iconClass: styles.iconOrange
  },
  {
    href: "/nurse/queue",
    icon: "📋",
    title: "ดูคิว",
    text: "",
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
    { href: "/nurse/users", icon: "👥", title: "ผู้ใช้" },
    { href: "/nurse/news", icon: "📰", title: "ข่าว" },
    { href: "/nurse/review", icon: "💬", title: "ประเมิน" },
    { href: "/nurse/video", icon: "📹", title: "วิดีโอคอล" }
  ],
  user: [
    { href: "/nurse/news", icon: "📰", title: "ข่าว" },
    { href: "/nurse/review", icon: "💬", title: "ประเมิน" },
    { href: "/nurse/video", icon: "📹", title: "วิดีโอคอล" }
  ],
  guest: [
    { href: "/nurse/login", icon: "🔐", title: "Login" }
  ]
};

export default function NurseHomePage() {
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [role, setRole] = useState<"admin" | "user" | "guest">("guest");

  useEffect(() => {
    const syncShifts = () => setShifts(loadShiftSchedule());
    const syncRole = () => setRole(getCurrentRole());
    const syncStoreShifts = async () => {
      try {
        const storeShifts = await fetchShiftScheduleFromStore();
        if (storeShifts) {
          setShifts(storeShifts);
          saveShiftSchedule(storeShifts);
        }
      } catch {
        // Use the local cached shift schedule if the sheet is temporarily unavailable.
      }
    };

    setShifts(getDefaultShifts());
    void syncStoreShifts();
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

  const isGuest = role === "guest";
  const visiblePrimaryActions = isGuest ? publicActions : primaryActions;
  const secondaryActions = role === "admin" ? utilityActions.admin : role === "user" ? utilityActions.user : utilityActions.guest;

  return (
    <>
      <section className={styles.cardGrid}>
        {visiblePrimaryActions.map((card) => (
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
            <h3 className={styles.sectionTitle}>ข่าวห้องพยาบาล</h3>
            <p className={styles.sectionSub}>{isGuest ? "ติดตามประกาศล่าสุดจากห้องพยาบาล" : "ประกาศล่าสุดจะแสดงด้านบนอัตโนมัติ และจัดการได้ที่หน้า ข่าว"}</p>
          </div>
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
          ) : isGuest ? (
            <Link href="/nurse/login" className={`${styles.button} ${styles.btnSoft}`}>
              🔐 เข้าสู่ระบบพนักงาน
            </Link>
          ) : (
            <p className={styles.infoText}>ผู้ใช้ดูเวรได้ หากต้องการแก้ไขให้ใช้บัญชีผู้ดูแล</p>
          )}
        </article>
      </section>

      {!isGuest ? (
        <section className={styles.secondaryMenuRow} aria-label="เมนูข้อมูลหลัก">
          {focusTools.map((item) => (
            <Link key={item.href} href={item.href} className={styles.secondaryMenuLink}>
              <span className={styles.secondaryMenuIcon}>{item.icon}</span>
              <span>{item.title}</span>
            </Link>
          ))}
        </section>
      ) : null}

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
