"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import styles from "../nurse.module.css";
import { getCurrentSession } from "../lib/auth";
import { fetchEntity, type StoreRow } from "../lib/storeApi";
import { type ShiftRecord, getDefaultShifts } from "../lib/shiftSchedule";
import { fetchShiftScheduleFromStore, saveShiftScheduleToStore } from "../lib/shiftStore";

const adminSidebar = [
  { href: "#overview", icon: "🏥", label: "หน้าควบคุม" },
  { href: "/nurse/students", icon: "🎓", label: "นักศึกษา" },
  { href: "/nurse/treatment", icon: "🧾", label: "การรักษา" },
  { href: "/nurse/medicines", icon: "💊", label: "คลังยา" },
  { href: "/nurse/news", icon: "📰", label: "ข่าว" },
  { href: "#reports", icon: "📊", label: "รายงาน" }
];

const quickActions = [
  { href: "/nurse/symptom", icon: "👤", label: "ลงทะเบียนผู้ป่วย" },
  { href: "/nurse/treatment", icon: "🧾", label: "บันทึกการรักษา" },
  { href: "/nurse/visits", icon: "💊", label: "ประวัติการจ่ายยา" },
  { href: "/nurse/video", icon: "📹", label: "วิดีโอคอล" }
];

type ReportKey = "daily" | "monthly" | "students" | "medicine";
type BadgeTone = "warning" | "success" | "info";

type DashboardRows = {
  visits: StoreRow[];
  students: StoreRow[];
  medicines: StoreRow[];
  visitMedicines: StoreRow[];
  feedback: StoreRow[];
};

const EMPTY_ROWS: DashboardRows = {
  visits: [],
  students: [],
  medicines: [],
  visitMedicines: [],
  feedback: []
};

const reportOptions: Array<{ value: ReportKey; label: string }> = [
  { value: "daily", label: "รายงานรายวัน" },
  { value: "monthly", label: "รายงานรายเดือน" },
  { value: "students", label: "รายงานนักศึกษา" },
  { value: "medicine", label: "รายงานการใช้ยา" }
];

