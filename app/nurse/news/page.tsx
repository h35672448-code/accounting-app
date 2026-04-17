"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import styles from "../nurse.module.css";
import { canWriteEntity, fetchEntity, saveEntity, StoreRow } from "../lib/storeApi";

type NewsItem = {
  id: number;
  title: string;
  detail: string;
  image: string;
  date: string;
};

const NEWS_FALLBACK_IMAGE = "/logo.png";

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function toDateInputValue(value: unknown) {
  const raw = toText(value);
  if (!raw) return new Date().toISOString().slice(0, 10);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toISOString().slice(0, 10);
}

function formatThaiDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return date.toLocaleDateString("th-TH");
}

function rowToNews(row: StoreRow, index: number): NewsItem {
  return {
    id: toNumber(row.id, index + 1),
    title: toText(row.title),
    detail: toText(row.detail),
    image: toText(row.image_url || row.image) || NEWS_FALLBACK_IMAGE,
    date: toDateInputValue(row.published_at || row.date)
  };
}

function newsToRow(item: NewsItem): StoreRow {
  const now = new Date().toISOString();
  const publishedAt = item.date ? new Date(`${item.date}T00:00:00`).toISOString() : now;
  return {
    id: item.id,
    title: item.title,
    detail: item.detail,
    image_url: item.image,
    published_at: publishedAt,
    date: item.date,
    author_id: 1,
    updated_at: now,
    created_at: publishedAt
  };
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [image, setImage] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [canManageNews, setCanManageNews] = useState(false);

  useEffect(() => {
    void loadNews();
  }, []);

  useEffect(() => {
    const syncAccess = () => setCanManageNews(canWriteEntity("news"));
    syncAccess();
    window.addEventListener("storage", syncAccess);
    window.addEventListener("focus", syncAccess);
    return () => {
      window.removeEventListener("storage", syncAccess);
      window.removeEventListener("focus", syncAccess);
    };
  }, []);

  async function loadNews() {
    try {
      setLoading(true);
      const rows = await fetchEntity("news");
      const mapped = rows.map((row, index) => rowToNews(row, index));
      mapped.sort((a, b) => b.id - a.id);
      setNews(mapped);
      setMessage("");
    } catch (error) {
      setNews([]);
      setMessage(error instanceof Error ? `โหลดข่าวไม่สำเร็จ: ${error.message}` : "โหลดข่าวไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTitle("");
    setDetail("");
    setImage("");
    setDate(new Date().toISOString().slice(0, 10));
    setEditingId(null);
  }

  async function persistNews(next: NewsItem[], successMessage: string) {
    setNews(next);
    try {
      await saveEntity(
        "news",
        next.map(newsToRow)
      );
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? `บันทึกข่าวไม่สำเร็จ: ${error.message}` : "บันทึกข่าวไม่สำเร็จ");
    }
  }

  async function submitNews(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageNews) {
      setMessage("กรุณาเข้าสู่ระบบผู้ดูแลหรือผู้ใช้ก่อนบันทึกข่าว");
      return;
    }

    if (image.trim().startsWith("data:")) {
      setMessage("กรุณาใช้ลิงก์รูปภาพแบบปกติเท่านั้น ระบบนี้ยังไม่รองรับการอัปโหลดไฟล์รูปเข้า Google Sheet");
      return;
    }

    const payload = {
      title: title.trim(),
      detail: detail.trim(),
      image: image.trim() || NEWS_FALLBACK_IMAGE,
      date
    };

    if (!payload.title || !payload.detail || !payload.date) {
      setMessage("กรอกหัวข้อ รายละเอียด และวันที่ให้ครบ");
      return;
    }

    if (editingId !== null) {
      const next = news.map((item) => (item.id === editingId ? { ...item, ...payload } : item));
      resetForm();
      await persistNews(next, "แก้ไขข่าวเรียบร้อย");
      return;
    }

    const nextId = news.length ? Math.max(...news.map((item) => item.id)) + 1 : 1;
    const next = [{ id: nextId, ...payload }, ...news];
    resetForm();
    await persistNews(next, "เพิ่มข่าวเรียบร้อย");
  }

  function startEdit(item: NewsItem) {
    if (!canManageNews) {
      setMessage("กรุณาเข้าสู่ระบบผู้ดูแลหรือผู้ใช้ก่อนแก้ไขข่าว");
      return;
    }

    setEditingId(item.id);
    setTitle(item.title);
    setDetail(item.detail);
    setImage(item.image);
    setDate(toDateInputValue(item.date));
    setMessage("");
  }

  async function removeNews(id: number) {
    if (!canManageNews) {
      setMessage("กรุณาเข้าสู่ระบบผู้ดูแลหรือผู้ใช้ก่อนลบข่าว");
      return;
    }

    const next = news.filter((item) => item.id !== id);
    if (editingId === id) resetForm();
    await persistNews(next, "ลบข่าวเรียบร้อย");
  }

  return (
    <>
      {message ? <section className={styles.statusBanner}>{message}</section> : null}

      <section className={styles.gridTwo}>
        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>{editingId ? "แก้ไขข่าว" : "เพิ่มข่าว"}</h3>
          </div>

          {canManageNews ? (
            <form onSubmit={submitNews} className={styles.miniGrid}>
              <div>
                <label className={styles.label}>หัวข้อ</label>
                <input className={styles.input} value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div>
                <label className={styles.label}>วันที่</label>
                <input className={styles.input} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </div>
              <div>
                <label className={styles.label}>รายละเอียด</label>
                <textarea className={styles.textarea} value={detail} onChange={(event) => setDetail(event.target.value)} />
              </div>
              <div>
                <label className={styles.label}>ลิงก์รูปภาพ</label>
                <input
                  className={styles.input}
                  value={image}
                  onChange={(event) => setImage(event.target.value)}
                  placeholder="https://example.com/news.jpg"
                />
                <p className={styles.infoText}>ใช้ลิงก์รูปภาพปกติ เช่น จาก Google Drive แบบลิงก์ตรง หรือเว็บฝากรูป</p>
                {image ? (
                  <img
                    src={image}
                    alt="ตัวอย่างรูปข่าว"
                    className={styles.tableAvatar}
                    style={{ width: 84, height: 54, marginTop: 6 }}
                  />
                ) : null}
              </div>
              <div className={styles.toolbar}>
                <button className={`${styles.button} ${styles.btnPrimary}`} type="submit">
                  ➕ {editingId ? "บันทึกแก้ไข" : "เพิ่มข่าว"}
                </button>
                <button className={`${styles.button} ${styles.btnGhost}`} type="button" onClick={resetForm}>
                  ล้างฟอร์ม
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.alertBox}>
              คนทั่วไปดูข่าวได้เท่านั้น หากต้องการเพิ่ม แก้ไข หรือลบข่าว กรุณาเข้าสู่ระบบด้วยรหัสพนักงาน
              <div className={styles.toolbar} style={{ marginTop: 10 }}>
                <Link href="/nurse/login" className={`${styles.button} ${styles.btnPrimary}`}>
                  🔐 เข้าสู่ระบบ
                </Link>
              </div>
            </div>
          )}
        </article>

        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>รายการข่าวล่าสุด</h3>
          </div>

          <div className={styles.newsGrid}>
            {loading ? (
              <p className={styles.infoText}>กำลังโหลดข่าว...</p>
            ) : news.length === 0 ? (
              <p className={styles.infoText}>ยังไม่มีข่าว</p>
            ) : (
              news.map((item) => (
                <article key={item.id} className={styles.newsCard}>
                  <img src={item.image} alt={item.title} className={styles.newsImage} />
                  <div>
                    <p className={styles.infoValue}>{item.title}</p>
                    <p className={styles.cardText}>{item.detail}</p>
                    <p className={styles.infoText}>วันที่ {formatThaiDate(item.date)}</p>
                  </div>
                  <div className={styles.inlineActions}>
                    <button className={`${styles.button} ${styles.btnSoft}`}>👁 ดูข่าว</button>
                    {canManageNews ? (
                      <>
                        <button className={`${styles.button} ${styles.btnWarning}`} onClick={() => startEdit(item)}>
                          ✏ แก้ไข
                        </button>
                        <button className={`${styles.button} ${styles.btnDanger}`} onClick={() => removeNews(item.id)}>
                          ❌ ลบ
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </article>
      </section>
    </>
  );
}
