"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import styles from "../nurse.module.css";
import { getCurrentSession } from "../lib/auth";
import { type ShiftRecord, getDefaultShifts, loadShiftSchedule, saveShiftSchedule } from "../lib/shiftSchedule";

const adminSidebar = [
  { href: "#overview", icon: "🏥", label: "Dashboard" },
  { href: "/nurse/students", icon: "🎓", label: "นักศึกษา" },
  { href: "/nurse/treatment", icon: "🧾", label: "การรักษา" },
  { href: "/nurse/medicines", icon: "💊", label: "คลังยา" },
  { href: "/nurse/news", icon: "📰", label: "ข่าว" },
  { href: "#reports", icon: "📊", label: "รายงาน" }
];

const statCards = [
  { label: "ผู้ป่วยวันนี้", value: "42", icon: "🧑‍⚕️", tone: "blue" },
  { label: "รอรักษา", value: "9", icon: "📋", tone: "amber" },
  { label: "ยาพร้อมใช้", value: "96", icon: "💊", tone: "green" },
  { label: "รายงานรอตรวจ", value: "2", icon: "📈", tone: "sky" }
];

const quickActions = [
  { href: "/nurse/symptom", icon: "👤", label: "ลงทะเบียนผู้ป่วย" },
  { href: "/nurse/treatment", icon: "🧾", label: "บันทึกการรักษา" },
  { href: "/nurse/visits", icon: "💊", label: "ประวัติการจ่ายยา" },
  { href: "/nurse/video", icon: "📹", label: "วิดีโอคอล" }
];

const recentRecords = [
  { name: "สมชาย มูลใจ", age: "45", date: "24/04/2026", status: "กำลังรักษา", badge: "warning" },
  { name: "วิภา ศรีสุข", age: "32", date: "24/04/2026", status: "หายแล้ว", badge: "success" },
  { name: "วรรณา เลิศสุข", age: "28", date: "23/04/2026", status: "ติดตามผล", badge: "info" }
];

const healthBars = [
  { day: "จ", visits: 54, treatment: 28, recovered: 42 },
  { day: "อ", visits: 76, treatment: 46, recovered: 54 },
  { day: "พ", visits: 74, treatment: 52, recovered: 68 },
  { day: "พฤ", visits: 68, treatment: 80, recovered: 76 },
  { day: "ศ", visits: 74, treatment: 62, recovered: 86 },
  { day: "ส", visits: 90, treatment: 0, recovered: 82 }
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
    description: "สรุปผู้เข้ารับบริการ คิวรอ และเคสที่ต้องติดตามในวันนี้",
    metrics: [
      { label: "ผู้เข้ารับบริการ", value: "42 คน" },
      { label: "คิวที่ปิดแล้ว", value: "33 คิว" },
      { label: "เคสส่งต่อ", value: "2 เคส" }
    ]
  },
  monthly: {
    title: "รายงานรายเดือน",
    description: "ดูแนวโน้มจำนวนผู้ป่วย อาการที่พบบ่อย และภาระงานประจำเดือน",
    metrics: [
      { label: "จำนวนผู้ป่วยรวม", value: "684 คน" },
      { label: "อาการพบบ่อย", value: "ปวดศีรษะ" },
      { label: "วันใช้งานสูงสุด", value: "วันจันทร์" }
    ]
  },
  students: {
    title: "รายงานนักศึกษา",
    description: "สรุปนักศึกษาที่เข้ารับบริการบ่อยและกลุ่มที่ควรติดตามต่อเนื่อง",
    metrics: [
      { label: "มีประวัติรักษา", value: "215 คน" },
      { label: "ต้องติดตามต่อ", value: "18 คน" },
      { label: "กลุ่มแพ้ยา", value: "7 คน" }
    ]
  },
  medicine: {
    title: "รายงานการใช้ยา",
    description: "สรุปการเบิกใช้ยา เพื่อช่วยตรวจคลังยาและวางแผนเติมสต็อก",
    metrics: [
      { label: "ยาที่ใช้มากสุด", value: "Paracetamol" },
      { label: "จำนวนเบิกวันนี้", value: "96 เม็ด" },
      { label: "ยาใกล้หมด", value: "5 รายการ" }
    ]
  }
};

