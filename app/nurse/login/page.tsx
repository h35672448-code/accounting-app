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

  const canSubmit = useMemo(() => username.trim() !== "" && password.trim() !== "", [username, password]);

  useEffect(() => {
    ensureUsersSeed();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = findUserCredential(username, password);
    if (!found) {
      setError("เข้าสู่ระบบไม่สำเร็จ: ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      return;
    }

    setCurrentSession({
      username: found.username,
      role: found.role,
      loginAt: new Date().toISOString()
    });
    setError("");
    router.push(found.role === "admin" ? "/nurse/dashboard" : "/nurse/video");
  }

  return (
    <section className={`${styles.panel} ${styles.authPanel}`}>
      <article>
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
            <button type="submit" disabled={!canSubmit} className={`${styles.button} ${styles.btnPrimary}`}>
              🔐 เข้าสู่ระบบ
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
