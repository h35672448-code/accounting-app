 "use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import styles from "../nurse.module.css";
import { getCurrentSession } from "../lib/auth";
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

type ReportKey = "daily" | "monthly" | "students" | "medicine";

const reportOptions: Array<{ value: ReportKey; label: string }> = [
  { value: "daily", label: "รายงานรายวัน" },
  { value: "monthly", label: "รายงานรายเดือน" },
  { value: "students", label: "รายงานนักศึกษา" },
  { value: "medicine", label: "รายงานการใช้ยา" }
];

const reportSummaries: Record<
  ReportKey,
  { title: string; description: string; metrics: Array<{ label: string; value: string }> }
> = {
  daily: {
    title: "รายงานรายวัน",
    description: "สรุปจำนวนผู้เข้ารับบริการในวันนี้ พร้อมคิวรอและเคสที่ต้องเฝ้าระวังเป็นพิเศษ",
    metrics: [
      { label: "ผู้เข้ารับบริการ", value: "42 คน" },
      { label: "คิวที่ปิดแล้ว", value: "33 คิว" },
      { label: "เคสส่งต่อ", value: "2 เคส" }
    ]
  },
  monthly: {
    title: "รายงานรายเดือน",
    description: "ดูแนวโน้มจำนวนผู้ป่วย อาการที่พบบ่อย และภาระงานประจำเดือนของห้องพยาบาล",
    metrics: [
      { label: "จำนวนผู้ป่วยรวม", value: "684 คน" },
      { label: "อาการพบบ่อย", value: "ปวดศีรษะ" },
      { label: "วันใช้งานสูงสุด", value: "วันจันทร์" }
    ]
  },
  students: {
    title: "รายงานนักศึกษา",
    description: "สรุปข้อมูลนักศึกษาที่เข้ารับบริการบ่อย และกลุ่มที่ควรติดตามโรคประจำตัวต่อเนื่อง",
    metrics: [
      { label: "นักศึกษาที่มีประวัติรักษา", value: "215 คน" },
      { label: "ต้องติดตามต่อ", value: "18 คน" },
      { label: "กลุ่มเสี่ยงแพ้ยา", value: "7 คน" }
    ]
  },
  medicine: {
    title: "รายงานการใช้ยา",
    description: "สรุปการเบิกใช้ยาในช่วงล่าสุด เพื่อช่วยตรวจคลังยาและวางแผนเติมสต็อก",
    metrics: [
      { label: "ยาที่ใช้มากสุด", value: "Paracetamol" },
      { label: "จำนวนเบิกวันนี้", value: "96 เม็ด" },
      { label: "ยาใกล้หมด", value: "5 รายการ" }
    ]
  }
};

export default function DashboardPage() {
  const router = useRouter();
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportKey>("daily");

  useEffect(() => {
    const session = getCurrentSession();
    if (!session || session.role !== "admin") {
      router.replace("/nurse/login");
      return;
    }

    setIsAdmin(true);
    setShifts(loadShiftSchedule());
    setAuthReady(true);
  }, [router]);

  const shiftRows = useMemo(() => (shifts.length > 0 ? shifts : getDefaultShifts()), [shifts]);
  const activeReport = reportSummaries[selectedReport];

  function handleShiftInput(id: ShiftRecord["id"], field: keyof Omit<ShiftRecord, "id">) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setShifts((prev) => {
        const base = prev.length > 0 ? prev : getDefaultShifts();
        return base.map((item) => (item.id === id ? { ...item, [field]: event.target.value } : item));
      });
    };
  }

  function handleSaveShifts() {
    if (!isAdmin) return;
    saveShiftSchedule(shiftRows);
    setMessage("บันทึกเวรเรียบร้อย");
  }

  if (!authReady) {
    return (
      <section className={styles.panel}>
        <h3 className={styles.sectionTitle}>กำลังตรวจสอบสิทธิ์ผู้ดูแล...</h3>
      </section>
    );
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
            <div className={styles.reportControl}>
              <div>
                <label className={styles.label}>เลือกรายงาน</label>
                <select
                  className={styles.select}
                  value={selectedReport}
                  onChange={(event) => setSelectedReport(event.target.value as ReportKey)}
                >
                  {reportOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className={styles.sectionSub}>รวมไว้ในดรอปดาวน์เดียว เพื่อลดปุ่มซ้ำและเลือกดูข้อมูลได้ชัดขึ้น</p>
            </div>

            <div className={styles.reportPreview}>
              <div className={styles.reportPreviewHead}>
                <h4 className={styles.cardTitle}>{activeReport.title}</h4>
                <p className={styles.infoText}>{activeReport.description}</p>
              </div>
              <div className={styles.reportMetricGrid}>
                {activeReport.metrics.map((metric) => (
                  <article key={metric.label} className={styles.reportMetricCard}>
                    <p className={styles.reportMetricLabel}>{metric.label}</p>
                    <p className={styles.reportMetricValue}>{metric.value}</p>
                  </article>
                ))}
              </div>
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
