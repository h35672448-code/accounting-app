"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../nurse.module.css";
import { fetchEntity, saveEntity, StoreRow } from "../lib/storeApi";

type Medicine = {
  id: number;
  image: string;
  code: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  expire: string;
  note: string;
};

type MedicineForm = Omit<Medicine, "id">;

const INITIAL_MEDICINES: Medicine[] = [
  {
    id: 1,
    image: "https://images.unsplash.com/photo-1580281657521-2b3f4f20f4f4?w=200&auto=format&fit=crop",
    code: "MED-001",
    name: "Paracetamol",
    category: "ยาแก้ปวด",
    quantity: 45,
    unit: "เม็ด",
    expire: "2027-03-30",
    note: "จ่ายได้ครั้งละ 1-2 เม็ด"
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1584362917165-526a968579e8?w=200&auto=format&fit=crop",
    code: "MED-011",
    name: "ORS",
    category: "เกลือแร่",
    quantity: 8,
    unit: "ซอง",
    expire: "2026-10-12",
    note: "ยาใกล้หมด"
  }
];

const EMPTY_FORM: MedicineForm = {
  image: "",
  code: "",
  name: "",
  category: "",
  quantity: 0,
  unit: "",
  expire: "",
  note: ""
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function rowToMedicine(row: StoreRow, index: number): Medicine {
  return {
    id: toNumber(row.id, index + 1),
    image:
      toText(row.image_url || row.image) ||
      "https://images.unsplash.com/photo-1580281657521-2b3f4f20f4f4?w=200&auto=format&fit=crop",
    code: toText(row.medicine_code || row.code),
    name: toText(row.name),
    category: toText(row.category),
    quantity: toNumber(row.stock_qty ?? row.quantity, 0),
    unit: toText(row.unit) || "หน่วย",
    expire: toText(row.expire_date || row.expire),
    note: toText(row.note)
  };
}

function medicineToRow(item: Medicine): StoreRow {
  const now = new Date().toISOString();
  return {
    id: item.id,
    medicine_code: item.code,
    name: item.name,
    image_url: item.image,
    stock_qty: item.quantity,
    reorder_level: 10,
    expire_date: item.expire,
    category: item.category,
    unit: item.unit,
    note: item.note,
    updated_at: now,
    created_at: now
  };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [form, setForm] = useState<MedicineForm>(EMPTY_FORM);
  const [imageFileName, setImageFileName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return medicines;

    return medicines.filter((medicine) => {
      const data = `${medicine.code} ${medicine.name} ${medicine.category} ${medicine.note}`.toLowerCase();
      return data.includes(keyword);
    });
  }, [medicines, search]);

  const lowStockCount = useMemo(() => medicines.filter((item) => item.quantity <= 10).length, [medicines]);

  useEffect(() => {
    void loadMedicines();
  }, []);

  async function loadMedicines() {
    try {
      setLoading(true);
      const rows = await fetchEntity("medicines");
      if (rows.length === 0) {
        setMedicines(INITIAL_MEDICINES);
        await saveEntity(
          "medicines",
          INITIAL_MEDICINES.map(medicineToRow)
        );
      } else {
        setMedicines(rows.map((row, index) => rowToMedicine(row, index)));
      }
      setMessage("");
    } catch (error) {
      setMedicines(INITIAL_MEDICINES);
      setMessage(error instanceof Error ? `โหลดข้อมูลไม่สำเร็จ: ${error.message}` : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setImageFileName("");
    setEditingId(null);
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }
    if (file.size > 1_500_000) {
      setMessage("รูปใหญ่เกิน 1.5MB กรุณาลดขนาดรูปก่อนอัปโหลด");
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((prev) => ({ ...prev, image: dataUrl }));
      setImageFileName(file.name);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ");
    }
  }

  async function persistMedicines(next: Medicine[], successMessage: string) {
    setMedicines(next);
    try {
      await saveEntity(
        "medicines",
        next.map(medicineToRow)
      );
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? `บันทึกข้อมูลไม่สำเร็จ: ${error.message}` : "บันทึกข้อมูลไม่สำเร็จ");
    }
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: MedicineForm = {
      image: form.image.trim(),
      code: form.code.trim(),
      name: form.name.trim(),
      category: form.category.trim(),
      quantity: Number(form.quantity),
      unit: form.unit.trim(),
      expire: form.expire.trim(),
      note: form.note.trim()
    };

    if (!payload.code || !payload.name) {
      setMessage("กรอกข้อมูลสำคัญให้ครบ: รหัสยา และชื่อยา");
      return;
    }

    if (!payload.image) {
      payload.image = "https://images.unsplash.com/photo-1580281657521-2b3f4f20f4f4?w=200&auto=format&fit=crop";
    }

    if (!payload.unit) payload.unit = "หน่วย";

    if (editingId !== null) {
      const next = medicines.map((item) => (item.id === editingId ? { ...item, ...payload } : item));
      resetForm();
      await persistMedicines(next, "บันทึกแก้ไขยาเรียบร้อย");
      return;
    }

    const nextId = medicines.length ? Math.max(...medicines.map((item) => item.id)) + 1 : 1;
    const next = [{ id: nextId, ...payload }, ...medicines];
    resetForm();
    await persistMedicines(next, "เพิ่มยาเรียบร้อย");
  }

  function startEdit(item: Medicine) {
    setEditingId(item.id);
    setForm({ ...item });
    setImageFileName("");
    setMessage("");
  }

  async function deleteMedicine(id: number) {
    const next = medicines.filter((item) => item.id !== id);
    if (editingId === id) resetForm();
    await persistMedicines(next, "ลบรายการยาเรียบร้อย");
  }

  async function addStock(id: number) {
    const next = medicines.map((item) => (item.id === id ? { ...item, quantity: item.quantity + 10 } : item));
    await persistMedicines(next, "เพิ่มสต็อกเรียบร้อย");
  }

  return (
    <>
      {lowStockCount > 0 ? (
        <section className={styles.alertBox}>⚠️ แจ้งเตือนยาใกล้หมด {lowStockCount} รายการ (ต่ำกว่า 10 หน่วย)</section>
      ) : null}

      {message ? <section className={styles.statusBanner}>{message}</section> : null}

      <section className={styles.gridTwo}>
        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>{editingId ? "แก้ไขรายการยา" : "เพิ่มยา"}</h3>
          </div>

          <form onSubmit={submitForm} className={styles.formGrid}>
            <div>
              <label className={styles.label} htmlFor="image">
                รูปยา (อัปโหลด)
              </label>
              <input id="image" type="file" accept="image/*" className={styles.input} onChange={(event) => void handleImageUpload(event)} />
              {imageFileName ? <p className={styles.infoText}>ไฟล์: {imageFileName}</p> : null}
              {form.image ? (
                <img
                  src={form.image}
                  alt="ตัวอย่างรูปยา"
                  className={styles.tableAvatar}
                  style={{ width: 64, height: 64, marginTop: 6 }}
                />
              ) : null}
            </div>
            <div>
              <label className={styles.label} htmlFor="code">
                รหัสยา
              </label>
              <input id="code" className={styles.input} value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
            </div>
            <div>
              <label className={styles.label} htmlFor="name">
                ชื่อยา
              </label>
              <input id="name" className={styles.input} value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div>
              <label className={styles.label} htmlFor="category">
                ประเภทยา
              </label>
              <input
                id="category"
                className={styles.input}
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              />
            </div>
            <div>
              <label className={styles.label} htmlFor="quantity">
                จำนวน
              </label>
              <input
                id="quantity"
                type="number"
                min={0}
                className={styles.input}
                value={form.quantity}
                onChange={(event) => setForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))}
              />
            </div>
            <div>
              <label className={styles.label} htmlFor="unit">
                หน่วย
              </label>
              <input id="unit" className={styles.input} value={form.unit} onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))} />
            </div>
            <div>
              <label className={styles.label} htmlFor="expire">
                วันหมดอายุ
              </label>
              <input
                id="expire"
                type="date"
                className={styles.input}
                value={form.expire}
                onChange={(event) => setForm((prev) => ({ ...prev, expire: event.target.value }))}
              />
            </div>
            <div className={styles.fullWidth}>
              <label className={styles.label} htmlFor="note">
                หมายเหตุ
              </label>
              <textarea id="note" className={styles.textarea} value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} />
            </div>

            <div className={styles.toolbar}>
              <button className={`${styles.button} ${styles.btnPrimary}`} type="submit">
                ➕ {editingId ? "บันทึกแก้ไข" : "เพิ่มยา"}
              </button>
              <button className={`${styles.button} ${styles.btnGhost}`} type="button" onClick={resetForm}>
                🔄 รีเฟรช
              </button>
            </div>
          </form>
        </article>

        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>ค้นหาและสถานะ</h3>
          </div>
          <input className={styles.input} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหายา" />

          <div className={styles.miniGrid}>
            <p className={styles.infoText}>จำนวนรายการยา</p>
            <p className={styles.infoValue}>{medicines.length} รายการ</p>
            <p className={styles.infoText}>ยาใกล้หมด</p>
            <p className={styles.infoValue}>{lowStockCount} รายการ</p>
          </div>
        </article>
      </section>

      <section className={styles.panel}>
        <div>
          <h3 className={styles.sectionTitle}>ตารางคลังยา ({filtered.length} รายการ)</h3>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>รูป</th>
                <th>รหัสยา</th>
                <th>ชื่อยา</th>
                <th>ประเภท</th>
                <th>จำนวน</th>
                <th>หน่วย</th>
                <th>วันหมดอายุ</th>
                <th>หมายเหตุ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9}>กำลังโหลดข้อมูล...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9}>ยังไม่มีข้อมูลยา</td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <img src={item.image} alt={item.name} width={48} height={48} className={styles.tableAvatar} />
                    </td>
                    <td>{item.code}</td>
                    <td>{item.name}</td>
                    <td>{item.category || "-"}</td>
                    <td>
                      <span className={item.quantity <= 10 ? `${styles.badge} ${styles.badgeSevere}` : `${styles.badge} ${styles.badgeNormal}`}>
                        {item.quantity}
                      </span>
                    </td>
                    <td>{item.unit}</td>
                    <td>{item.expire}</td>
                    <td>{item.note}</td>
                    <td>
                      <div className={styles.inlineActions}>
                        <button className={`${styles.button} ${styles.btnSuccess}`} onClick={() => addStock(item.id)}>
                          📦 เพิ่มสต็อก
                        </button>
                        <button className={`${styles.button} ${styles.btnWarning}`} onClick={() => startEdit(item)}>
                          ✏ แก้ไข
                        </button>
                        <button className={`${styles.button} ${styles.btnDanger}`} onClick={() => deleteMedicine(item.id)}>
                          🗑 ลบ
                        </button>
                      </div>
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
