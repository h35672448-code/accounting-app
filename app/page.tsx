"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type Role = "admin" | "user";
type DocFilterKey = "RE" | "JR" | "JV" | "PP";
type UiTheme = "galaxy" | "eye";

type AccountingRecord = {
  "วันที่": string;
  "รายการ": string;
  "เลขที่เอกสาร": string;
  RE: string;
  JR: string;
  JV: string;
  PP: string;
  "จำนวนเงิน": string;
  Dr: string;
  Cr: string;
  "หมายเหตุ": string;
  [key: string]: string;
};

type FormState = {
  date: string;
  item: string;
  docNo: string;
  RE: string;
  JR: string;
  JV: string;
  PP: string;
  amount: string;
  Dr: string;
  Cr: string;
  note: string;
};

type UserAccount = {
  id: string;
  username: string;
  password: string;
  role: Role;
  createdAt: string;
};

type Session = {
  id: string;
  username: string;
  role: Role;
};

type LoginForm = {
  username: string;
  password: string;
};

type DriverPullResponse = {
  ok?: boolean;
  records?: Record<string, unknown>[];
  error?: string;
};

type DriverPushResponse = {
  ok?: boolean;
  synced?: number;
  emailed?: boolean;
  error?: string;
};

const RECORDS_KEY = "accounting_register_records_v3";
const USERS_KEY = "accounting_register_users_v1";
const SESSION_KEY = "accounting_register_session_v1";
const THEME_KEY = "accounting_register_theme_v3";
const LOGO_CANDIDATES = ["/logo.png", "/logo-accounting.svg", "/logo.svg"] as const;

const FIELD_ORDER = [
  "วันที่",
  "รายการ",
  "เลขที่เอกสาร",
  "RE",
  "JR",
  "JV",
  "PP",
  "จำนวนเงิน",
  "Dr",
  "Cr",
  "หมายเหตุ"
] as const;

const EMPTY_LOGIN_FORM: LoginForm = {
  username: "",
  password: ""
};

const DOC_FILTER_OPTIONS: DocFilterKey[] = ["RE", "JR", "JV", "PP"];

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayISO(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function createEmptyRecordForm(): FormState {
  return {
    date: todayISO(),
    item: "",
    docNo: "",
    RE: "",
    JR: "",
    JV: "",
    PP: "",
    amount: "",
    Dr: "",
    Cr: "",
    note: ""
  };
}

function toDateValue(input: string): number | null {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function normalizeRole(value: unknown): Role {
  const text = String(value ?? "").toLowerCase().trim();
  if (text === "admin" || text.includes("ดูแล")) return "admin";
  return "user";
}

function createDefaultAdmin(): UserAccount {
  return {
    id: createId("user"),
    username: "admin",
    password: "admin1234",
    role: "admin",
    createdAt: new Date().toISOString()
  };
}

function toRecord(form: FormState): AccountingRecord {
  return {
    "วันที่": form.date,
    "รายการ": form.item.trim(),
    "เลขที่เอกสาร": form.docNo.trim(),
    RE: form.RE.trim(),
    JR: form.JR.trim(),
    JV: form.JV.trim(),
    PP: form.PP.trim(),
    "จำนวนเงิน": form.amount.trim(),
    Dr: form.Dr.trim(),
    Cr: form.Cr.trim(),
    "หมายเหตุ": form.note.trim()
  };
}

function normalizeImportedRecord(row: Record<string, unknown>): AccountingRecord {
  const normalized: AccountingRecord = {
    "วันที่": "",
    "รายการ": "",
    "เลขที่เอกสาร": "",
    RE: "",
    JR: "",
    JV: "",
    PP: "",
    "จำนวนเงิน": "",
    Dr: "",
    Cr: "",
    "หมายเหตุ": ""
  };

  FIELD_ORDER.forEach((field) => {
    const value = row[field];
    normalized[field] = value === undefined || value === null ? "" : String(value).trim();
  });

  Object.keys(row).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(normalized, key)) {
      const value = row[key];
      normalized[key] = value === undefined || value === null ? "" : String(value).trim();
    }
  });

  return normalized;
}

function normalizeStoredUser(row: Record<string, unknown>): UserAccount | null {
  const username = String(row.username ?? "").trim();
  const password = String(row.password ?? "").trim();
  if (!username || !password) return null;

  const id = String(row.id ?? createId("user"));
  const createdAt = String(row.createdAt ?? new Date().toISOString());

  return {
    id,
    username,
    password,
    role: normalizeRole(row.role),
    createdAt
  };
}

