"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../nurse.module.css";
import { fetchEntity, saveEntity, StoreRow } from "../lib/storeApi";

type TreatmentStatus = "รักษาแล้ว" | "พัก" | "ส่งโรงพยาบาล";

type Treatment = {
  id: number;
  queueNo: string;
  studentId: string;
  name: string;
  symptom: string;
  treatment: string;
  medicine: string;
  medicineQty: string;
  nurse: string;
  status: TreatmentStatus;
  date: string;
};

const USER_STORAGE_KEY = "nurse_current_user";

const EMPTY_FORM: Omit<Treatment, "id" | "date"> = {
  queueNo: "",
  studentId: "",
  name: "",
  symptom: "",
  treatment: "",
  medicine: "",
  medicineQty: "",
  nurse: "",
  status: "รักษาแล้ว"
};

const INITIAL_DATA: Treatment[] = [
  {
    id: 1,
    queueNo: "12",
    studentId: "66012001",
    name: "กิตติพงษ์ สายชล",
    symptom: "ปวดศีรษะ",
    treatment: "ให้พักและวัดความดัน",
    medicine: "Paracetamol",
    medicineQty: "2 เม็ด",
    nurse: "พยาบาลวิลาสินี",
    status: "รักษาแล้ว",
    date: "11/03/2026 10:20"
  }
];

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function parsePayload(value: unknown) {
  try {
    const parsed = JSON.parse(toText(value)) as {
      studentId?: string;
      name?: string;
      symptom?: string;
      treatment?: string;
      medicineQty?: string;
      nurse?: string;
      status?: TreatmentStatus;
    };

    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function treatmentToRow(item: Treatment): StoreRow {
  const qty = Number(item.medicineQty.replace(/[^0-9.-]/g, "")) || 0;
  return {
    id: item.id,
    visit_id: item.queueNo,
    medicine_id: "",
    qty,
    dosage: item.medicine,
    instruction: JSON.stringify({
      studentId: item.studentId,
      name: item.name,
      symptom: item.symptom,
      treatment: item.treatment,
      medicineQty: item.medicineQty,
      nurse: item.nurse,
      status: item.status
    }),
    created_at: new Date().toISOString()
  };
}

function rowToTreatment(row: StoreRow, index: number): Treatment {
  const payload = parsePayload(row.instruction);
  const nurse = toText(payload?.nurse) || toText(row.caregiver || row.nurse_name) || "ไม่ระบุ";
  return {
    id: toNumber(row.id, index + 1),
    queueNo: toText(row.visit_id),
    studentId: toText(payload?.studentId),
    name: toText(payload?.name),
    symptom: toText(payload?.symptom),
    treatment: toText(payload?.treatment),
    medicine: toText(row.dosage),
    medicineQty: toText(payload?.medicineQty) || `${toNumber(row.qty, 0)}`,
    nurse,
    status: (toText(payload?.status) || "รักษาแล้ว") as TreatmentStatus,
    date: new Date(toText(row.created_at)).toLocaleString("th-TH")
  };
}

export default function TreatmentPage() {
  const [records, setRecords] = useState<Treatment[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;

    return records.filter((item) => {
      const text = `${item.queueNo} ${item.studentId} ${item.name} ${item.symptom} ${item.treatment} ${item.status}`.toLowerCase();
      return text.includes(q);
    });
  }, [records, search]);

  useEffect(() => {
    void loadTreatments();
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(USER_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { username?: unknown };
      const username = toText(parsed.username);
      if (!username) return;
      setForm((prev) => (prev.nurse ? prev : { ...prev, nurse: username }));
    } catch {
      // Ignore malformed localStorage payload.
    }
  }, []);

  async function loadTreatments() {
    try {
      setLoading(true);
      const rows = await fetchEntity("visit_medicines");
      if (rows.length === 0) {
        setRecords(INITIAL_DATA);
        await saveEntity(
          "visit_medicines",
          INITIAL_DATA.map(treatmentToRow)
        );
      } else {
        const mapped = rows.map((row, index) => rowToTreatment(row, index));
        mapped.sort((a, b) => b.id - a.id);
        setRecords(mapped);
      }
      setMessage("");
    } catch (error) {
      setRecords(INITIAL_DATA);
      setMessage(error instanceof Error ? `โหลดบันทึกการรักษาไม่สำเร็จ: ${error.message}` : "โหลดบันทึกการรักษาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function persistRecords(next: Treatment[], successMessage: string) {
    setRecords(next);
    try {
      await saveEntity(
        "visit_medicines",
        next.map(treatmentToRow)
      );
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? `บันทึกข้อมูลไม่สำเร็จ: ${error.message}` : "บันทึกข้อมูลไม่สำเร็จ");
    }
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      queueNo: form.queueNo.trim(),
      studentId: form.studentId.trim(),
      name: form.name.trim(),
      symptom: form.symptom.trim(),
      treatment: form.treatment.trim(),
      medicine: form.medicine.trim(),
      medicineQty: form.medicineQty.trim(),
      nurse: form.nurse.trim(),
      status: form.status
    };

    if (Object.values(payload).some((value) => value === "")) {
      setMessage("กรอกข้อมูลให้ครบทุกช่อง");
      return;
    }

    if (editingId !== null) {
      const next = records.map((item) =>
        item.id === editingId
          ? {
              ...item,
              ...payload,
              date: new Date().toLocaleString("th-TH")
            }
          : item
      );
      resetForm();
      await persistRecords(next, "บันทึกการแก้ไขเรียบร้อย");
      return;
    }

    const nextId = records.length ? Math.max(...records.map((item) => item.id)) + 1 : 1;
    const next = [{ id: nextId, ...payload, date: new Date().toLocaleString("th-TH") }, ...records];
    resetForm();
    await persistRecords(next, "บันทึกการรักษาเรียบร้อย");
  }

  function editRecord(item: Treatment) {
    setEditingId(item.id);
    setForm({
      queueNo: item.queueNo,
      studentId: item.studentId,
      name: item.name,
      symptom: item.symptom,
      treatment: item.treatment,
      medicine: item.medicine,
      medicineQty: item.medicineQty,
      nurse: item.nurse,
      status: item.status
    });
    setMessage("");
  }

  function statusClass(status: TreatmentStatus) {
    if (status === "ส่งโรงพยาบาล") return `${styles.badge} ${styles.badgeSevere}`;
    if (status === "พัก") return `${styles.badge} ${styles.badgeMedium}`;
    return `${styles.badge} ${styles.badgeNormal}`;
  }

  return (
    <>
      {message ? <section className={styles.statusBanner}>{message}</section> : null}

      <section className={styles.gridTwo}>
        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>{editingId ? "แก้ไขบันทึกการรักษา" : "บันทึกการรักษาใหม่"}</h3>
          </div>

          <form onSubmit={submitForm} className={styles.formGrid}>
            <div>
              <label className={styles.label}>เลขคิว</label>
              <input className={styles.input} value={form.queueNo} onChange={(event) => setForm((prev) => ({ ...prev, queueNo: event.target.value }))} />
            </div>
            <div>
              <label className={styles.label}>รหัสนักศึกษา</label>
              <input className={styles.input} value={form.studentId} onChange={(event) => setForm((prev) => ({ ...prev, studentId: event.target.value }))} />
            </div>
            <div>
              <label className={styles.label}>ชื่อ</label>
              <input className={styles.input} value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div>
              <label className={styles.label}>อาการ</label>
              <input className={styles.input} value={form.symptom} onChange={(event) => setForm((prev) => ({ ...prev, symptom: event.target.value }))} />
            </div>
            <div className={styles.fullWidth}>
              <label className={styles.label}>การรักษา</label>
              <textarea className={styles.textarea} value={form.treatment} onChange={(event) => setForm((prev) => ({ ...prev, treatment: event.target.value }))} />
            </div>
            <div>
              <label className={styles.label}>ยาที่จ่าย</label>
              <input className={styles.input} value={form.medicine} onChange={(event) => setForm((prev) => ({ ...prev, medicine: event.target.value }))} />
            </div>
            <div>
              <label className={styles.label}>จำนวนยา</label>
              <input className={styles.input} value={form.medicineQty} onChange={(event) => setForm((prev) => ({ ...prev, medicineQty: event.target.value }))} />
            </div>
            <div>
              <label className={styles.label}>ผู้รักษา</label>
              <input className={styles.input} value={form.nurse} onChange={(event) => setForm((prev) => ({ ...prev, nurse: event.target.value }))} />
            </div>
            <div>
              <label className={styles.label}>สถานะ</label>
              <select
                className={styles.select}
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as TreatmentStatus }))}
              >
                <option value="รักษาแล้ว">รักษาแล้ว</option>
                <option value="พัก">พัก</option>
                <option value="ส่งโรงพยาบาล">ส่งโรงพยาบาล</option>
              </select>
            </div>

            <div className={styles.toolbar}>
              <button className={`${styles.button} ${styles.btnPrimary}`} type="submit">
                💾 บันทึก
              </button>
              <button className={`${styles.button} ${styles.btnWarning}`} type="button" onClick={resetForm}>
                ✏ แก้ไขรายการใหม่
              </button>
            </div>
          </form>
        </article>

        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>ค้นหาบันทึก</h3>
          </div>
          <input className={styles.input} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาบันทึก" />
        </article>
      </section>

      <section className={styles.panel}>
        <div>
          <h3 className={styles.sectionTitle}>ประวัติการรักษา ({filtered.length} รายการ)</h3>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>เวลา</th>
                <th>คิว</th>
                <th>รหัสนักศึกษา</th>
                <th>ชื่อ</th>
                <th>อาการ</th>
                <th>การรักษา</th>
                <th>ยาที่จ่าย</th>
                <th>ผู้รักษา</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10}>กำลังโหลดข้อมูล...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10}>ยังไม่มีบันทึกการรักษา</td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td>{item.date}</td>
                    <td>{item.queueNo}</td>
                    <td>{item.studentId}</td>
                    <td>{item.name}</td>
                    <td>{item.symptom}</td>
                    <td>{item.treatment}</td>
                    <td>
                      {item.medicine} ({item.medicineQty})
                    </td>
                    <td>{item.nurse}</td>
                    <td>
                      <span className={statusClass(item.status)}>{item.status}</span>
                    </td>
                    <td>
                      <button className={`${styles.button} ${styles.btnWarning}`} onClick={() => editRecord(item)}>
                        ✏ แก้ไข
                      </button>
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
