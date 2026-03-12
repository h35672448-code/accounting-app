"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../nurse.module.css";
import { fetchEntity, saveEntity, StoreRow } from "../lib/storeApi";

type SymptomReport = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  symptom: string;
  createdAt: string;
};

const EMPTY_FORM = {
  studentId: "",
  firstName: "",
  lastName: "",
  department: "",
  classLevel: "",
  symptom: "",
  detail: ""
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function buildReports(visits: StoreRow[], students: StoreRow[]): SymptomReport[] {
  const studentsById = new Map<number, StoreRow>();
  students.forEach((row) => studentsById.set(toNumber(row.id), row));

  return visits
    .map((row, index) => {
      const student = studentsById.get(toNumber(row.student_id));
      return {
        id: toNumber(row.id, index + 1),
        studentId: toText(student?.student_code || row.student_code),
        firstName: toText(student?.first_name),
        lastName: toText(student?.last_name),
        symptom: toText(row.symptom),
        createdAt: new Date(toText(row.visit_at)).toLocaleString("th-TH")
      };
    })
    .sort((a, b) => b.id - a.id);
}

export default function SymptomPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [studentsRows, setStudentsRows] = useState<StoreRow[]>([]);
  const [visitRows, setVisitRows] = useState<StoreRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const reports = useMemo(() => buildReports(visitRows, studentsRows).slice(0, 8), [visitRows, studentsRows]);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [students, visits] = await Promise.all([fetchEntity("students"), fetchEntity("visits")]);
      setStudentsRows(students);
      setVisitRows(visits);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? `โหลดข้อมูลไม่สำเร็จ: ${error.message}` : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setMessage("");
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      studentId: form.studentId.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      department: form.department.trim(),
      classLevel: form.classLevel.trim(),
      symptom: form.symptom.trim(),
      detail: form.detail.trim()
    };

    if (Object.values(payload).some((value) => value === "")) {
      setMessage("กรอกข้อมูลให้ครบทุกช่องก่อนส่งข้อมูล");
      return;
    }

    try {
      const now = new Date().toISOString();
      let nextStudents = [...studentsRows];
      let student = nextStudents.find((row) => toText(row.student_code) === payload.studentId);

      if (!student) {
        const nextStudentId = nextStudents.length ? Math.max(...nextStudents.map((row) => toNumber(row.id))) + 1 : 1;
        student = {
          id: nextStudentId,
          student_code: payload.studentId,
          first_name: payload.firstName,
          last_name: payload.lastName,
          department: payload.department,
          class_room: payload.classLevel,
          allergy_note: "",
          chronic_note: "",
          created_at: now,
          updated_at: now
        };
        nextStudents = [...nextStudents, student];
        await saveEntity("students", nextStudents);
      }

      const nextVisitId = visitRows.length ? Math.max(...visitRows.map((row) => toNumber(row.id))) + 1 : 1;
      const nextVisit: StoreRow = {
        id: nextVisitId,
        student_id: toNumber(student.id),
        symptom: payload.symptom,
        severity: "ปกติ",
        triage_status: "รอคัดกรอง",
        nurse_id: "",
        visit_at: now,
        parent_notified: 0,
        event_note: payload.detail,
        created_at: now,
        updated_at: now
      };

      const mergedVisits = [nextVisit, ...visitRows];
      await saveEntity("visits", mergedVisits);

      setStudentsRows(nextStudents);
      setVisitRows(mergedVisits);
      setForm(EMPTY_FORM);
      setMessage("ส่งข้อมูลเรียบร้อยแล้ว ระบบเตรียมเข้าคิวให้โดยอัตโนมัติ");
    } catch (error) {
      setMessage(error instanceof Error ? `ส่งข้อมูลไม่สำเร็จ: ${error.message}` : "ส่งข้อมูลไม่สำเร็จ");
    }
  }

  return (
    <>
      <section className={styles.hero}>
        <h2 className={styles.heroTitle}>หน้าแจ้งอาการ</h2>
      </section>

      {message ? <section className={styles.statusBanner}>{message}</section> : null}

      <section className={styles.gridTwo}>
        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>ฟอร์มแจ้งอาการ</h3>
          </div>

          <form onSubmit={submitReport} className={styles.formGrid}>
            <div>
              <label className={styles.label} htmlFor="student-id">
                รหัสนักศึกษา
              </label>
              <input
                id="student-id"
                className={styles.input}
                value={form.studentId}
                onChange={(event) => setForm((prev) => ({ ...prev, studentId: event.target.value }))}
              />
            </div>
            <div>
              <label className={styles.label} htmlFor="department">
                แผนก
              </label>
              <input
                id="department"
                className={styles.input}
                value={form.department}
                onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}
              />
            </div>
            <div>
              <label className={styles.label} htmlFor="first-name">
                ชื่อ
              </label>
              <input
                id="first-name"
                className={styles.input}
                value={form.firstName}
                onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
              />
            </div>
            <div>
              <label className={styles.label} htmlFor="last-name">
                นามสกุล
              </label>
              <input
                id="last-name"
                className={styles.input}
                value={form.lastName}
                onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
              />
            </div>
            <div>
              <label className={styles.label} htmlFor="class-level">
                ชั้น
              </label>
              <input
                id="class-level"
                className={styles.input}
                placeholder="เช่น ปวช.2/1"
                value={form.classLevel}
                onChange={(event) => setForm((prev) => ({ ...prev, classLevel: event.target.value }))}
              />
            </div>
            <div>
              <label className={styles.label} htmlFor="symptom">
                อาการ
              </label>
              <input
                id="symptom"
                className={styles.input}
                value={form.symptom}
                onChange={(event) => setForm((prev) => ({ ...prev, symptom: event.target.value }))}
              />
            </div>
            <div className={styles.fullWidth}>
              <label className={styles.label} htmlFor="detail">
                รายละเอียด
              </label>
              <textarea
                id="detail"
                className={styles.textarea}
                value={form.detail}
                onChange={(event) => setForm((prev) => ({ ...prev, detail: event.target.value }))}
              />
            </div>

            <div className={styles.toolbar}>
              <button type="submit" className={`${styles.button} ${styles.btnPrimary}`}>
                📤 ส่งข้อมูล
              </button>
              <button type="button" onClick={resetForm} className={`${styles.button} ${styles.btnGhost}`}>
                ❌ ล้างข้อมูล
              </button>
            </div>
          </form>
        </article>

        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>รายการที่ส่งล่าสุด</h3>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>รหัสนักศึกษา</th>
                  <th>ชื่อ</th>
                  <th>อาการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4}>กำลังโหลดข้อมูล...</td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={4}>ยังไม่มีรายการแจ้งอาการ</td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id}>
                      <td>{report.createdAt}</td>
                      <td>{report.studentId}</td>
                      <td>
                        {report.firstName} {report.lastName}
                      </td>
                      <td>{report.symptom}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </>
  );
}
