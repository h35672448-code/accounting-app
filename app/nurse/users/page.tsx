"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import styles from "../nurse.module.css";
import {
  type NurseRole,
  type NurseUserRecord,
  getCurrentSession,
  loadUsersFromStore,
  saveUsersToStore
} from "../lib/auth";

type UserFormState = {
  username: string;
  password: string;
  role: NurseRole;
};

const EMPTY_FORM: UserFormState = {
  username: "",
  password: "",
  role: "user"
};

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function importedUserRow(row: Record<string, unknown>): Omit<NurseUserRecord, "id" | "createdAt"> | null {
  const username = toText(row.username || row.user || row.name);
  const password = toText(row.password || row.pass);
  const roleText = toText(row.role).toLowerCase();
  const role: NurseRole = roleText === "admin" || roleText.includes("ดูแล") ? "admin" : "user";

  if (!username || !password) return null;
  return { username, password, role };
}

export default function NurseUsersPage() {
  const router = useRouter();
  const importRef = useRef<HTMLInputElement | null>(null);
  const [users, setUsers] = useState<NurseUserRecord[]>([]);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUsername, setCurrentUsername] = useState("");

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return users;

    return users.filter((user) => `${user.username} ${user.role}`.toLowerCase().includes(keyword));
  }, [search, users]);

  useEffect(() => {
    const session = getCurrentSession();
    if (!session || session.role !== "admin") {
      router.replace("/nurse/login");
      return;
    }

    setCurrentUsername(session.username);
    void loadUsers();
  }, [router]);

  async function loadUsers() {
    try {
      setLoading(true);
      const nextUsers = await loadUsersFromStore();
      setUsers(nextUsers);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? `โหลดผู้ใช้ไม่สำเร็จ: ${error.message}` : "โหลดผู้ใช้ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function persistUsers(nextUsers: NurseUserRecord[], successMessage: string, errorPrefix: string) {
    const previousUsers = users;
    setUsers(nextUsers);

    try {
      await saveUsersToStore(nextUsers);
      setMessage(successMessage);
      resetForm();
    } catch (error) {
      setUsers(previousUsers);
      setMessage(error instanceof Error ? `${errorPrefix}: ${error.message}` : errorPrefix);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const username = form.username.trim();
    const password = form.password.trim();
    if (!username || !password) {
      setMessage("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    const duplicate = users.find((user) => user.username.toLowerCase() === username.toLowerCase() && user.id !== editingId);
    if (duplicate) {
      setMessage("ชื่อผู้ใช้นี้มีอยู่แล้ว");
      return;
    }

    if (editingId !== null) {
      const nextUsers = users.map((user) =>
        user.id === editingId
          ? {
              ...user,
              username,
              password,
              role: form.role
            }
          : user
      );

      await persistUsers(nextUsers, `บันทึกผู้ใช้ ${username} เรียบร้อย`, "บันทึกผู้ใช้ไม่สำเร็จ");
      return;
    }

    const nextId = users.length ? Math.max(...users.map((user) => user.id)) + 1 : 1;
    const nextUsers = [
      {
        id: nextId,
        username,
        password,
        role: form.role,
        createdAt: new Date().toISOString()
      },
      ...users
    ];

    await persistUsers(nextUsers, `เพิ่มผู้ใช้ ${username} เรียบร้อย`, "เพิ่มผู้ใช้ไม่สำเร็จ");
  }

  function startEdit(user: NurseUserRecord) {
    setEditingId(user.id);
    setForm({
      username: user.username,
      password: user.password,
      role: user.role
    });
    setMessage("");
  }

  async function removeUser(user: NurseUserRecord) {
    if (user.username === currentUsername) {
      setMessage("ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้");
      return;
    }

    if (user.role === "admin" && users.filter((item) => item.role === "admin").length <= 1) {
      setMessage("ระบบต้องมีผู้ดูแลอย่างน้อย 1 คน");
      return;
    }

    const confirmed = window.confirm(`ยืนยันลบบัญชี ${user.username} ?`);
    if (!confirmed) return;

    const nextUsers = users.filter((item) => item.id !== user.id);
    await persistUsers(nextUsers, `ลบผู้ใช้ ${user.username} เรียบร้อย`, "ลบผู้ใช้ไม่สำเร็จ");
  }

  function handleExportXlsx() {
    const rows = users.map((user) => ({
      username: user.username,
      password: user.password,
      role: user.role,
      createdAt: user.createdAt
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "NurseUsers");
    XLSX.writeFile(workbook, "nurse-users.xlsx");
    setMessage("ส่งออกรายชื่อผู้ใช้สำเร็จ");
  }

  async function handleImportXlsx(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false
      });

      const imported = rows
        .map(importedUserRow)
        .filter((row): row is Omit<NurseUserRecord, "id" | "createdAt"> => row !== null);

      if (imported.length === 0) {
        setMessage("ไม่พบข้อมูลผู้ใช้ที่ถูกต้องในไฟล์");
        return;
      }

      const byName = new Map<string, NurseUserRecord>();
      users.forEach((user) => {
        byName.set(user.username.toLowerCase(), user);
      });

      imported.forEach((user) => {
        const key = user.username.toLowerCase();
        const existing = byName.get(key);
        byName.set(key, {
          id: existing?.id ?? (byName.size + 1),
          username: user.username,
          password: user.password,
          role: user.role,
          createdAt: existing?.createdAt ?? new Date().toISOString()
        });
      });

      const nextUsers = [...byName.values()].sort((a, b) => a.id - b.id);
      await persistUsers(nextUsers, `นำเข้าผู้ใช้สำเร็จ ${imported.length} รายการ`, "นำเข้าผู้ใช้ไม่สำเร็จ");
    } catch {
      setMessage("ไฟล์ผู้ใช้ไม่ถูกต้อง");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <>
      <section className={styles.hero}>
        <h2 className={styles.heroTitle}>จัดการผู้ใช้ระบบห้องพยาบาล</h2>
      </section>

      {message ? <section className={styles.statusBanner}>{message}</section> : null}

      <section className={styles.gridTwo}>
        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>{editingId !== null ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"}</h3>
          </div>

          <form onSubmit={handleSubmit} className={styles.formGrid}>
            <div>
              <label className={styles.label} htmlFor="nurse-user-username">
                ชื่อผู้ใช้
              </label>
              <input
                id="nurse-user-username"
                className={styles.input}
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                placeholder="username"
              />
            </div>

            <div>
              <label className={styles.label} htmlFor="nurse-user-password">
                รหัสผ่าน
              </label>
              <input
                id="nurse-user-password"
                className={styles.input}
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="password"
              />
            </div>

            <div>
              <label className={styles.label} htmlFor="nurse-user-role">
                สิทธิ์
              </label>
              <select
                id="nurse-user-role"
                className={styles.select}
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as NurseRole }))}
              >
                <option value="user">ผู้ใช้</option>
                <option value="admin">ผู้ดูแล</option>
              </select>
            </div>

            <div className={styles.toolbar}>
              <button className={`${styles.button} ${styles.btnPrimary}`} type="submit">
                {editingId !== null ? "💾 บันทึกผู้ใช้" : "➕ เพิ่มผู้ใช้"}
              </button>
              <button className={`${styles.button} ${styles.btnGhost}`} type="button" onClick={resetForm}>
                รีเซ็ต
              </button>
            </div>
          </form>
        </article>

        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>นำเข้า / ส่งออก .xlsx</h3>
          </div>

          <div className={styles.miniGrid}>
            <p className={styles.infoText}>ผู้ดูแลที่กำลังใช้งาน</p>
            <p className={styles.infoValue}>{currentUsername || "-"}</p>
            <p className={styles.infoText}>จำนวนผู้ใช้ทั้งหมด</p>
            <p className={styles.infoValue}>{users.length} คน</p>
          </div>

          <div className={styles.toolbar}>
            <button className={`${styles.button} ${styles.btnSoft}`} type="button" onClick={handleExportXlsx}>
              📤 ส่งออก xlsx
            </button>
            <button className={`${styles.button} ${styles.btnSoft}`} type="button" onClick={() => importRef.current?.click()}>
              📥 นำเข้า xlsx
            </button>
            <button className={`${styles.button} ${styles.btnGhost}`} type="button" onClick={() => void loadUsers()}>
              🔄 โหลดจาก Drive
            </button>
            <input ref={importRef} type="file" accept=".xlsx,.xls" hidden onChange={(event) => void handleImportXlsx(event)} />
          </div>

          <div>
            <label className={styles.label} htmlFor="nurse-user-search">
              ค้นหาผู้ใช้
            </label>
            <input
              id="nurse-user-search"
              className={styles.input}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาจากชื่อผู้ใช้หรือสิทธิ์"
            />
          </div>
        </article>
      </section>

      <section className={styles.panel}>
        <div>
          <h3 className={styles.sectionTitle}>รายชื่อผู้ใช้ ({filteredUsers.length} รายการ)</h3>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ชื่อผู้ใช้</th>
                <th>รหัสผ่าน</th>
                <th>สิทธิ์</th>
                <th>สร้างเมื่อ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>กำลังโหลดข้อมูล...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5}>ยังไม่มีผู้ใช้ในระบบ</td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.password}</td>
                    <td>
                      <span className={`${styles.badge} ${user.role === "admin" ? styles.badgeMedium : styles.badgeNormal}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>{new Date(user.createdAt).toLocaleString("th-TH")}</td>
                    <td>
                      <div className={styles.inlineActions}>
                        <button className={`${styles.button} ${styles.btnSoft}`} type="button" onClick={() => startEdit(user)}>
                          แก้ไข
                        </button>
                        <button className={`${styles.button} ${styles.btnDanger}`} type="button" onClick={() => void removeUser(user)}>
                          ลบ
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