function readJson<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "เชื่อมต่อ Google Driver ไม่สำเร็จ";
}

export default function Page() {
  const [records, setRecords] = useState<AccountingRecord[]>([]);
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [session, setSession] = useState<Session | null>(null);

  const [recordForm, setRecordForm] = useState<FormState>(createEmptyRecordForm());
  const [loginForm, setLoginForm] = useState<LoginForm>(EMPTY_LOGIN_FORM);

  const [typeFilter, setTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [docFilterKey, setDocFilterKey] = useState<DocFilterKey>("RE");
  const [docFilterText, setDocFilterText] = useState("");

  const [message, setMessage] = useState("✨ พร้อมใช้งานระบบ");
  const [loaded, setLoaded] = useState(false);
  const [logoSrc, setLogoSrc] = useState<string>(LOGO_CANDIDATES[0]);
  const [logoFailed, setLogoFailed] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [theme, setTheme] = useState<UiTheme>("eye");

  useEffect(() => {
    const recordRows = readJson<unknown[]>(localStorage.getItem(RECORDS_KEY), [])
      .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
      .map(normalizeImportedRecord)
      .filter((row) => row["วันที่"] || row["รายการ"]);

    const storedUsers = readJson<unknown[]>(localStorage.getItem(USERS_KEY), [])
      .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
      .map(normalizeStoredUser)
      .filter((row): row is UserAccount => row !== null);

    const initialUsers = storedUsers.length > 0 ? storedUsers : [createDefaultAdmin()];
    setRecords(recordRows);
    setAccounts(initialUsers);

    const storedTheme = localStorage.getItem(THEME_KEY);
    if (storedTheme === "galaxy" || storedTheme === "eye") {
      setTheme(storedTheme);
    }

    const storedSession = readJson<Session | null>(localStorage.getItem(SESSION_KEY), null);
    if (storedSession) {
      const matched = initialUsers.find((user) => user.id === storedSession.id);
      if (matched) {
        setSession({
          id: matched.id,
          username: matched.username,
          role: matched.role
        });
      }
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  }, [records, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(USERS_KEY, JSON.stringify(accounts));
  }, [accounts, loaded]);

  useEffect(() => {
    if (!loaded) return;
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [session, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme, loaded]);

  const handleLogoError = () => {
    setLogoSrc((current) => {
      const index = LOGO_CANDIDATES.indexOf(current as (typeof LOGO_CANDIDATES)[number]);
      if (index < 0 || index >= LOGO_CANDIDATES.length - 1) {
        setLogoFailed(true);
        return current;
      }
      return LOGO_CANDIDATES[index + 1];
    });
  };

  const renderLogo = () => {
    if (logoFailed) {
      return (
        <div className="logo-fallback" role="img" aria-label="โลโก้ระบบบัญชี">
          🏫
        </div>
      );
    }

    return <img src={logoSrc} onError={handleLogoError} alt="โลโก้ระบบบัญชี" width={120} height={120} />;
  };

  const typeOptions = useMemo(() => {
    const unique = new Set<string>();
    records.forEach((record) => {
      const item = record["รายการ"]?.trim();
      if (item) unique.add(item);
    });
    return [...unique].sort((a, b) => a.localeCompare(b, "th"));
  }, [records]);

  const tableColumns = useMemo(() => {
    const keys = [...FIELD_ORDER] as string[];
    records.forEach((record) => {
      Object.keys(record).forEach((key) => {
        if (!keys.includes(key)) keys.push(key);
      });
    });
    return keys;
  }, [records]);

  const filteredRows = useMemo(() => {
    const startValue = toDateValue(startDate);
    const endValue = toDateValue(endDate);
    const text = docFilterText.trim().toLowerCase();

    return records
      .map((record, index) => ({ record, index }))
      .filter(({ record }) => {
        if (typeFilter && record["รายการ"] !== typeFilter) return false;

        if (text) {
          const value = String(record[docFilterKey] ?? "").toLowerCase();
          if (!value.includes(text)) return false;
        }

        const recordDate = toDateValue(record["วันที่"] || "");
        if (startValue !== null && (recordDate === null || recordDate < startValue)) return false;
        if (endValue !== null && (recordDate === null || recordDate > endValue)) return false;

        return true;
      });
  }, [records, typeFilter, docFilterKey, docFilterText, startDate, endDate]);

  const onRecordChange =
    (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setRecordForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const onLoginChange =
    (key: keyof LoginForm) => (event: ChangeEvent<HTMLInputElement>) => {
      setLoginForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const username = loginForm.username.trim();
    const password = loginForm.password;

    if (!username || !password) {
      setMessage("❗ กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    const matched = accounts.find((user) => user.username === username && user.password === password);
    if (!matched) {
      setMessage("⛔ ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      return;
    }

    setSession({
      id: matched.id,
      username: matched.username,
      role: matched.role
    });
    setLoginForm(EMPTY_LOGIN_FORM);
    setMessage(`✅ เข้าสู่ระบบสำเร็จ (${matched.role === "admin" ? "ผู้ดูแล" : "ผู้ใช้"})`);
  };

  const handleLogout = () => {
    setSession(null);
    setRecordForm(createEmptyRecordForm());
    setMessage("👋 ออกจากระบบแล้ว");
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "galaxy" ? "eye" : "galaxy"));
  };

  const themeButtonLabel = theme === "galaxy" ? "🌙 โหมดถนอมสายตา" : "🌈 โหมดกาแล็กซี่";

  const syncRecordsToGoogle = async (
    rows: AccountingRecord[],
    successPrefix: string,
    errorPrefix: string
  ) => {
    setCloudBusy(true);
    try {
      const response = await fetch("/api/google-driver", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ records: rows })
      });

      const result = (await response.json()) as DriverPushResponse;
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "ส่งข้อมูลขึ้น Google ไม่สำเร็จ");
      }

      const synced = typeof result.synced === "number" ? result.synced : rows.length;
      const suffix = result.emailed ? " + ส่งอีเมลแล้ว" : "";
      setMessage(`${successPrefix} (ซิงก์ Google ${synced} รายการ${suffix})`);
      return true;
    } catch (error) {
      setMessage(`${errorPrefix}: ${getErrorMessage(error)}`);
      return false;
    } finally {
      setCloudBusy(false);
    }
  };

  const handleSaveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!recordForm.date) {
      setMessage("❗ กรุณากรอกวันที่ก่อนบันทึก");
      return;
    }

    const nextRecord = toRecord(recordForm);
    const nextRows = [nextRecord, ...records];
    setRecords(nextRows);
    setRecordForm(createEmptyRecordForm());

    await syncRecordsToGoogle(
      nextRows,
      "✅ บันทึกข้อมูลเรียบร้อย",
      "⚠️ บันทึกในเครื่องแล้ว แต่ซิงก์ Google ไม่สำเร็จ"
    );
  };

  const handleShowAll = () => {
    setTypeFilter("");
    setStartDate("");
    setEndDate("");
    setDocFilterKey("RE");
    setDocFilterText("");
    setMessage("🔎 แสดงข้อมูลทั้งหมดเรียบร้อย");
  };

  const handleExportRecords = () => {
    const exportRows = filteredRows.map(({ record }) => {
      const ordered: Record<string, string> = {};
      FIELD_ORDER.forEach((field) => {
        ordered[field] = record[field] ?? "";
      });
      Object.keys(record).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(ordered, key)) {
          ordered[key] = record[key] ?? "";
        }
      });
      return ordered;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AccountingRecords");
    XLSX.writeFile(workbook, "ทะเบียนคุมบันทึกการปรับปรุงรายการบัญชี.xlsx");
    setMessage("📤 ส่งออกข้อมูลรายการสำเร็จ");
  };

  const handleImportRecords = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: false
        });

        const imported = rows
          .map(normalizeImportedRecord)
          .filter((row) => row["วันที่"] || row["รายการ"]);

        setRecords(imported);
        setRecordForm(createEmptyRecordForm());

        await syncRecordsToGoogle(
          imported,
          `📥 นำเข้ารายการสำเร็จ ${imported.length} รายการ`,
          "⚠️ นำเข้าในเครื่องแล้ว แต่ซิงก์ Google ไม่สำเร็จ"
        );
      } catch {
        setMessage("⚠️ ไฟล์รายการไม่ถูกต้อง กรุณาตรวจสอบหัวคอลัมน์");
      }
    };

    reader.readAsArrayBuffer(file);
    event.target.value = "";
  };

  const handlePullFromGoogle = async () => {
    setCloudBusy(true);
    try {
      const response = await fetch("/api/google-driver", {
        method: "GET",
        cache: "no-store"
      });

      const result = (await response.json()) as DriverPullResponse;
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "ดึงข้อมูลจาก Google ไม่สำเร็จ");
      }

      const rows = Array.isArray(result.records) ? result.records : [];
      const imported = rows
        .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
        .map(normalizeImportedRecord)
        .filter((row) => row["วันที่"] || row["รายการ"]);

      setRecords(imported);
      setRecordForm(createEmptyRecordForm());
      setMessage(`☁️ ดึงข้อมูลจาก Google สำเร็จ ${imported.length} รายการ`);
    } catch (error) {
      setMessage(`⚠️ ${getErrorMessage(error)}`);
    } finally {
      setCloudBusy(false);
    }
  };

  if (!session) {
    return (
      <main className="page-shell auth-shell">
        <div className="ambient-scene" aria-hidden="true">
          <span className="orb orb-1" />
          <span className="orb orb-2" />
          <span className="orb orb-3" />
          <span className="planet planet-1" />
          <span className="planet planet-2" />
          <span className="trail trail-1" />
          <span className="trail trail-2" />
          <span className="leaf leaf-1" />
          <span className="leaf leaf-2" />
          <span className="leaf leaf-3" />
          <span className="leaf leaf-4" />
          <span className="leaf leaf-5" />
          <span className="leaf leaf-6" />
        </div>

        <section className="card auth-card fade-up">
          <div className="logo-box auth-logo">{renderLogo()}</div>

          <h1>🔐 เข้าสู่ระบบทะเบียนคุมบัญชี</h1>
          <p className="sub-copy">เข้าสู่ระบบเพื่อใช้งานบันทึกข้อมูลบัญชี</p>

          <div className="action-row auth-action">
            <button type="button" className="btn mode-btn" onClick={handleToggleTheme}>
              {themeButtonLabel}
            </button>
          </div>

          <form className="auth-form" onSubmit={handleLogin} autoComplete="off">
            <label>
              ชื่อผู้ใช้
              <input type="text" value={loginForm.username} onChange={onLoginChange("username")} placeholder="username" />
            </label>
            <label>
              รหัสผ่าน
              <input type="password" value={loginForm.password} onChange={onLoginChange("password")} placeholder="password" />
            </label>
            <button className="btn save-btn" type="submit">
              🔓 เข้าสู่ระบบ
            </button>
          </form>

          <p className="hint">บัญชีเริ่มต้น: `admin` / `admin1234`</p>
          <span className="status-badge">{message}</span>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="ambient-scene" aria-hidden="true">
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
        <span className="planet planet-1" />
        <span className="planet planet-2" />
        <span className="trail trail-1" />
        <span className="trail trail-2" />
        <span className="leaf leaf-1" />
        <span className="leaf leaf-2" />
        <span className="leaf leaf-3" />
        <span className="leaf leaf-4" />
        <span className="leaf leaf-5" />
        <span className="leaf leaf-6" />
      </div>

      <section className="card hero fade-up">
        <div className="logo-box">{renderLogo()}</div>

        <div className="hero-text">
          <h1>📘 ระบบทะเบียนคุมบันทึกการปรับปรุงรายการบัญชี</h1>
          <p>บันทึก • กรอง • โหลดเข้า/ออก Excel และซิงก์ Google</p>

          <div className="session-row">
            <span className={`role-pill ${session.role === "admin" ? "role-admin" : "role-user"}`}>
              {session.role === "admin" ? "👑 ผู้ดูแล" : "🙋 ผู้ใช้"}
            </span>
            <span className="user-name">ผู้ใช้งาน: {session.username}</span>
            <button type="button" className="btn mode-btn" onClick={handleToggleTheme}>
              {themeButtonLabel}
            </button>
            <button type="button" className="btn logout-btn" onClick={handleLogout}>
              🚪 ออกจากระบบ
            </button>
          </div>

          <span className="status-badge">{message}</span>
        </div>
      </section>

      <section className="card fade-up delay-2">
        <h2>🧾 เพิ่มรายการบัญชี</h2>
        <form onSubmit={handleSaveRecord} className="form-stack" autoComplete="off">
          <label>
            วันที่
            <input type="date" value={recordForm.date} onChange={onRecordChange("date")} required />
          </label>
          <label>
            รายการ
            <input type="text" value={recordForm.item} onChange={onRecordChange("item")} placeholder="เช่น ปรับปรุงรายรับ" />
          </label>
          <label>
            เลขที่เอกสาร
            <input type="text" value={recordForm.docNo} onChange={onRecordChange("docNo")} placeholder="DOC-001" />
          </label>
          <label>
            RE
            <input type="text" value={recordForm.RE} onChange={onRecordChange("RE")} placeholder="RE-001" />
          </label>
          <label>
            JR
            <input type="text" value={recordForm.JR} onChange={onRecordChange("JR")} placeholder="JR-001" />
          </label>
          <label>
            JV
            <input type="text" value={recordForm.JV} onChange={onRecordChange("JV")} placeholder="JV-001" />
          </label>
          <label>
            PP
            <input type="text" value={recordForm.PP} onChange={onRecordChange("PP")} placeholder="PP-001" />
          </label>
          <label>
            จำนวนเงิน
            <input type="number" min="0" step="0.01" value={recordForm.amount} onChange={onRecordChange("amount")} placeholder="0.00" />
          </label>
          <label>
            Dr
            <input type="text" value={recordForm.Dr} onChange={onRecordChange("Dr")} placeholder="บัญชีเดบิต" />
          </label>
          <label>
            Cr
            <input type="text" value={recordForm.Cr} onChange={onRecordChange("Cr")} placeholder="บัญชีเครดิต" />
          </label>
          <label>
            หมายเหตุ
            <textarea rows={2} value={recordForm.note} onChange={onRecordChange("note")} placeholder="รายละเอียดเพิ่มเติม" />
          </label>

          <div className="action-row">
            <button type="submit" className="btn save-btn">
              💾 บันทึกข้อมูล
            </button>
          </div>
        </form>
      </section>

      <section className="card fade-up delay-3">
        <h2>🔍 กรองข้อมูล</h2>
        <div className="filter-grid">
          <label>
            ประเภท (รายการ)
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">ทั้งหมด</option>
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            เลือกช่องเอกสาร (4 ตัวเลือก)
            <select value={docFilterKey} onChange={(event) => setDocFilterKey(event.target.value as DocFilterKey)}>
              {DOC_FILTER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            พิมพ์คำค้นเอกสาร
            <input
              type="text"
              value={docFilterText}
              onChange={(event) => setDocFilterText(event.target.value)}
              placeholder={`พิมพ์เพื่อกรอง ${docFilterKey} เช่น ${docFilterKey}-001`}
            />
          </label>
          <label>
            วันที่เริ่มต้น
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            วันที่สิ้นสุด
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>

        <div className="action-row">
          <button type="button" className="btn all-btn" onClick={handleShowAll}>
            🔎 ดูทั้งหมด
          </button>
        </div>
      </section>

      <section className="card fade-up delay-4">
        <h2>📁 โหลดเข้า / โหลดออก ข้อมูลรายการ</h2>
        <div className="action-row">
          <button type="button" className="btn export-btn" onClick={handleExportRecords}>
            📤 โหลดออก Excel
          </button>
          <label className="btn import-btn">
            📥 โหลดเข้า Excel
            <input type="file" accept=".xlsx,.xls" onChange={handleImportRecords} hidden />
          </label>
          <button type="button" className="btn cloud-btn" onClick={handlePullFromGoogle} disabled={cloudBusy}>
            {cloudBusy ? "⏳ กำลังดึง..." : "☁️ ดึงจาก Google"}
          </button>
        </div>
        <p className="hint">ระบบจะซิงก์ขึ้น Google อัตโนมัติทุกครั้งที่บันทึกและนำเข้า แล้วปุ่มนี้ใช้ดึงข้อมูลล่าสุดกลับมา</p>
      </section>

      <section className="card fade-up delay-4">
        <div className="table-head">
          <h2>📊 ตารางรายการบัญชี</h2>
          <span>{filteredRows.length} รายการ</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {tableColumns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="empty" colSpan={tableColumns.length}>
                    ยังไม่มีข้อมูลที่ตรงเงื่อนไข
                  </td>
                </tr>
              ) : (
                filteredRows.map(({ record, index }) => (
                  <tr key={`${record["เลขที่เอกสาร"]}-${index}`}>
                    {tableColumns.map((column) => (
                      <td key={`${column}-${index}`}>{record[column] ?? ""}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
