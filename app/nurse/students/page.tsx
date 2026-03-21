"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../nurse.module.css";
import { fetchEntity, saveEntity, StoreRow } from "../lib/storeApi";

type Student = {
  id: number;
  photoUrl: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  department: string;
  classRoom: string;
  phone: string;
  chronic: string;
};

type StudentForm = Omit<Student, "id">;

const AVATAR_FALLBACKS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=200&auto=format&fit=crop"
];

const INITIAL_STUDENTS: Student[] = [
  {
    id: 1,
    photoUrl: AVATAR_FALLBACKS[0],
    studentCode: "66012001",
    firstName: "กิตติพงษ์",
    lastName: "สายชล",
    department: "ช่างยนต์",
    classRoom: "ปวช.2/1",
    phone: "089-100-1001",
    chronic: "ภูมิแพ้"
  },
  {
    id: 2,
    photoUrl: AVATAR_FALLBACKS[1],
    studentCode: "66013044",
    firstName: "พิมพ์ชนก",
    lastName: "คำแก้ว",
    department: "คอมพิวเตอร์ธุรกิจ",
    classRoom: "ปวช.2/2",
    phone: "089-100-1002",
    chronic: "ไมเกรน"
  }
];

const EMPTY_FORM: StudentForm = {
  photoUrl: "",
  studentCode: "",
  firstName: "",
  lastName: "",
  department: "",
  classRoom: "",
  phone: "",
  chronic: ""
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function rowToStudent(row: StoreRow, index: number): Student {
  const id = toNumber(row.id, index + 1);
  return {
    id,
    photoUrl: toText(row.photo_url || row.photoUrl) || AVATAR_FALLBACKS[index % AVATAR_FALLBACKS.length],
    studentCode: toText(row.student_code || row.studentCode),
    firstName: toText(row.first_name || row.firstName),
    lastName: toText(row.last_name || row.lastName),
    department: toText(row.department),
    classRoom: toText(row.class_room || row.classRoom),
    phone: toText(row.phone || row.allergy_note),
    chronic: toText(row.chronic_note || row.chronic)
  };
}

function studentToRow(student: Student): StoreRow {
  const now = new Date().toISOString();
  return {
    id: student.id,
    student_code: student.studentCode,
    first_name: student.firstName,
    last_name: student.lastName,
    department: student.department,
    class_room: student.classRoom,
    phone: student.phone,
    photo_url: student.photoUrl,
    allergy_note: student.phone,
    chronic_note: student.chronic,
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

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState<StudentForm>(EMPTY_FORM);
  const [photoFileName, setPhotoFileName] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return students;

    return students.filter((student) => {
      const data = `${student.studentCode} ${student.firstName} ${student.lastName} ${student.department} ${student.classRoom} ${student.phone}`.toLowerCase();
      return data.includes(keyword);
    });
  }, [search, students]);

  useEffect(() => {
    void loadStudents();
  }, []);

  async function loadStudents() {
    try {
      setLoading(true);
      const rows = await fetchEntity("students");
      if (rows.length === 0) {
        setStudents(INITIAL_STUDENTS);
        await saveEntity(
          "students",
          INITIAL_STUDENTS.map(studentToRow)
        );
      } else {
        setStudents(rows.map((row, index) => rowToStudent(row, index)));
      }
      setMessage("");
    } catch (error) {
      setStudents(INITIAL_STUDENTS);
      setMessage(error instanceof Error ? `โหลดข้อมูลไม่สำเร็จ: ${error.message}` : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setPhotoFileName("");
    setEditingId(null);
  }

  async function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
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
      setForm((prev) => ({ ...prev, photoUrl: dataUrl }));
      setPhotoFileName(file.name);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ");
    }
  }

  async function persistStudents(next: Student[], successMessage: string) {
    setStudents(next);
    try {
      await saveEntity(
        "students",
        next.map(studentToRow)
      );
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? `บันทึกข้อมูลไม่สำเร็จ: ${error.message}` : "บันทึกข้อมูลไม่สำเร็จ");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: StudentForm = {
      photoUrl: form.photoUrl.trim(),
      studentCode: form.studentCode.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      department: form.department.trim(),
      classRoom: form.classRoom.trim(),
      phone: form.phone.trim(),
      chronic: form.chronic.trim()
    };

    if (!payload.studentCode || !payload.firstName || !payload.lastName || !payload.department || !payload.classRoom) {
      setMessage("กรอกข้อมูลสำคัญให้ครบ: รหัส/ชื่อ/นามสกุล/แผนก/ชั้น");
      return;
    }

    if (!payload.photoUrl) {
      payload.photoUrl = AVATAR_FALLBACKS[0];
    }

    if (editingId !== null) {
      const next = students.map((student) => (student.id === editingId ? { ...student, ...payload } : student));
      resetForm();
      await persistStudents(next, "บันทึกการแก้ไขเรียบร้อย");
      return;
    }

    const nextId = students.length ? Math.max(...students.map((student) => student.id)) + 1 : 1;
    const next = [{ id: nextId, ...payload }, ...students];
    resetForm();
    await persistStudents(next, "เพิ่มนักศึกษาเรียบร้อย");
  }

  function startEdit(student: Student) {
    setEditingId(student.id);
    setForm({
      photoUrl: student.photoUrl,
      studentCode: student.studentCode,
      firstName: student.firstName,
      lastName: student.lastName,
      department: student.department,
      classRoom: student.classRoom,
      phone: student.phone,
      chronic: student.chronic
    });
    setPhotoFileName("");
    setMessage("");
  }

  async function removeStudent(id: number) {
    const next = students.filter((student) => student.id !== id);
    if (editingId === id) resetForm();
    await persistStudents(next, "ลบนักศึกษาเรียบร้อย");
  }

  return (
    <>
      {message ? <section className={styles.statusBanner}>{message}</section> : null}

      <section className={styles.gridTwo}>
        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>{editingId ? "แก้ไขข้อมูลนักศึกษา" : "เพิ่มนักศึกษา"}</h3>
          </div>

          <form onSubmit={handleSubmit} className={styles.formGrid}>
            <div>
              <label className={styles.label} htmlFor="photo-upload">
                รูปนักศึกษา (อัปโหลด)
              </label>
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                className={styles.input}
                onChange={(event) => void handlePhotoUpload(event)}
              />
              {photoFileName ? <p className={styles.infoText}>ไฟล์: {photoFileName}</p> : null}
              {form.photoUrl ? (
                <img
                  src={form.photoUrl}
                  alt="ตัวอย่างรูปนักศึกษา"
                  className={styles.tableAvatar}
                  style={{ width: 64, height: 64, marginTop: 6 }}
                />
              ) : null}
            </div>
            <div>
              <label className={styles.label} htmlFor="student-code">
                รหัสนักศึกษา
              </label>
              <input
                id="student-code"
                className={styles.input}
                value={form.studentCode}
                onChange={(event) => setForm((prev) => ({ ...prev, studentCode: event.target.value }))}
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
              <label className={styles.label} htmlFor="class-room">
                ชั้น / ห้อง
              </label>
              <input
                id="class-room"
                className={styles.input}
                value={form.classRoom}
                onChange={(event) => setForm((prev) => ({ ...prev, classRoom: event.target.value }))}
              />
            </div>
            <div>
              <label className={styles.label} htmlFor="phone">
                เบอร์โทร
              </label>
              <input
                id="phone"
                className={styles.input}
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div>
              <label className={styles.label} htmlFor="chronic">
                โรคประจำตัว
              </label>
              <input
                id="chronic"
                className={styles.input}
                value={form.chronic}
                onChange={(event) => setForm((prev) => ({ ...prev, chronic: event.target.value }))}
              />
            </div>

            <div className={styles.toolbar}>
              <button type="submit" className={`${styles.button} ${styles.btnPrimary}`}>
                ➕ {editingId ? "บันทึกแก้ไข" : "เพิ่ม"}
              </button>
              <button type="button" className={`${styles.button} ${styles.btnGhost}`} onClick={resetForm}>
                🔄 รีเฟรช
              </button>
            </div>
          </form>
        </article>

        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>ค้นหานักศึกษา</h3>
          </div>

          <div className={styles.toolbar}>
            <input
              className={styles.input}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="พิมพ์เพื่อค้นหา..."
            />
            <button className={`${styles.button} ${styles.btnSoft}`}>🔍 ค้นหา</button>
          </div>

          <div className={styles.peopleGrid}>
            {filteredStudents.slice(0, 6).map((student) => (
              <article key={student.id} className={styles.personCard}>
                <img src={student.photoUrl} alt={student.firstName} className={styles.personImage} />
                <div>
                  <p className={styles.infoValue}>
                    {student.firstName} {student.lastName}
                  </p>
                  <p className={styles.infoText}>{student.studentCode}</p>
                  <p className={styles.infoText}>{student.department}</p>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.panel}>
        <div>
          <h3 className={styles.sectionTitle}>ตารางนักศึกษา ({filteredStudents.length} คน)</h3>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>รูป</th>
                <th>รหัสนักศึกษา</th>
                <th>ชื่อ-นามสกุล</th>
                <th>แผนก</th>
                <th>ชั้น</th>
                <th>โทร</th>
                <th>โรคประจำตัว</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>กำลังโหลดข้อมูล...</td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8}>ยังไม่มีข้อมูลนักศึกษา</td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <img src={student.photoUrl} alt={student.firstName} width={48} height={48} className={styles.tableAvatar} />
                    </td>
                    <td>{student.studentCode}</td>
                    <td>
                      {student.firstName} {student.lastName}
                    </td>
                    <td>{student.department}</td>
                    <td>{student.classRoom}</td>
                    <td>{student.phone}</td>
                    <td>{student.chronic}</td>
                    <td>
                      <div className={styles.inlineActions}>
                        <button className={`${styles.button} ${styles.btnWarning}`} onClick={() => startEdit(student)}>
                          ✏️ แก้ไข
                        </button>
                        <button className={`${styles.button} ${styles.btnDanger}`} onClick={() => removeStudent(student.id)}>
                          ❌ ลบ
                        </button>
                        <button className={`${styles.button} ${styles.btnSoft}`}>📄 ดูประวัติ</button>
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
