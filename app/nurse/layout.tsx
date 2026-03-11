"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import styles from "./nurse.module.css";

type ThemeMode = "warm" | "mono";
type NewsRow = Record<string, unknown>;

type NewsBanner = {
  id: number;
  title: string;
  detail: string;
  image: string;
  dateText: string;
};

const THEME_STORAGE_KEY = "nurse_theme_mode";
const NEWS_ROTATE_MS = 30_000;
const NEWS_FALLBACK_IMAGE = "/logo.png";

const navItems = [
  { href: "/nurse/dashboard", icon: "📊", label: "Dashboard" },
  { href: "/nurse/treatment", icon: "🧾", label: "ประวัติ" },
  { href: "/nurse/queue", icon: "📋", label: "คิวผู้ป่วย" },
  { href: "/nurse/symptom", icon: "🩺", label: "แจ้งอาการ" },
  { href: "/nurse/students", icon: "🎓", label: "นักศึกษา" },
  { href: "/nurse/medicines", icon: "💊", label: "คลังยา" },
  { href: "/nurse/news", icon: "📰", label: "ข่าว" },
  { href: "/nurse/review", icon: "⭐", label: "ประเมิน" },
  { href: "/nurse/video", icon: "📹", label: "วิดีโอคอล" },
  { href: "/nurse/login", icon: "🔐", label: "Login" }
];

function shiftByHour(hour: number) {
  if (hour < 12) return "เวรเช้า 08:00-12:00";
  if (hour < 16) return "เวรบ่าย 12:00-16:00";
  return "เวรเย็น 16:00-20:00";
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDateText(value: unknown) {
  const raw = toText(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

function rowToBanner(row: NewsRow, index: number): NewsBanner {
  return {
    id: toNumber(row.id, index + 1),
    title: toText(row.title),
    detail: toText(row.detail),
    image: toText(row.image_url || row.image) || NEWS_FALLBACK_IMAGE,
    dateText: toDateText(row.published_at || row.date)
  };
}

export default function NurseLayout({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("warm");
  const [now, setNow] = useState(() => new Date());
  const [newsList, setNewsList] = useState<NewsBanner[]>([]);
  const [newsIndex, setNewsIndex] = useState(0);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "mono" || stored === "warm") {
      setMode(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000 * 30);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadNews() {
      try {
        const response = await fetch("/api/nurse/store?entity=news", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { rows?: unknown };
        if (!Array.isArray(payload.rows)) return;

        const next = payload.rows
          .filter((row): row is NewsRow => typeof row === "object" && row !== null)
          .map((row, index) => rowToBanner(row, index))
          .filter((item) => item.title || item.detail || item.image)
          .sort((a, b) => b.id - a.id);

        if (!cancelled) {
          setNewsList(next);
        }
      } catch {
        // Keep UI usable even if news endpoint is temporarily unavailable.
      }
    }

    void loadNews();
    const refreshTimer = window.setInterval(() => {
      void loadNews();
    }, 120_000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    if (newsList.length <= 1) return;
    const timer = window.setInterval(() => {
      setNewsIndex((prev) => (prev + 1) % newsList.length);
    }, NEWS_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [newsList.length]);

  useEffect(() => {
    if (newsIndex >= newsList.length) {
      setNewsIndex(0);
    }
  }, [newsIndex, newsList.length]);

  const dateText = useMemo(
    () =>
      now.toLocaleDateString("th-TH", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }),
    [now]
  );

  const timeText = useMemo(
    () =>
      now.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }),
    [now]
  );

  const activeNews = newsList[newsIndex];

  return (
    <div className={`${styles.root} ${mode === "mono" ? styles.themeMono : styles.themeWarm}`}>
      <div className={styles.backdrop} />

      <div className={styles.layoutShell}>
        <header className={styles.topHeader}>
          <div className={styles.logoBlock}>
            <img src="/logo.png" alt="โลโก้ห้องพยาบาล" className={styles.logoImage} />
            <div>
              <h1 className={styles.brandTitle}>ระบบห้องพยาบาล</h1>
              <p className={styles.brandSub}>Nurse Room Management</p>
            </div>
          </div>

          <div className={styles.topRight}>
            <div className={styles.timeCard}>
              <p className={styles.timeDate}>{dateText}</p>
              <p className={styles.timeValue}>{timeText} น.</p>
              <p className={styles.timeShift}>👩‍⚕️ {shiftByHour(now.getHours())}</p>
            </div>
            <button
              type="button"
              className={`${styles.button} ${styles.btnSoft} ${styles.themeToggle}`}
              onClick={() => setMode((prev) => (prev === "warm" ? "mono" : "warm"))}
            >
              {mode === "warm" ? "◐ โหมดขาวดำ" : "◐ โหมดสีอุ่น"}
            </button>
          </div>
        </header>

        <nav className={styles.topNav}>
          {navItems.map((item, index) => (
            <Link key={item.href} href={item.href} className={`${styles.navLinkTop} ${index % 2 === 0 ? styles.navZigUp : styles.navZigDown}`}>
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {activeNews ? (
          <section className={styles.newsStrip}>
            <img src={activeNews.image} alt={activeNews.title || "รูปข่าวห้องพยาบาล"} className={styles.newsStripImage} />
            <div className={styles.newsStripBody}>
              {activeNews.dateText ? <p className={styles.newsStripMeta}>{activeNews.dateText}</p> : null}
              <h2 className={styles.newsStripTitle}>{activeNews.title || "ประกาศล่าสุดจากห้องพยาบาล"}</h2>
              <p className={styles.newsStripText}>{activeNews.detail || "ติดตามข้อมูลล่าสุดได้ที่เมนูข่าว"}</p>
            </div>
            <Link href="/nurse/news" className={`${styles.button} ${styles.btnSoft} ${styles.newsStripButton}`}>
              📰 ดูข่าวทั้งหมด
            </Link>
          </section>
        ) : null}

        <main className={styles.pageWrap}>{children}</main>
      </div>
    </div>
  );
}
