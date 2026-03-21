"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../nurse.module.css";
import { ensureUsersSeed, findUserCredential, setCurrentSession } from "../lib/auth";

export default function NurseLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => username.trim() !== "" && password.trim() !== "", [username, password]);

  useEffect(() => {
    void ensureUsersSeed();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const found = await findUserCredential(username, password);
    if (!found) {
      setError("เข้าสู่ระบบไม่สำเร็จ: ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      setLoading(false);
      return;
    }

    setCurrentSession({
      username: found.username,
      role: found.role,
      loginAt: new Date().toISOString()
    });
    setError("");
    setLoading(false);
    router.push(found.role === "admin" ? "/nurse/dashboard" : "/nurse/video");
  }

  return (
    <section className={styles.gridTwo}>
      <article className={styles.hero}>
        <h2 className={styles.heroTitle}>Login สำหรับผู้ดูแลระบบ</h2>
      </article>

      <article className={styles.panel}>
        <div>
          <h3 className={styles.sectionTitle}>Admin Sign In</h3>
        </div>

        <form onSubmit={handleSubmit} className={styles.miniGrid}>
          <div>
            <label className={styles.label} htmlFor="username">
              ชื่อผู้ใช้
            </label>
            <input
              id="username"
              className={styles.input}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="admin"
              autoComplete="username"
            />
          </div>

          <div>
            <label className={styles.label} htmlFor="password">
              รหัสผ่าน
            </label>
            <input
              id="password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error ? <div className={styles.alertBox}>{error}</div> : null}

          <div className={styles.toolbar}>
            <button type="submit" disabled={!canSubmit || loading} className={`${styles.button} ${styles.btnPrimary}`}>
              {loading ? "กำลังตรวจสอบ..." : "🔐 เข้าสู่ระบบ"}
            </button>
            <Link href="/nurse" className={`${styles.button} ${styles.btnSoft}`}>
              🔙 กลับหน้าหลัก
            </Link>
          </div>
        </form>
      </article>
    </section>
  );
}
