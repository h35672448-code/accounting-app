"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import styles from "./nurse.module.css";
import { NURSE_SESSION_STORAGE_KEY, getCurrentRole } from "./lib/auth";

type ThemeMode = "warm" | "mono";
type NewsRow = Record<string, unknown>;

type NewsBanner = {
  id: number;
  title: string;
  detail: string;
  image: string;
  dateText: string;
};
type UiLang = "th" | "en";

const THEME_STORAGE_KEY = "nurse_theme_mode";
const LANG_STORAGE_KEY = "nurse_ui_lang";
const NEWS_ROTATE_MS = 30_000;
const NEWS_FALLBACK_IMAGE = "/logo.png";

const fullNavItems = [
  { href: "/nurse", icon: "🏠", label: { th: "Home", en: "Home" } },
  { href: "/nurse/dashboard", icon: "📊", label: { th: "Dashboard", en: "Dashboard" } },
  { href: "/nurse/treatment", icon: "🧾", label: { th: "ประวัติ", en: "History" } },
  { href: "/nurse/queue", icon: "📋", label: { th: "คิวผู้ป่วย", en: "Queue" } },
  { href: "/nurse/symptom", icon: "🩺", label: { th: "แจ้งอาการ", en: "Symptoms" } },
  { href: "/nurse/students", icon: "🎓", label: { th: "นักศึกษา", en: "Students" } },
  { href: "/nurse/medicines", icon: "💊", label: { th: "คลังยา", en: "Medicines" } },
  { href: "/nurse/news", icon: "📰", label: { th: "ข่าว", en: "News" } },
  { href: "/nurse/review", icon: "💬", label: { th: "ประเมิน", en: "Reviews" } },
  { href: "/nurse/video", icon: "📹", label: { th: "วิดีโอคอล", en: "Video Call" } },
  { href: "/nurse/login", icon: "🔐", label: { th: "Login", en: "Login" } }
];

function shiftByHour(hour: number, language: UiLang) {
  if (language === "en") {
    if (hour < 12) return "Morning Shift 08:00-12:00";
    if (hour < 16) return "Afternoon Shift 12:00-16:00";
    return "Evening Shift 16:00-20:00";
  }
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
  const router = useRouter();
  const [mode, setMode] = useState<ThemeMode>("warm");
  const [language, setLanguage] = useState<UiLang>("th");
  const [isAdminView, setIsAdminView] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [newsList, setNewsList] = useState<NewsBanner[]>([]);
  const [newsIndex, setNewsIndex] = useState(0);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "mono" || stored === "warm") {
      setMode(stored);
    }

    const storedLang = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (storedLang === "th" || storedLang === "en") {
      setLanguage(storedLang);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    window.localStorage.setItem(LANG_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    function syncRoleFromStorage() {
      const role = getCurrentRole();
      setIsAdminView(role === "admin");
    }

    syncRoleFromStorage();
    window.addEventListener("storage", syncRoleFromStorage);
    window.addEventListener("focus", syncRoleFromStorage);
    return () => {
      window.removeEventListener("storage", syncRoleFromStorage);
      window.removeEventListener("focus", syncRoleFromStorage);
    };
  }, []);

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
      now.toLocaleDateString(language === "th" ? "th-TH" : "en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }),
    [language, now]
  );

  const timeText = useMemo(
    () =>
      now.toLocaleTimeString(language === "th" ? "th-TH" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }),
    [language, now]
  );

  const activeNews = newsList[newsIndex];
  const navItems = fullNavItems;

  return (
    <div className={`${styles.root} ${mode === "mono" ? styles.themeMono : styles.themeWarm}`}>
      <div className={styles.backdrop} />

      <div className={styles.layoutShell}>
        <header className={styles.topHeader}>
          <div className={styles.logoBlock}>
            <img src="/logo.png" alt="โลโก้ห้องพยาบาล" className={styles.logoImage} />
            <div>
              <h1 className={styles.brandTitle}>{language === "th" ? "ระบบห้องพยาบาล" : "Nurse Room System"}</h1>
              <p className={styles.brandSub}>Nurse Room Management</p>
            </div>
          </div>

          <div className={styles.topRight}>
            <div className={styles.timeCard}>
              <p className={styles.timeDate}>{dateText}</p>
              <p className={styles.timeValue}>
                {timeText}
                {language === "th" ? " น." : ""}
              </p>
              <p className={styles.timeShift}>👩‍⚕️ {shiftByHour(now.getHours(), language)}</p>
            </div>
            <div className={styles.userChip}>{isAdminView ? (language === "th" ? "👤 ผู้ดูแล" : "👤 Admin") : language === "th" ? "👤 ผู้ใช้" : "👤 User"}</div>
          </div>
        </header>

        <nav className={styles.topNav}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLinkTop}>
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label[language]}</span>
            </Link>
          ))}
        </nav>

        {activeNews ? (
          <section className={styles.newsStrip}>
            <img src={activeNews.image} alt={activeNews.title || "รูปข่าวห้องพยาบาล"} className={styles.newsStripImage} />
            <div className={styles.newsStripBody}>
              {activeNews.dateText ? <p className={styles.newsStripMeta}>{activeNews.dateText}</p> : null}
              <h2 className={styles.newsStripTitle}>{activeNews.title || (language === "th" ? "ประกาศล่าสุดจากห้องพยาบาล" : "Latest Nurse Room Announcement")}</h2>
              <p className={styles.newsStripText}>{activeNews.detail || (language === "th" ? "ติดตามข้อมูลล่าสุดได้ที่เมนูข่าว" : "Follow the latest updates from the News menu.")}</p>
            </div>
            <Link href="/nurse/news" className={`${styles.button} ${styles.btnSoft} ${styles.newsStripButton}`}>
              {language === "th" ? "📰 ดูข่าวทั้งหมด" : "📰 View All News"}
            </Link>
          </section>
        ) : null}

        <main className={styles.pageWrap}>{children}</main>
      </div>

      <div className={styles.bottomDock}>
        <button
          type="button"
          className={styles.iconDockButton}
          onClick={() => setMode((prev) => (prev === "warm" ? "mono" : "warm"))}
          aria-label={mode === "warm" ? (language === "th" ? "สลับเป็นโหมดขาวดำ" : "Switch to monochrome mode") : language === "th" ? "สลับเป็นโหมดสีอุ่น" : "Switch to warm mode"}
          title={mode === "warm" ? (language === "th" ? "โหมดขาวดำ" : "Monochrome") : language === "th" ? "โหมดสีอุ่น" : "Warm"}
        >
          💡
        </button>
        <button
          type="button"
          className={styles.iconDockButton}
          onClick={() => setLanguage((prev) => (prev === "th" ? "en" : "th"))}
          aria-label="สลับภาษา"
          title={language === "th" ? "ภาษาไทย" : "English"}
        >
          🌐
        </button>
        {isAdminView ? (
          <Link href="/nurse/users" className={styles.iconDockLink} title={language === "th" ? "เพิ่มผู้ใช้" : "Add Users"}>
            👥
          </Link>
        ) : null}
        <button
          type="button"
          className={styles.iconDockButton}
          onClick={() => {
            window.localStorage.removeItem(NURSE_SESSION_STORAGE_KEY);
            setIsAdminView(false);
            router.push("/nurse/login");
          }}
          aria-label={language === "th" ? "ออกจากระบบ" : "Logout"}
          title={language === "th" ? "ออกจากระบบ" : "Logout"}
        >
          🚪
        </button>
      </div>
    </div>
  );
}
