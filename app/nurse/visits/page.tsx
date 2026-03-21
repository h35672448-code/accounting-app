"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../nurse.module.css";
import { fetchEntity, saveEntity, StoreRow } from "../lib/storeApi";

type Severity = "ปกติ" | "ปานกลาง" | "หนัก";

type Visit = {
  id: number;
  studentId: number;
  studentCode: string;
  studentName: string;
  caregiver: string;
  symptom: string;
  severity: Severity;
  time: string;
  status: string;
  parentNotified: boolean;
  note: string;
};

type VisitForm = Omit<Visit, "id" | "studentId" | "status" | "parentNotified" | "note">;

const INITIAL_VISITS: Visit[] = [
  {
    id: 1,
    studentId: 1,
    studentCode: "66012001",
    studentName: "กิตติพงษ์ สายชล",
    caregiver: "admin",
    symptom: "ปวดศีรษะ",
    severity: "ปานกลาง",
    time: "09:10",
    status: "กำลังตรวจ",
    parentNotified: false,
    note: ""
  },
  {
    id: 2,
    studentId: 2,
    studentCode: "66013044",
    studentName: "พิมพ์ชนก คำแก้ว",
    caregiver: "admin",
    symptom: "หายใจไม่สะดวก",
    severity: "หนัก",
    time: "10:05",
    status: "ส่งโรงพยาบาล",
    parentNotified: true,
    note: "ส่งต่อโรงพยาบาลวิทยาลัย"
  }
];

const EMPTY_FORM: VisitForm = {
  studentCode: "",
  studentName: "",
  caregiver: "",
  symptom: "",
  severity: "ปกติ",
  time: ""
};

const USER_STORAGE_KEY = "nurse_current_user";

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function getBadgeClass(severity: Severity): string {
  if (severity === "หนัก") return `${styles.badge} ${styles.badgeSevere}`;
  if (severity === "ปานกลาง") return `${styles.badge} ${styles.badgeMedium}`;
  return `${styles.badge} ${styles.badgeNormal}`;
}

function formatTime(value: unknown) {
  const input = toText(value);
  if (!input) return "";
  const date = new Date(input);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  if (/^\d{1,2}:\d{2}$/.test(input)) return input;
  return "";
}

function toVisitAtIso(time: string) {
  const now = new Date();
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      now.setHours(hour, minute, 0, 0);
      return now.toISOString();
    }
  }
  return new Date().toISOString();
}

function studentNameFromRow(row: StoreRow) {
  const full = `${toText(row.first_name)} ${toText(row.last_name)}`.trim();
  return full || toText(row.student_name);
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "ไม่ระบุ",
    lastName: parts.slice(1).join(" ") || "-"
  };
}

function visitToRow(item: Visit): StoreRow {
  const now = new Date().toISOString();
  return {
    id: item.id,
    student_id: item.studentId,
    symptom: item.symptom,
    severity: item.severity,
    triage_status: item.status,
    nurse_id: 1,
    visit_at: toVisitAtIso(item.time),
    parent_notified: item.parentNotified ? 1 : 0,
    event_note: item.note,
    student_code: item.studentCode,
    student_name: item.studentName,
    caregiver: item.caregiver,
    nurse_name: item.caregiver,
    updated_at: now,
    created_at: now
  };
}

function mapVisitsFromRows(visitRows: StoreRow[], studentsRows: StoreRow[]): Visit[] {
  const studentsById = new Map<number, StoreRow>();
  studentsRows.forEach((row) => {
    studentsById.set(toNumber(row.id), row);
  });

  return visitRows
    .map((row, index) => {
      const studentId = toNumber(row.student_id);
      const student = studentsById.get(studentId);
      const severityRaw = toText(row.severity);
      const severity: Severity = severityRaw === "หนัก" || severityRaw === "ปานกลาง" ? severityRaw : "ปกติ";

      return {
        id: toNumber(row.id, index + 1),
        studentId,
        studentCode: toText(student?.student_code || row.student_code),
        studentName: toText(student ? studentNameFromRow(student) : row.student_name),
        caregiver: toText(row.caregiver || row.nurse_name) || "ไม่ระบุ",
        symptom: toText(row.symptom),
        severity,
        time: formatTime(row.visit_at),
        status: toText(row.triage_status) || (severity === "หนัก" ? "ส่งโรงพยาบาล" : "รอคัดกรอง"),
        parentNotified: String(row.parent_notified ?? "") === "1",
        note: toText(row.event_note)
      };
    })
    .sort((a, b) => b.id - a.id);
}