function currentShift(shifts: ShiftRecord[]) {
  return shifts[0] || getDefaultShifts()[0];
}

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
  const activeShift = currentShift(shiftRows);
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
    <section className={styles.dashboardStudio} id="overview">
      <aside className={styles.dashboardRail} aria-label="เมนู Dashboard">
        <img src="/logo.png" alt="ระบบห้องพยาบาล" className={styles.dashboardRailLogo} />
        <nav className={styles.dashboardRailNav}>
          {adminSidebar.map((item) => (
            <Link key={item.label} href={item.href} className={styles.dashboardRailLink} title={item.label}>
              <span>{item.icon}</span>
              <small>{item.label}</small>
            </Link>
          ))}
        </nav>
      </aside>

      <div className={styles.dashboardCanvas}>
        <header className={styles.dashboardHeaderCard}>
          <div className={styles.dashboardBrandLine}>
            <img src="/logo.png" alt="ระบบห้องพยาบาล" className={styles.dashboardBrandLogo} />
            <div>
              <p className={styles.dashboardEyebrow}>Nursing Room Dashboard</p>
              <h2 className={styles.dashboardTitle}>ศูนย์ดูแลสุขภาพนักศึกษา</h2>
            </div>
          </div>
          <label className={styles.dashboardSearch}>
            <span>⌕</span>
            <input placeholder="ค้นหานักศึกษา / คิว / ยา" />
          </label>
          <div className={styles.dashboardProfileCard}>
            <span className={styles.dashboardAvatar}>👩‍⚕️</span>
            <div>
              <b>Admin</b>
              <small>ผู้ดูแลระบบ</small>
            </div>
          </div>
        </header>

        <div className={styles.dashboardStatsGrid}>
          {statCards.map((card) => (
            <article key={card.label} className={`${styles.dashboardStatCard} ${styles[`dashboardTone${card.tone}`]}`}>
              <span className={styles.dashboardStatIcon}>{card.icon}</span>
              <div>
                <p>{card.label}</p>
                <strong>{card.value}</strong>
              </div>
            </article>
          ))}
        </div>

        <div className={styles.dashboardMainGrid}>
          <article className={styles.dashboardPanel}>
            <div className={styles.dashboardPanelHead}>
              <h3>Quick Actions</h3>
            </div>
            <div className={styles.dashboardActionList}>
              {quickActions.map((action, index) => (
                <Link key={action.label} href={action.href} className={index === 0 ? styles.dashboardActionPrimary : styles.dashboardActionItem}>
                  <span>{action.icon}</span>
                  <b>{action.label}</b>
                </Link>
              ))}
            </div>
          </article>

          <article className={`${styles.dashboardPanel} ${styles.dashboardRecordPanel}`}>
            <div className={styles.dashboardPanelHead}>
              <h3>Recent Patient Records</h3>
              <Link href="/nurse/treatment">View All</Link>
            </div>
            <div className={styles.dashboardRecordTable}>
              <div className={styles.dashboardRecordHead}>
                <span>ชื่อ</span>
                <span>อายุ</span>
                <span>วันที่</span>
                <span>สถานะ</span>
              </div>
              {recentRecords.map((record) => (
                <div key={record.name} className={styles.dashboardRecordRow}>
                  <span>{record.name}</span>
                  <span>{record.age}</span>
                  <span>{record.date}</span>
                  <em className={`${styles.dashboardStatusBadge} ${styles[`dashboardBadge${record.badge}`]}`}>{record.status}</em>
                </div>
              ))}
            </div>
          </article>

          <article className={styles.dashboardPanel}>
            <div className={styles.dashboardPanelHead}>
              <h3>Upcoming Appointments</h3>
            </div>
            <div className={styles.dashboardAppointmentList}>
              {shiftRows.slice(0, 3).map((shift, index) => (
                <div key={shift.id} className={styles.dashboardAppointmentItem}>
                  <strong>{index === 0 ? "09:00" : index === 1 ? "11:30" : "13:00"}</strong>
                  <div>
                    <b>{shift.nurse || "พยาบาลเวร"}</b>
                    <small>{shift.label} · {shift.time}</small>
                  </div>
                  <span>{index === 0 ? "👤" : index === 1 ? "➕" : "🗓️"}</span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className={styles.dashboardChartGrid}>
          <article className={styles.dashboardPanel}>
            <div className={styles.dashboardPanelHead}>
              <h3>Health Stats Overview</h3>
              <Link href="#reports">View All</Link>
            </div>
            <div className={styles.dashboardBarChart}>
              {healthBars.map((item) => (
                <div key={item.day} className={styles.dashboardBarGroup}>
                  <span style={{ height: `${item.visits}%` }} />
                  <span style={{ height: `${item.treatment}%` }} />
                  <span style={{ height: `${item.recovered}%` }} />
                  <small>{item.day}</small>
                </div>
              ))}
            </div>
            <div className={styles.dashboardChartLegend}>
              <span><i className={styles.legendBlue} /> ผู้ป่วย</span>
              <span><i className={styles.legendGreen} /> รักษา</span>
              <span><i className={styles.legendSky} /> หายแล้ว</span>
            </div>
          </article>

          <article className={styles.dashboardPanel}>
            <div className={styles.dashboardPanelHead}>
              <h3>Medication Stock</h3>
            </div>
            <div className={styles.dashboardPieWrap}>
              <div className={styles.dashboardPieChart}>
                <span>96</span>
              </div>
              <ul className={styles.dashboardPieLegend}>
                <li><i className={styles.legendBlue} /> ยาแก้ปวด 38%</li>
                <li><i className={styles.legendGreen} /> ยาสามัญ 30%</li>
                <li><i className={styles.legendTeal} /> เวชภัณฑ์ 28%</li>
              </ul>
            </div>
          </article>
        </div>

        <section id="reports" className={styles.dashboardPanel}>
          <div className={styles.dashboardPanelHead}>
            <h3>รายงานสถิติ</h3>
            <select
              className={styles.dashboardReportSelect}
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

          <div className={styles.dashboardReportPreview}>
            <div>
              <h4>{activeReport.title}</h4>
              <p>{activeReport.description}</p>
            </div>
            {activeReport.metrics.map((metric) => (
              <article key={metric.label}>
                <small>{metric.label}</small>
                <b>{metric.value}</b>
              </article>
            ))}
          </div>
        </section>

        <section id="today-shift-editor" className={styles.dashboardPanel}>
          <div className={styles.dashboardPanelHead}>
            <div>
              <h3>แก้ไขเวรวันนี้</h3>
              <p>เวรปัจจุบัน: {activeShift.nurse || "-"} · {activeShift.time || "-"}</p>
            </div>
            <button className={`${styles.button} ${styles.btnPrimary}`} type="button" onClick={handleSaveShifts}>
              💾 บันทึกเวร
            </button>
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
        </section>
      </div>
    </section>
  );
}
