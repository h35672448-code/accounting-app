"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../nurse.module.css";
import { fetchEntity, saveEntity, StoreRow } from "../lib/storeApi";

type QueueStatus = "รอเรียก" | "กำลังตรวจ" | "ตรวจแล้ว" | "ส่งโรงพยาบาล" | "ยกเลิก" | "รอคัดกรอง" | "จ่ายยาแล้ว";

type QueueItem = {
  id: number;
  queueNo: number;
  name: string;
  symptom: string;
  time: string;
  status: QueueStatus;
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function statusBadgeClass(status: QueueStatus): string {
  if (status === "ส่งโรงพยาบาล") return `${styles.badge} ${styles.badgeSevere}`;
  if (status === "กำลังตรวจ") return `${styles.badge} ${styles.badgeMedium}`;
  return `${styles.badge} ${styles.badgeNormal}`;
}

function formatTime(value: unknown) {
  const input = toText(value);
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function studentName(row: StoreRow) {
  const full = `${toText(row.first_name)} ${toText(row.last_name)}`.trim();
  return full || toText(row.student_name);
}

function mapQueue(visits: StoreRow[], students: StoreRow[]): QueueItem[] {
  const studentMap = new Map<number, StoreRow>();
  students.forEach((row) => studentMap.set(toNumber(row.id), row));

  return visits
    .map((row, index) => {
      const student = studentMap.get(toNumber(row.student_id));
      return {
        id: toNumber(row.id, index + 1),
        queueNo: index + 1,
        name: toText(student ? studentName(student) : row.student_name) || "ไม่ระบุชื่อ",
        symptom: toText(row.symptom) || "-",
        time: formatTime(row.visit_at) || "-",
        status: (toText(row.triage_status) || "รอคัดกรอง") as QueueStatus
      };
    })
    .sort((a, b) => a.queueNo - b.queueNo);
}

export default function QueuePage() {
  const [visitRows, setVisitRows] = useState<StoreRow[]>([]);
  const [studentRows, setStudentRows] = useState<StoreRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const queue = useMemo(() => mapQueue(visitRows, studentRows), [visitRows, studentRows]);
  const selected = useMemo(() => queue.find((item) => item.id === selectedId) ?? null, [queue, selectedId]);

  useEffect(() => {
    void loadQueue();
  }, []);

  useEffect(() => {
    if (queue.length === 0) {
      setSelectedId(null);
      return;
    }

    const exists = queue.some((item) => item.id === selectedId);
    if (!exists) {
      setSelectedId(queue[0].id);
    }
  }, [queue, selectedId]);

  async function loadQueue() {
    try {
      setLoading(true);
      const [visits, students] = await Promise.all([fetchEntity("visits"), fetchEntity("students")]);
      setVisitRows(visits);
      setStudentRows(students);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? `โหลดคิวไม่สำเร็จ: ${error.message}` : "โหลดคิวไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function patchVisitStatus(id: number, status: QueueStatus) {
    const next = visitRows.map((row) => {
      if (toNumber(row.id) !== id) return row;
      return {
        ...row,
        triage_status: status,
        severity: status === "ส่งโรงพยาบาล" ? "หนัก" : row.severity,
        updated_at: new Date().toISOString()
      };
    });

    setVisitRows(next);
    try {
      await saveEntity("visits", next);
      setMessage(`อัปเดตสถานะเป็น "${status}" แล้ว`);
    } catch (error) {
      setMessage(error instanceof Error ? `อัปเดตสถานะไม่สำเร็จ: ${error.message}` : "อัปเดตสถานะไม่สำเร็จ");
    }
  }

  function updateStatus(id: number, status: QueueStatus) {
    void patchVisitStatus(id, status);
  }

  function cancelQueue(id: number) {
    void patchVisitStatus(id, "ยกเลิก");
  }

  return (
    <>
      <section className={styles.hero}>
        <h2 className={styles.heroTitle}>หน้าแสดงคิวผู้ป่วย</h2>
        <p className={styles.heroText}>ดูคิวแบบตารางและจัดการสถานะได้ทันที: เรียกคิว, ตรวจแล้ว, ส่งโรงพยาบาล, ยกเลิก</p>
      </section>

      {message ? <section className={styles.statusBanner}>{message}</section> : null}

      <section className={styles.gridTwo}>
        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>ตารางคิว</h3>
            <p className={styles.sectionSub}>คลิกแถวเพื่อเลือกคิวที่ต้องการจัดการ</p>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>คิว</th>
                  <th>ชื่อ</th>
                  <th>อาการ</th>
                  <th>เวลา</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5}>กำลังโหลดคิว...</td>
                  </tr>
                ) : queue.length === 0 ? (
                  <tr>
                    <td colSpan={5}>ยังไม่มีคิวผู้ป่วย</td>
                  </tr>
                ) : (
                  queue.map((item) => (
                    <tr key={item.id} onClick={() => setSelectedId(item.id)} style={{ cursor: "pointer" }}>
                      <td>{item.queueNo}</td>
                      <td>{item.name}</td>
                      <td>{item.symptom}</td>
                      <td>{item.time}</td>
                      <td>
                        <span className={statusBadgeClass(item.status)}>{item.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>ปุ่มจัดการคิว (Admin)</h3>
            <p className={styles.sectionSub}>เลือกคิวจากตารางก่อนเพื่อกดคำสั่ง</p>
          </div>

          {selected ? (
            <>
              <div className={styles.miniGrid}>
                <p className={styles.infoText}>คิวที่เลือก</p>
                <p className={styles.infoValue}>#{selected.queueNo}</p>
                <p className={styles.infoText}>ชื่อ</p>
                <p className={styles.infoValue}>{selected.name}</p>
                <p className={styles.infoText}>อาการ</p>
                <p className={styles.infoValue}>{selected.symptom}</p>
                <p className={styles.infoText}>สถานะ</p>
                <p className={styles.infoValue}>{selected.status}</p>
              </div>

              <div className={styles.toolbar}>
                <button className={`${styles.button} ${styles.btnPrimary}`} onClick={() => updateStatus(selected.id, "กำลังตรวจ")}>
                  ✔ เรียกคิว
                </button>
                <button className={`${styles.button} ${styles.btnSuccess}`} onClick={() => updateStatus(selected.id, "ตรวจแล้ว")}>
                  🩺 ตรวจแล้ว
                </button>
                <button className={`${styles.button} ${styles.btnDanger}`} onClick={() => updateStatus(selected.id, "ส่งโรงพยาบาล")}>
                  🚑 ส่งโรงพยาบาล
                </button>
                <button className={`${styles.button} ${styles.btnGhost}`} onClick={() => cancelQueue(selected.id)}>
                  ❌ ยกเลิก
                </button>
              </div>
            </>
          ) : (
            <p className={styles.infoText}>ยังไม่ได้เลือกคิว</p>
          )}
        </article>
      </section>
    </>
  );
}
