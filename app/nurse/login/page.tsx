"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../nurse.module.css";

const demoCredential = {
  username: "admin",
  password: "admin1234"
};

export default function NurseLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => username.trim() !== "" && password.trim() !== "", [username, password]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (username.trim() === demoCredential.username && password.trim() === demoCredential.password) {
      setError("");
      router.push("/nurse/dashboard");
      return;
    }

    setError("เข้าสู่ระบบไม่สำเร็จ: Demo user คือ admin / admin1234");
  }

  return (
    <section className={styles.gridTwo}>
      <article className={styles.hero}>
        <h2 className={styles.heroTitle}>Login สำหรับผู้ดูแลระบบ</h2>
        <p className={styles.heroText}>สิทธิ์ Admin ใช้จัดการคิวผู้ป่วย ข้อมูลนักศึกษา บันทึกการรักษา คลังยา ข่าว และรายงานประจำวัน</p>
        <ul className={styles.listPlain}>
          <li>รองรับโหมด Token/JWT เมื่อผูกฐานข้อมูลจริง</li>
          <li>แยกสิทธิ์ Admin, Nurse, Viewer ได้ในขั้น production</li>
          <li>บันทึก audit log ทุกการแก้ไขข้อมูลสำคัญ</li>
        </ul>
      </article>

      <article className={styles.panel}>
        <div>
          <h3 className={styles.sectionTitle}>Admin Sign In</h3>
          <p className={styles.sectionSub}>กรอกชื่อผู้ใช้และรหัสผ่านเพื่อเข้าสู่ระบบ</p>
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