function currentShift(shifts: ShiftRecord[]) {
  return shifts[0] || getDefaultShifts()[0];
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDate(value: unknown) {
  const raw = toText(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateFromRow(row: StoreRow) {
  return parseDate(row.visit_at || row.date || row.created_at || row.updated_at || row.published_at);
}

function isSameDay(date: Date | null, target: Date) {
  if (!date) return false;
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth() && date.getDate() === target.getDate();
}

function isSameMonth(date: Date | null, target: Date) {
  if (!date) return false;
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth();
}

function formatDate(value: Date | null) {
  if (!value) return "-";
  return value.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function studentName(row?: StoreRow) {
  if (!row) return "-";
  return toText(row.student_name) || `${toText(row.first_name)} ${toText(row.last_name)}`.trim() || "-";
}

function visitStatus(row: StoreRow) {
  return toText(row.triage_status || row.status) || (toText(row.severity) === "หนัก" ? "ส่งโรงพยาบาล" : "รอตรวจ");
}

function isPendingVisit(row: StoreRow) {
  const status = visitStatus(row);
  if (/เสร็จ|หาย|ยกเลิก/.test(status)) return false;
  return /รอ|กำลัง|ตรวจ|คัดกรอง|ส่ง/.test(status);
}

function isSevereVisit(row: StoreRow) {
  const data = `${toText(row.severity)} ${visitStatus(row)}`;
  return /หนัก|ส่งโรงพยาบาล|ฉุกเฉิน/.test(data);
}

function badgeForStatus(status: string): BadgeTone {
  if (/เสร็จ|หาย|ตรวจแล้ว/.test(status)) return "success";
  if (/ส่ง|หนัก|ฉุกเฉิน/.test(status)) return "warning";
  return "info";
}

function stockQty(row: StoreRow) {
  return toNumber(row.stock_qty ?? row.quantity, 0);
}

function reorderLevel(row: StoreRow) {
  return toNumber(row.reorder_level, 10);
}

function categoryName(row: StoreRow) {
  return toText(row.category) || "เวชภัณฑ์";
}

function buildDayBars(visits: StoreRow[]) {
  const today = new Date();
  const days = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (5 - index));
    return date;
  });

  const raw = days.map((date) => {
    const dayVisits = visits.filter((row) => isSameDay(dateFromRow(row), date));
    const treated = dayVisits.filter((row) => /เสร็จ|หาย|ตรวจแล้ว/.test(visitStatus(row))).length;
    const pending = dayVisits.filter(isPendingVisit).length;
    return {
      day: date.toLocaleDateString("th-TH", { weekday: "short" }).replace("วัน", ""),
      visits: dayVisits.length,
      treatment: pending,
      recovered: treated
    };
  });

  const max = Math.max(1, ...raw.flatMap((item) => [item.visits, item.treatment, item.recovered]));
  return raw.map((item) => ({
    ...item,
    visitsHeight: item.visits > 0 ? Math.max(8, Math.round((item.visits / max) * 100)) : 4,
    treatmentHeight: item.treatment > 0 ? Math.max(8, Math.round((item.treatment / max) * 100)) : 4,
    recoveredHeight: item.recovered > 0 ? Math.max(8, Math.round((item.recovered / max) * 100)) : 4
  }));
}

export default function DashboardPage() {
  const router = useRouter();
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [rows, setRows] = useState<DashboardRows>(EMPTY_ROWS);
  const [dataMessage, setDataMessage] = useState("");
  const [selectedReport, setSelectedReport] = useState<ReportKey>("daily");

  useEffect(() => {
    const session = getCurrentSession();
    if (!session || session.role !== "admin") {
      router.replace("/nurse/login");
      return;
    }

    setIsAdmin(true);
    setShifts(getDefaultShifts());
    void fetchShiftScheduleFromStore()
      .then((storeShifts) => {
        if (storeShifts) setShifts(storeShifts);
      })
      .catch(() => {
        // Keep local cached shifts if Google Sheet is temporarily unavailable.
      });
    setAuthReady(true);
  }, [router]);

  useEffect(() => {
    if (!authReady) return;

    async function loadDashboardRows() {
      try {
        const [visits, students, medicines, visitMedicines, feedback] = await Promise.all([
          fetchEntity("visits"),
          fetchEntity("students"),
          fetchEntity("medicines"),
          fetchEntity("visit_medicines"),
          fetchEntity("feedback")
        ]);
        setRows({ visits, students, medicines, visitMedicines, feedback });
        setDataMessage("");
      } catch (error) {
        setRows(EMPTY_ROWS);
        setDataMessage(error instanceof Error ? `โหลดข้อมูล Dashboard ไม่สำเร็จ: ${error.message}` : "โหลดข้อมูล Dashboard ไม่สำเร็จ");
      }
    }

    void loadDashboardRows();
  }, [authReady]);

  const shiftRows = useMemo(() => (shifts.length > 0 ? shifts : getDefaultShifts()), [shifts]);
  const activeShift = currentShift(shiftRows);

  const dashboard = useMemo(() => {
    const today = new Date();
    const studentsById = new Map<number, StoreRow>();
    const studentsByCode = new Map<string, StoreRow>();
    rows.students.forEach((student) => {
      studentsById.set(toNumber(student.id), student);
      const code = toText(student.student_code || student.studentCode);
      if (code) studentsByCode.set(code, student);
    });

    const todayVisits = rows.visits.filter((row) => isSameDay(dateFromRow(row), today));
    const monthVisits = rows.visits.filter((row) => isSameMonth(dateFromRow(row), today));
    const pendingVisits = rows.visits.filter(isPendingVisit);
    const severeVisits = rows.visits.filter(isSevereVisit);
    const lowStock = rows.medicines.filter((row) => stockQty(row) <= reorderLevel(row));
    const totalStock = rows.medicines.reduce((sum, row) => sum + stockQty(row), 0);

    const recentRecords = [...rows.visits]
      .sort((a, b) => {
        const dateA = dateFromRow(a)?.getTime() || 0;
        const dateB = dateFromRow(b)?.getTime() || 0;
        return dateB - dateA || toNumber(b.id) - toNumber(a.id);
      })
      .slice(0, 3)
      .map((row) => {
        const student = studentsById.get(toNumber(row.student_id)) || studentsByCode.get(toText(row.student_code || row.student_id));
        const status = visitStatus(row);
        return {
          name: studentName(student) !== "-" ? studentName(student) : toText(row.student_name) || "ไม่ระบุชื่อ",
          code: toText(student?.student_code || row.student_code) || "-",
          date: formatDate(dateFromRow(row)),
          status,
          badge: badgeForStatus(status)
        };
      });

    const categoryTotals = new Map<string, number>();
    rows.medicines.forEach((row) => {
      categoryTotals.set(categoryName(row), (categoryTotals.get(categoryName(row)) || 0) + stockQty(row));
    });
    const topCategories = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, value]) => ({
        label,
        value,
        percent: totalStock > 0 ? Math.round((value / totalStock) * 100) : 0
      }));

    return {
      todayVisits,
      monthVisits,
      pendingVisits,
      severeVisits,
      lowStock,
      totalStock,
      recentRecords,
      healthBars: buildDayBars(rows.visits),
      topCategories,
      statCards: [
        { label: "ผู้ป่วยวันนี้", value: String(todayVisits.length), icon: "🧑‍⚕️", tone: "blue" },
        { label: "รอรักษา", value: String(pendingVisits.length), icon: "📋", tone: "amber" },
        { label: "ยาพร้อมใช้", value: String(totalStock), icon: "💊", tone: "green" },
        { label: "เคสเร่งด่วน", value: String(severeVisits.length), icon: "📈", tone: "sky" }
      ]
    };
  }, [rows]);

  const activeReport = useMemo(() => {
    const reports = {
      daily: {
        title: "รายงานรายวัน",
        description: "สรุปข้อมูลที่บันทึกจริงในวันนี้จาก Google Sheet",
        metrics: [
          { label: "ผู้เข้ารับบริการ", value: `${dashboard.todayVisits.length} คน` },
          { label: "คิวที่ยังต้องติดตาม", value: `${dashboard.pendingVisits.length} คิว` },
          { label: "เคสเร่งด่วน", value: `${dashboard.severeVisits.length} เคส` }
        ]
      },
      monthly: {
        title: "รายงานรายเดือน",
        description: "ดูปริมาณงานเดือนนี้จากข้อมูลการรักษาที่บันทึกไว้",
        metrics: [
          { label: "ผู้ป่วยเดือนนี้", value: `${dashboard.monthVisits.length} คน` },
          { label: "นักศึกษาทั้งหมด", value: `${rows.students.length} คน` },
          { label: "ประเมินบริการ", value: `${rows.feedback.length} รายการ` }
        ]
      },
      students: {
        title: "รายงานนักศึกษา",
        description: "สรุปฐานข้อมูลนักศึกษาและประวัติการเข้ารับบริการ",
        metrics: [
          { label: "นักศึกษาในระบบ", value: `${rows.students.length} คน` },
          { label: "ประวัติการรักษา", value: `${rows.visits.length} รายการ` },
          { label: "รอติดตาม", value: `${dashboard.pendingVisits.length} รายการ` }
        ]
      },
      medicine: {
        title: "รายงานการใช้ยา",
        description: "สรุปคลังยาและรายการที่ควรเติมสต็อก",
        metrics: [
          { label: "จำนวนยาในคลัง", value: `${dashboard.totalStock} หน่วย` },
          { label: "ยาใกล้หมด", value: `${dashboard.lowStock.length} รายการ` },
          { label: "ประวัติจ่ายยา", value: `${rows.visitMedicines.length} รายการ` }
        ]
      }
    } satisfies Record<ReportKey, { title: string; description: string; metrics: Array<{ label: string; value: string }> }>;

    return reports[selectedReport];
  }, [dashboard, rows.feedback.length, rows.students.length, rows.visitMedicines.length, rows.visits.length, selectedReport]);

  function handleShiftInput(id: ShiftRecord["id"], field: keyof Omit<ShiftRecord, "id">) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setShifts((prev) => {
        const base = prev.length > 0 ? prev : getDefaultShifts();
        return base.map((item) => (item.id === id ? { ...item, [field]: event.target.value } : item));
      });
    };
  }

  async function handleSaveShifts() {
    if (!isAdmin) return;
    try {
      await saveShiftScheduleToStore(shiftRows);
      setMessage("บันทึกเวรลง Google Sheet เรียบร้อย");
    } catch (error) {
      setMessage(error instanceof Error ? `บันทึกเวรไม่สำเร็จ: ${error.message}` : "บันทึกเวรไม่สำเร็จ");
    }
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
              <p className={styles.dashboardEyebrow}>NURSE ROOM MANAGEMENT</p>
              <h2 className={styles.dashboardTitle}>ระบบห้องพยาบาล</h2>
            </div>
          </div>
          <label className={styles.dashboardSearch}>
            <span>⌕</span>
            <input placeholder="ค้นหานักศึกษา / คิว / ยา" />
          </label>
          <div className={styles.dashboardProfileCard}>
            <span className={styles.dashboardAvatar}>👩‍⚕️</span>
            <div>
              <b>ผู้ดูแล</b>
              <small>ระบบห้องพยาบาล</small>
            </div>
          </div>
        </header>

        {dataMessage ? <div className={styles.alertBanner}>{dataMessage}</div> : null}

        <div className={styles.dashboardStatsGrid}>
          {dashboard.statCards.map((card) => (
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
              <h3>งานด่วน</h3>
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
              <h3>ประวัติผู้ป่วยล่าสุด</h3>
              <Link href="/nurse/treatment">ดูทั้งหมด</Link>
            </div>
            <div className={styles.dashboardRecordTable}>
              <div className={styles.dashboardRecordHead}>
                <span>ชื่อ</span>
                <span>รหัส</span>
                <span>วันที่</span>
                <span>สถานะ</span>
              </div>
              {dashboard.recentRecords.length > 0 ? (
                dashboard.recentRecords.map((record) => (
                  <div key={`${record.code}-${record.date}-${record.status}`} className={styles.dashboardRecordRow}>
                    <span>{record.name}</span>
                    <span>{record.code}</span>
                    <span>{record.date}</span>
                    <em className={`${styles.dashboardStatusBadge} ${styles[`dashboardBadge${record.badge}`]}`}>{record.status}</em>
                  </div>
                ))
              ) : (
                <p className={styles.infoText}>ยังไม่มีประวัติการรักษาในระบบ</p>
              )}
            </div>
          </article>

          <article className={styles.dashboardPanel}>
            <div className={styles.dashboardPanelHead}>
              <h3>เวรประจำวันนี้</h3>
            </div>
            <div className={styles.dashboardAppointmentList}>
              {shiftRows.slice(0, 3).map((shift) => (
                <div key={shift.id} className={styles.dashboardAppointmentItem}>
                  <strong>{shift.time.split("-")[0]?.trim() || "-"}</strong>
                  <div>
                    <b>{shift.nurse || "ยังไม่ได้กำหนดผู้รับเวร"}</b>
                    <small>{shift.label} · {shift.time}</small>
                  </div>
                  <span>👤</span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className={styles.dashboardChartGrid}>
          <article className={styles.dashboardPanel}>
            <div className={styles.dashboardPanelHead}>
              <h3>สรุปงานห้องพยาบาล</h3>
              <Link href="#reports">ดูรายงาน</Link>
            </div>
            <div className={styles.dashboardBarChart}>
              {dashboard.healthBars.map((item) => (
                <div key={item.day} className={styles.dashboardBarGroup}>
                  <span style={{ height: `${item.visitsHeight}%` }} />
                  <span style={{ height: `${item.treatmentHeight}%` }} />
                  <span style={{ height: `${item.recoveredHeight}%` }} />
                  <small>{item.day}</small>
                </div>
              ))}
            </div>
            <div className={styles.dashboardChartLegend}>
              <span><i className={styles.legendBlue} /> ผู้ป่วย</span>
              <span><i className={styles.legendGreen} /> รอติดตาม</span>
              <span><i className={styles.legendSky} /> เสร็จสิ้น</span>
            </div>
          </article>

          <article className={styles.dashboardPanel}>
            <div className={styles.dashboardPanelHead}>
              <h3>สรุปคลังยา</h3>
            </div>
            <div className={styles.dashboardPieWrap}>
              <div className={styles.dashboardPieChart}>
                <span>{dashboard.totalStock}</span>
              </div>
              <ul className={styles.dashboardPieLegend}>
                {dashboard.topCategories.length > 0 ? (
                  dashboard.topCategories.map((item, index) => (
                    <li key={item.label}>
                      <i className={index === 0 ? styles.legendBlue : index === 1 ? styles.legendGreen : styles.legendTeal} /> {item.label} {item.percent}%
                    </li>
                  ))
                ) : (
                  <li><i className={styles.legendBlue} /> ยังไม่มีข้อมูลยา</li>
                )}
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
            <button className={`${styles.button} ${styles.btnPrimary}`} type="button" onClick={() => void handleSaveShifts()}>
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
