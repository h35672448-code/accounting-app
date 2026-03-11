"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../nurse.module.css";
import { fetchEntity, saveEntity, StoreRow } from "../lib/storeApi";

type Review = {
  id: number;
  service: number;
  speed: number;
  satisfaction: number;
  comment: string;
  date: string;
};

const INITIAL_REVIEWS: Review[] = [
  { id: 1, service: 5, speed: 4, satisfaction: 5, comment: "เจ้าหน้าที่ดูแลดีมาก", date: "11/03/2026" },
  { id: 2, service: 4, speed: 4, satisfaction: 4, comment: "รอคิวไม่นาน", date: "10/03/2026" }
];

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function moodFromScore(score: number) {
  if (score >= 4.5) return "ดีมาก";
  if (score >= 3.5) return "ดี";
  if (score >= 2.5) return "ปานกลาง";
  return "แย่";
}

function parsePackedComment(value: string) {
  try {
    const parsed = JSON.parse(value) as {
      service?: number;
      speed?: number;
      satisfaction?: number;
      text?: string;
    };
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    return {
      service: toNumber(parsed.service, 5),
      speed: toNumber(parsed.speed, 5),
      satisfaction: toNumber(parsed.satisfaction, 5),
      text: toText(parsed.text)
    };
  } catch {
    return null;
  }
}

function reviewToRow(item: Review): StoreRow {
  const packed = JSON.stringify({
    service: item.service,
    speed: item.speed,
    satisfaction: item.satisfaction,
    text: item.comment
  });

  const avg = (item.service + item.speed + item.satisfaction) / 3;

  return {
    id: item.id,
    student_id: "",
    visit_id: "",
    mood: moodFromScore(avg),
    comment: packed,
    created_at: new Date().toISOString()
  };
}

function rowToReview(row: StoreRow, index: number): Review {
  const parsed = parsePackedComment(toText(row.comment));
  return {
    id: toNumber(row.id, index + 1),
    service: parsed?.service ?? 5,
    speed: parsed?.speed ?? 5,
    satisfaction: parsed?.satisfaction ?? 5,
    comment: parsed?.text ?? toText(row.comment),
    date: new Date(toText(row.created_at)).toLocaleDateString("th-TH")
  };
}

export default function ReviewPage() {
  const [service, setService] = useState(5);
  const [speed, setSpeed] = useState(5);
  const [satisfaction, setSatisfaction] = useState(5);
  const [comment, setComment] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const average = useMemo(() => {
    if (reviews.length === 0) return 0;
    const total = reviews.reduce((sum, item) => sum + (item.service + item.speed + item.satisfaction) / 3, 0);
    return (total / reviews.length).toFixed(2);
  }, [reviews]);

  useEffect(() => {
    void loadReviews();
  }, []);

  async function loadReviews() {
    try {
      setLoading(true);
      const rows = await fetchEntity("feedback");
      if (rows.length === 0) {
        setReviews(INITIAL_REVIEWS);
        await saveEntity(
          "feedback",
          INITIAL_REVIEWS.map(reviewToRow)
        );
      } else {
        const mapped = rows.map((row, index) => rowToReview(row, index));
        mapped.sort((a, b) => b.id - a.id);
        setReviews(mapped);
      }
      setMessage("");
    } catch (error) {
      setReviews(INITIAL_REVIEWS);
      setMessage(error instanceof Error ? `โหลดผลประเมินไม่สำเร็จ: ${error.message}` : "โหลดผลประเมินไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function persistReviews(next: Review[], successMessage: string) {
    setReviews(next);
    try {
      await saveEntity(
        "feedback",
        next.map(reviewToRow)
      );
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? `บันทึกผลประเมินไม่สำเร็จ: ${error.message}` : "บันทึกผลประเมินไม่สำเร็จ");
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const next: Review = {
      id: reviews.length ? Math.max(...reviews.map((item) => item.id)) + 1 : 1,
      service,
      speed,
      satisfaction,
      comment: comment.trim(),
      date: new Date().toLocaleDateString("th-TH")
    };

    const merged = [next, ...reviews];
    await persistReviews(merged, "📤 ส่งประเมินเรียบร้อย ขอบคุณสำหรับข้อเสนอแนะ");
    setComment("");
    setService(5);
    setSpeed(5);
    setSatisfaction(5);
  }

  async function clearAllReviews() {
    await persistReviews([], "ลบข้อมูลประเมินทั้งหมดเรียบร้อย");
  }

  return (
    <>
      <section className={styles.hero}>
        <h2 className={styles.heroTitle}>ประเมินบริการ</h2>
        <p className={styles.heroText}>ให้คะแนนการบริการ ความรวดเร็ว และความพึงพอใจ พร้อมแสดงความคิดเห็น</p>
      </section>

      {message ? <section className={styles.statusBanner}>{message}</section> : null}

      <section className={styles.gridTwo}>
        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>ฟอร์มประเมิน</h3>
          </div>
          <form onSubmit={submitReview} className={styles.miniGrid}>
            <div>
              <label className={styles.label}>การบริการ</label>
              <input type="range" min={1} max={5} value={service} onChange={(event) => setService(Number(event.target.value))} />
              <p className={styles.infoText}>คะแนน: {service}/5</p>
            </div>
            <div>
              <label className={styles.label}>ความรวดเร็ว</label>
              <input type="range" min={1} max={5} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
              <p className={styles.infoText}>คะแนน: {speed}/5</p>
            </div>
            <div>
              <label className={styles.label}>ความพึงพอใจ</label>
              <input type="range" min={1} max={5} value={satisfaction} onChange={(event) => setSatisfaction(Number(event.target.value))} />
              <p className={styles.infoText}>คะแนน: {satisfaction}/5</p>
            </div>
            <div>
              <label className={styles.label}>ความคิดเห็น</label>
              <textarea className={styles.textarea} value={comment} onChange={(event) => setComment(event.target.value)} />
            </div>
            <button className={`${styles.button} ${styles.btnPrimary}`}>📤 ส่งประเมิน</button>
          </form>
        </article>

        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>สรุปผล (Admin)</h3>
            <p className={styles.sectionSub}>คะแนนเฉลี่ยรวม {average}/5 จาก {reviews.length} รายการ</p>
          </div>
          <div className={styles.toolbar}>
            <button className={`${styles.button} ${styles.btnSoft}`}>📊 ดูผลประเมิน</button>
            <button className={`${styles.button} ${styles.btnDanger}`} onClick={clearAllReviews}>
              🗑 ลบข้อมูล
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>บริการ</th>
                  <th>เร็ว</th>
                  <th>พึงพอใจ</th>
                  <th>ความเห็น</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5}>กำลังโหลดผลประเมิน...</td>
                  </tr>
                ) : reviews.length === 0 ? (
                  <tr>
                    <td colSpan={5}>ยังไม่มีข้อมูลประเมิน</td>
                  </tr>
                ) : (
                  reviews.map((item) => (
                    <tr key={item.id}>
                      <td>{item.date}</td>
                      <td>{item.service}</td>
                      <td>{item.speed}</td>
                      <td>{item.satisfaction}</td>
                      <td>{item.comment || "-"}</td>
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
