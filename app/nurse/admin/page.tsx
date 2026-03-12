import Link from "next/link";
import styles from "../nurse.module.css";

export default function AdminEntryPage() {
  return (
    <section className={styles.panel}>
      <h2 className={styles.sectionTitle}>Admin Center</h2>
      <div className={styles.toolbar}>
        <Link href="/nurse/dashboard" className={`${styles.button} ${styles.btnPrimary}`}>
          เปิด Dashboard
        </Link>
        <Link href="/nurse/login" className={`${styles.button} ${styles.btnSoft}`}>
          กลับหน้า Login
        </Link>
      </div>
    </section>
  );
}
