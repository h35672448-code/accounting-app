"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import styles from "../nurse.module.css";
import { fetchEntity, saveEntity, StoreRow } from "../lib/storeApi";

type NewsItem = {
  id: number;
  title: string;
  detail: string;
  image: string;
  date: string;
};

const INITIAL_NEWS: NewsItem[] = [
  {
    id: 1,
    title: "เปิดบริการวัคซีนไข้หวัดใหญ่",
    detail: "นักศึกษาลงทะเบียนได้ที่ห้องพยาบาล วันที่ 18-20 มีนาคม",
    image: "https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=300&auto=format&fit=crop",
    date: "11/03/2026"
  }
];

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function formatThaiDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString("th-TH");
  return date.toLocaleDateString("th-TH");
}

function rowToNews(row: StoreRow, index: number): NewsItem {
  return {
    id: toNumber(row.id, index + 1),
    title: toText(row.title),
    detail: toText(row.detail),
    image:
      toText(row.image_url || row.image) ||
      "https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=300&auto=format&fit=crop",
    date: formatThaiDate(toText(row.published_at || row.date))
  };
}

function newsToRow(item: NewsItem): StoreRow {
  const now = new Date().toISOString();
  return {
    id: item.id,
    title: item.title,
    detail: item.detail,
    image_url: item.image,
    published_at: now,
    author_id: 1,
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

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [image, setImage] = useState("");
  const [imageFileName, setImageFileName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadNews();
  }, []);

  async function loadNews() {
    try {
      setLoading(true);
      const rows = await fetchEntity("news");
      if (rows.length === 0) {
        setNews(INITIAL_NEWS);
        await saveEntity(
          "news",
          INITIAL_NEWS.map(newsToRow)
        );
      } else {
        const mapped = rows.map((row, index) => rowToNews(row, index));
        mapped.sort((a, b) => b.id - a.id);
        setNews(mapped);
      }
      setMessage("");
    } catch (error) {
      setNews(INITIAL_NEWS);
      setMessage(error instanceof Error ? `โหลดข่าวไม่สำเร็จ: ${error.message}` : "โหลดข่าวไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTitle("");
    setDetail("");
    setImage("");
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
      setImage(dataUrl);
      setImageFileName(file.name);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ");
    }
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

    const payload = {
      title: title.trim(),
      detail: detail.trim(),
      image: image.trim() || "https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=300&auto=format&fit=crop"
    };

    if (!payload.title || !payload.detail) {
      setMessage("กรอกหัวข้อและรายละเอียดให้ครบ");
      return;
    }

    if (editingId !== null) {
      const next = news.map((item) => (item.id === editingId ? { ...item, ...payload, date: new Date().toLocaleDateString("th-TH") } : item));
      resetForm();
      await persistNews(next, "แก้ไขข่าวเรียบร้อย");
      return;
    }

    const nextId = news.length ? Math.max(...news.map((item) => item.id)) + 1 : 1;
    const next = [{ id: nextId, ...payload, date: new Date().toLocaleDateString("th-TH") }, ...news];
    resetForm();
    await persistNews(next, "เพิ่มข่าวเรียบร้อย");
  }

  function startEdit(item: NewsItem) {
    setEditingId(item.id);
    setTitle(item.title);
    setDetail(item.detail);
    setImage(item.image);
    setImageFileName("");
    setMessage("");
  }

  async function removeNews(id: number) {
    const next = news.filter((item) => item.id !== id);
    if (editingId === id) resetForm();
    await persistNews(next, "ลบข่าวเรียบร้อย");
  }

  return (
    <>
      <section className={styles.hero}>
        <h2 className={styles.heroTitle}>ข่าวประกาศ</h2>
      </section>

      {message ? <section className={styles.statusBanner}>{message}</section> : null}

      <section className={styles.gridTwo}>
        <article className={styles.panel}>
          <div>
            <h3 className={styles.sectionTitle}>{editingId ? "แก้ไขข่าว" : "เพิ่มข่าว"}</h3>
          </div>

          <form onSubmit={submitNews} className={styles.miniGrid}>
            <div>
              <label className={styles.label}>หัวข้อ</label>
              <input className={styles.input} value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div>
              <label className={styles.label}>รายละเอียด</label>
              <textarea className={styles.textarea} value={detail} onChange={(event) => setDetail(event.target.value)} />
            </div>
            <div>
              <label className={styles.label}>รูปภาพ (อัปโหลด)</label>
              <input type="file" accept="image/*" className={styles.input} onChange={(event) => void handleImageUpload(event)} />
              {imageFileName ? <p className={styles.infoText}>ไฟล์: {imageFileName}</p> : null}
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
                    <p className={styles.infoText}>วันที่ {item.date}</p>
                  </div>
                  <div className={styles.inlineActions}>
                    <button className={`${styles.button} ${styles.btnSoft}`}>👁 ดูข่าว</button>
                    <button className={`${styles.button} ${styles.btnWarning}`} onClick={() => startEdit(item)}>
                      ✏ แก้ไข
                    </button>
                    <button className={`${styles.button} ${styles.btnDanger}`} onClick={() => removeNews(item.id)}>
                      ❌ ลบ
                    </button>
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