export default function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [studentsRows, setStudentsRows] = useState<StoreRow[]>([]);
  const [form, setForm] = useState<VisitForm>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const selectedVisit = useMemo(() => visits.find((visit) => visit.id === selectedId) ?? null, [selectedId, visits]);

  const filteredVisits = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const base = visits.filter((visit) => {
      if (!keyword) return true;
      const data = `${visit.studentCode} ${visit.studentName} ${visit.symptom} ${visit.severity} ${visit.status}`.toLowerCase();
      return data.includes(keyword);
    });

    if (showHistory) return base;
    return base.filter((visit) => visit.status !== "เสร็จสิ้น");
  }, [search, showHistory, visits]);

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(USER_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { username?: unknown };
      const username = toText(parsed.username);
      if (!username) return;
      setForm((prev) => (prev.caregiver ? prev : { ...prev, caregiver: username }));
    } catch {
      // Ignore malformed localStorage payload.
    }
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [visitRows, studentRows] = await Promise.all([fetchEntity("visits"), fetchEntity("students")]);
      setStudentsRows(studentRows);

      if (visitRows.length === 0) {
        setVisits(INITIAL_VISITS);
        await saveEntity(
          "visits",
          INITIAL_VISITS.map(visitToRow)
        );
        setSelectedId(INITIAL_VISITS[0]?.id ?? null);
      } else {
        const mapped = mapVisitsFromRows(visitRows, studentRows);
        setVisits(mapped);
        setSelectedId(mapped[0]?.id ?? null);
      }
      setMessage("");
    } catch (error) {
      setVisits(INITIAL_VISITS);
      setSelectedId(INITIAL_VISITS[0]?.id ?? null);
      setMessage(error instanceof Error ? `โหลดข้อมูลผู้ป่วยไม่สำเร็จ: ${error.message}` : "โหลดข้อมูลผู้ป่วยไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function persistVisits(next: Visit[], successMessage: string) {
    setVisits(next);
    try {
      await saveEntity(
        "visits",
        next.map(visitToRow)
      );
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? `บันทึกข้อมูลผู้ป่วยไม่สำเร็จ: ${error.message}` : "บันทึกข้อมูลผู้ป่วยไม่สำเร็จ");
    }
  }

  async function ensureStudentId(studentCode: string, studentName: string) {
    const found = studentsRows.find((row) => toText(row.student_code) === studentCode);
    if (found) {
      return toNumber(found.id);
    }

    const nextId = studentsRows.length ? Math.max(...studentsRows.map((row) => toNumber(row.id))) + 1 : 1;
    const name = splitName(studentName);
    const now = new Date().toISOString();

    const nextStudent: StoreRow = {
      id: nextId,
      student_code: studentCode,
      first_name: name.firstName,
      last_name: name.lastName,
      department: "ไม่ระบุ",
      class_room: "ไม่ระบุ",
      allergy_note: "",
      chronic_note: "",
      created_at: now,
      updated_at: now
    };

    const merged = [...studentsRows, nextStudent];
    setStudentsRows(merged);
    await saveEntity("students", merged);
    return nextId;
  }

  async function upsertVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: VisitForm = {
      studentCode: form.studentCode.trim(),
      studentName: form.studentName.trim(),
      caregiver: form.caregiver.trim(),
      symptom: form.symptom.trim(),
      severity: form.severity,
      time: form.time.trim()
    };

    if (!payload.studentCode || !payload.studentName || !payload.caregiver || !payload.symptom || !payload.time) {
      setMessage("กรอกข้อมูลผู้ป่วยให้ครบ");
      return;
    }

    try {
      const studentId = await ensureStudentId(payload.studentCode, payload.studentName);

      if (editingId !== null) {
        const next = visits.map((visit) =>
          visit.id === editingId
            ? {
                ...visit,
                studentId,
                ...payload,
                status: payload.severity === "หนัก" ? "ส่งโรงพยาบาล" : visit.status
              }
            : visit
        );
        resetForm();
        await persistVisits(next, "บันทึกการแก้ไขข้อมูลผู้ป่วยเรียบร้อย");
        return;
      }

      const nextId = visits.length ? Math.max(...visits.map((visit) => visit.id)) + 1 : 1;
      const status = payload.severity === "หนัก" ? "ส่งโรงพยาบาล" : "รอคัดกรอง";

      const nextVisit: Visit = {
        id: nextId,
        studentId,
        ...payload,
        status,
        parentNotified: false,
        note: ""
      };

      const next = [nextVisit, ...visits];
      setSelectedId(nextId);

      if (payload.severity === "หนัก") {
        setAlerts((prev) => [`แจ้งเตือนเร่งด่วน: ${payload.studentName} ต้องส่งโรงพยาบาล`, ...prev]);
      }

      resetForm();
      await persistVisits(next, "เพิ่มผู้เข้ารับบริการเรียบร้อย");
    } catch (error) {
      setMessage(error instanceof Error ? `บันทึกผู้ป่วยไม่สำเร็จ: ${error.message}` : "บันทึกผู้ป่วยไม่สำเร็จ");
    }
  }

  function startEdit(visit: Visit) {
    setEditingId(visit.id);
    setForm({
      studentCode: visit.studentCode,
      studentName: visit.studentName,
      caregiver: visit.caregiver,
      symptom: visit.symptom,
      severity: visit.severity,
      time: visit.time
    });
    setMessage("");
  }

  async function removeVisit(id: number) {
    const next = visits.filter((visit) => visit.id !== id);
    if (selectedId === id) {
      setSelectedId(next[0]?.id ?? null);
    }
    if (editingId === id) {
      resetForm();
    }
    await persistVisits(next, "ลบข้อมูลผู้ป่วยเรียบร้อย");
  }

  async function updateStatus(id: number, status: string, note?: string) {
    const next = visits.map((visit) =>
      visit.id === id
        ? {
            ...visit,
            status,
            note: note ? `${visit.note ? `${visit.note} | ` : ""}${note}` : visit.note
          }
        : visit
    );

    await persistVisits(next, "อัปเดตสถานะเรียบร้อย");
  }

  async function notifyParent(id: number) {
    const next = visits.map((visit) => (visit.id === id ? { ...visit, parentNotified: true } : visit));
    const student = visits.find((visit) => visit.id === id);
    if (student) {
      setAlerts((prev) => [`แจ้งผู้ปกครองแล้ว: ${student.studentName}`, ...prev]);
    }

    await persistVisits(next, "บันทึกการแจ้งผู้ปกครองเรียบร้อย");
  }

  return (
    <>
      {alerts.length > 0 ? (
        <section className={styles.alertBox}>
          {alerts.slice(0, 2).map((alert) => (
            <p key={alert} className={styles.infoValue}>
              🚨 {alert}
            </p>
          ))}
        </section>
      ) : null}

      {message ? <section className={styles.statusBanner}>{message}</section> : null}

      <section className={styles.gridTwo}>
        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>{editingId ? "แก้ไขข้อมูลผู้ป่วย" : "เพิ่มผู้ป่วย"}</h3>
          </div>

          <form onSubmit={upsertVisit} className={styles.formGrid}>
            <div>
              <label className={styles.label} htmlFor="visit-student-code">
                รหัสนักศึกษา
              </label>
              <input
                id="visit-student-code"
                className={styles.input}
                value={form.studentCode}
                onChange={(event) => setForm((prev) => ({ ...prev, studentCode: event.target.value }))}
              />
            </div>

            <div>
              <label className={styles.label} htmlFor="visit-student-name">
                ชื่อ
              </label>
              <input
                id="visit-student-name"
                className={styles.input}
                value={form.studentName}
                onChange={(event) => setForm((prev) => ({ ...prev, studentName: event.target.value }))}
              />
            </div>

            <div>
              <label className={styles.label} htmlFor="visit-symptom">
                อาการ
              </label>
              <input
                id="visit-symptom"
                className={styles.input}
                value={form.symptom}
                onChange={(event) => setForm((prev) => ({ ...prev, symptom: event.target.value }))}
              />
            </div>

            <div>
              <label className={styles.label} htmlFor="visit-caregiver">
                ผู้ดูแล
              </label>
              <input
                id="visit-caregiver"
                className={styles.input}
                value={form.caregiver}
                onChange={(event) => setForm((prev) => ({ ...prev, caregiver: event.target.value }))}
                placeholder="เช่น admin หรือ พยาบาลวิลาสินี"
              />
            </div>

            <div>
              <label className={styles.label} htmlFor="visit-severity">
                ระดับอาการ
              </label>
              <select
                id="visit-severity"
                className={styles.select}
                value={form.severity}
                onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value as Severity }))}
              >
                <option value="ปกติ">ปกติ</option>
                <option value="ปานกลาง">ปานกลาง</option>
                <option value="หนัก">หนัก</option>
              </select>
            </div>

            <div>
              <label className={styles.label} htmlFor="visit-time">
                เวลา
              </label>
              <input
                id="visit-time"
                className={styles.input}
                placeholder="เช่น 10:30"
                value={form.time}
                onChange={(event) => setForm((prev) => ({ ...prev, time: event.target.value }))}
              />
            </div>

            <div className={styles.toolbar} style={{ alignSelf: "end" }}>
              <button className={`${styles.button} ${styles.btnPrimary}`} type="submit">
                ➕ {editingId ? "บันทึกการแก้ไข" : "เพิ่มผู้ป่วย"}
              </button>
              <button className={`${styles.button} ${styles.btnGhost}`} type="button" onClick={resetForm}>
                🔄 รีเฟรช
              </button>
            </div>
          </form>

          <div className={styles.toolbar}>
            <button className={`${styles.button} ${styles.btnSoft}`} type="button">
              🔍 ค้นหา
            </button>
            <button className={`${styles.button} ${styles.btnSoft}`} type="button" onClick={() => setShowHistory((prev) => !prev)}>
              🕘 ดูประวัติย้อนหลัง
            </button>
          </div>
        </article>

        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>รายละเอียดผู้ป่วย</h3>
          </div>

          <div>
            <label className={styles.label} htmlFor="visit-search">
              ค้นหา
            </label>
            <input
              id="visit-search"
              className={styles.input}
              placeholder="ค้นหาจากรหัส ชื่อ หรืออาการ"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {selectedVisit ? (
            <div className={styles.miniGrid}>
              <p className={styles.infoText}>รหัสนักศึกษา</p>
              <p className={styles.infoValue}>{selectedVisit.studentCode}</p>
              <p className={styles.infoText}>ชื่อ</p>
              <p className={styles.infoValue}>{selectedVisit.studentName}</p>
              <p className={styles.infoText}>ผู้ดูแล</p>
              <p className={styles.infoValue}>{selectedVisit.caregiver}</p>
              <p className={styles.infoText}>สถานะ</p>
              <p className={styles.infoValue}>{selectedVisit.status}</p>

              <div className={styles.toolbar}>
                <button className={`${styles.button} ${styles.btnSuccess}`} onClick={() => updateStatus(selectedVisit.id, "จ่ายยาแล้ว")} type="button">
                  💊 จ่ายยา
                </button>
                <button
                  className={`${styles.button} ${styles.btnDanger}`}
                  onClick={() => updateStatus(selectedVisit.id, "ส่งโรงพยาบาล", "ส่งต่อโรงพยาบาล")}
                  type="button"
                >
                  🚑 ส่งโรงพยาบาล
                </button>
                <button className={`${styles.button} ${styles.btnWarning}`} onClick={() => startEdit(selectedVisit)} type="button">
                  ✏️ แก้ไขข้อมูล
                </button>
                <button className={`${styles.button} ${styles.btnSoft}`} onClick={() => setSelectedId(selectedVisit.id)} type="button">
                  📄 ดูรายละเอียด
                </button>
                <button className={`${styles.button} ${styles.btnDanger}`} onClick={() => removeVisit(selectedVisit.id)} type="button">
                  ❌ ลบข้อมูล
                </button>
              </div>

              {selectedVisit.severity === "หนัก" ? (
                <div className={styles.alertBox}>
                  <p className={styles.infoValue}>ปุ่มพิเศษสำหรับอาการหนัก</p>
                  <div className={styles.toolbar}>
                    <button
                      className={`${styles.button} ${styles.btnDanger}`}
                      type="button"
                      onClick={() => updateStatus(selectedVisit.id, "ส่งโรงพยาบาล", "ดำเนินการส่งต่อ")}
                    >
                      🚑 ส่งต่อโรงพยาบาล
                    </button>
                    <button className={`${styles.button} ${styles.btnWarning}`} type="button" onClick={() => notifyParent(selectedVisit.id)}>
                      📞 แจ้งผู้ปกครอง
                    </button>
                    <button
                      className={`${styles.button} ${styles.btnGhost}`}
                      type="button"
                      onClick={() => updateStatus(selectedVisit.id, selectedVisit.status, "บันทึกเหตุการณ์ฉุกเฉิน")}
                    >
                      📝 บันทึกเหตุการณ์
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className={styles.infoText}>ยังไม่ได้เลือกรายการผู้ป่วย</p>
          )}
        </article>
      </section>

      <section className={styles.panel}>
        <div>
          <h3 className={styles.sectionTitle}>รายการผู้เข้ารับบริการ ({filteredVisits.length} รายการ)</h3>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>เวลา</th>
                <th>รหัสนักศึกษา</th>
                <th>ชื่อ</th>
                <th>ผู้ดูแล</th>
                <th>อาการ</th>
                <th>ระดับอาการ</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>กำลังโหลดข้อมูล...</td>
                </tr>
              ) : filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan={7}>ยังไม่มีรายการผู้เข้ารับบริการ</td>
                </tr>
              ) : (
                filteredVisits.map((visit) => (
                  <tr
                    key={visit.id}
                    className={visit.severity === "หนัก" ? styles.rowSevere : undefined}
                    onClick={() => setSelectedId(visit.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{visit.time}</td>
                    <td>{visit.studentCode}</td>
                    <td>{visit.studentName}</td>
                    <td>{visit.caregiver}</td>
                    <td>{visit.symptom}</td>
                    <td>
                      <span className={getBadgeClass(visit.severity)}>{visit.severity}</span>
                    </td>
                    <td>
                      {visit.status}
                      {visit.parentNotified ? " (แจ้งผู้ปกครองแล้ว)" : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
