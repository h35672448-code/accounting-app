"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

type Role = "admin" | "user";
type DocFilterKey = "ALL" | "RE" | "JR" | "JV" | "PP";
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

type UserForm = {
  username: string;
  password: string;
  role: Role;
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

const EMPTY_USER_FORM: UserForm = {
  username: "",
  password: "",
  role: "user"
};

const DOC_FILTER_OPTIONS: Array<{ value: DocFilterKey; label: string }> = [
  { value: "ALL", label: "ทั้งหมด" },
  { value: "RE", label: "RE" },
  { value: "JR", label: "JR" },
  { value: "JV", label: "JV" },
  { value: "PP", label: "PP" }
];

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

function mapRecordToForm(record: AccountingRecord): FormState {
  return {
    date: record["วันที่"] || "",
    item: record["รายการ"] || "",
    docNo: record["เลขที่เอกสาร"] || "",
    RE: record.RE || "",
    JR: record.JR || "",
    JV: record.JV || "",
    PP: record.PP || "",
    amount: record["จำนวนเงิน"] || "",
    Dr: record.Dr || "",
    Cr: record.Cr || "",
    note: record["หมายเหตุ"] || ""
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

function normalizeImportedUser(row: Record<string, unknown>): Omit<UserAccount, "id" | "createdAt"> | null {
  const username = String(row.username ?? row.user ?? "").trim();
  const password = String(row.password ?? row.pass ?? "").trim();
  if (!username || !password) return null;

  return {
    username,
    password,
    role: normalizeRole(row.role)
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

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

export default function Page() {
  const [records, setRecords] = useState<AccountingRecord[]>([]);
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const userImportInputRef = useRef<HTMLInputElement | null>(null);
  const pulledFromDriveRef = useRef(false);

  const [recordForm, setRecordForm] = useState<FormState>(createEmptyRecordForm());
  const [loginForm, setLoginForm] = useState<LoginForm>(EMPTY_LOGIN_FORM);
  const [userForm, setUserForm] = useState<UserForm>(EMPTY_USER_FORM);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [userPanelOpen, setUserPanelOpen] = useState(false);

  const [typeFilter, setTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [docFilterKey, setDocFilterKey] = useState<DocFilterKey>("ALL");
  const [docFilterText, setDocFilterText] = useState("");

  const [message, setMessage] = useState("✨ พร้อมใช้งานระบบ");
  const [loaded, setLoaded] = useState(false);
  const [logoSrc, setLogoSrc] = useState<string>(LOGO_CANDIDATES[0]);
  const [logoFailed, setLogoFailed] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [theme, setTheme] = useState<UiTheme>("eye");
  const isAdmin = session?.role === "admin";

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
    if (!loaded || !session) return;
    const current = accounts.find((user) => user.id === session.id);

    if (!current) {
      setSession(null);
      setMessage("⚠️ บัญชีผู้ใช้ถูกลบออกจากระบบ");
      return;
    }

    if (current.username !== session.username || current.role !== session.role) {
      setSession({
        id: current.id,
        username: current.username,
        role: current.role
      });
    }
  }, [accounts, session, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme, loaded]);

  useEffect(() => {
    if (!loaded || !session || pulledFromDriveRef.current) return;

    pulledFromDriveRef.current = true;
    void pullRecordsFromGoogle(true);
  }, [loaded, session]);

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
          if (docFilterKey === "ALL") {
            const inAnyDocField = ["RE", "JR", "JV", "PP"].some((key) =>
              String(record[key] ?? "").toLowerCase().includes(text)
            );
            if (!inAnyDocField) return false;
          } else {
            const value = String(record[docFilterKey] ?? "").toLowerCase();
            if (!value.includes(text)) return false;
          }
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

  const onUserChange =
    (key: keyof UserForm) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setUserForm((prev) => ({ ...prev, [key]: event.target.value }));
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
    setEditingIndex(null);
    setUserForm(EMPTY_USER_FORM);
    setUserPanelOpen(false);
    pulledFromDriveRef.current = false;
    setMessage("👋 ออกจากระบบแล้ว");
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "galaxy" ? "eye" : "galaxy"));
  };

  const themeButtonLabel = theme === "galaxy" ? "🌙 โหมดถนอมสายตา" : "🌈 โหมดกาแล็กซี่";

  const syncRecordsToGoogle = async (
    rows: AccountingRecord[],
    successPrefix: string,
    errorPrefix: string,
    silentSuccess?: boolean
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

      if (!silentSuccess) {
        const synced = typeof result.synced === "number" ? result.synced : rows.length;
        setMessage(`${successPrefix} (สำรอง Drive ${synced} รายการ)`);
      }
      return true;
    } catch (error) {
      setMessage(`${errorPrefix}: ${getErrorMessage(error)}`);
      return false;
    } finally {
      setCloudBusy(false);
    }
  };

  const pullRecordsFromGoogle = async (silentSuccess?: boolean) => {
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
      setEditingIndex(null);
      setRecordForm(createEmptyRecordForm());
      if (!silentSuccess) {
        setMessage(`☁️ ดึงข้อมูลจาก Drive สำเร็จ ${imported.length} รายการ`);
      }
      return true;
    } catch (error) {
      if (!silentSuccess) {
        setMessage(`⚠️ ${getErrorMessage(error)}`);
      }
      return false;
    } finally {
      setCloudBusy(false);
    }
  };

  const resetRecordForm = () => {
    setRecordForm(createEmptyRecordForm());
    setEditingIndex(null);
  };

  const handleSaveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!recordForm.date) {
      setMessage("❗ กรุณากรอกวันที่ก่อนบันทึก");
      return;
    }

    const nextRecord = toRecord(recordForm);
    const nextRows =
      editingIndex === null
        ? [nextRecord, ...records]
        : records.map((row, idx) => (idx === editingIndex ? nextRecord : row));

    setRecords(nextRows);
    resetRecordForm();

    await syncRecordsToGoogle(
      nextRows,
      editingIndex === null ? "✅ บันทึกข้อมูลเรียบร้อย" : "✅ แก้ไขข้อมูลเรียบร้อย",
      editingIndex === null
        ? "⚠️ บันทึกในเครื่องแล้ว แต่สำรอง Drive ไม่สำเร็จ"
        : "⚠️ แก้ไขในเครื่องแล้ว แต่สำรอง Drive ไม่สำเร็จ"
    );
  };

  const handleShowAll = () => {
    setTypeFilter("");
    setStartDate("");
    setEndDate("");
    setDocFilterKey("ALL");
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
        resetRecordForm();
        await syncRecordsToGoogle(
          imported,
          `📥 นำเข้ารายการสำเร็จ ${imported.length} รายการ`,
          "⚠️ นำเข้าในเครื่องแล้ว แต่สำรอง Drive ไม่สำเร็จ"
        );
      } catch {
        setMessage("⚠️ ไฟล์รายการไม่ถูกต้อง กรุณาตรวจสอบหัวคอลัมน์");
      }
    };

    reader.readAsArrayBuffer(file);
    event.target.value = "";
  };

  const handleOpenImportPicker = () => {
    importInputRef.current?.click();
  };

  const handleEditRecord = (index: number) => {
    if (!isAdmin) {
      setMessage("⛔ ผู้ใช้ทั่วไปไม่มีสิทธิ์แก้ไขข้อมูล");
      return;
    }

    const target = records[index];
    if (!target) return;

    setRecordForm(mapRecordToForm(target));
    setEditingIndex(index);
    setMessage("✏️ กำลังแก้ไขรายการ");
  };

  const handleDeleteRecord = async (index: number) => {
    if (!isAdmin) {
      setMessage("⛔ ผู้ใช้ทั่วไปไม่มีสิทธิ์ลบข้อมูล");
      return;
    }

    const target = records[index];
    if (!target) return;

    const label = target["เลขที่เอกสาร"] || target["รายการ"] || `#${index + 1}`;
    if (!window.confirm(`ยืนยันลบรายการ ${label} ?`)) return;

    const nextRows = records.filter((_, idx) => idx !== index);
    setRecords(nextRows);
    if (editingIndex === index) {
      setRecordForm(createEmptyRecordForm());
    }
    setEditingIndex((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });

    await syncRecordsToGoogle(
      nextRows,
      "🗑️ ลบรายการเรียบร้อย",
      "⚠️ ลบในเครื่องแล้ว แต่สำรอง Drive ไม่สำเร็จ"
    );
  };

  const handleCreateUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAdmin) {
      setMessage("⛔ มีสิทธิ์เฉพาะผู้ดูแลเท่านั้น");
      return;
    }

    const username = userForm.username.trim();
    const password = userForm.password.trim();
    if (!username || !password) {
      setMessage("❗ กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    const exists = accounts.some((user) => user.username.toLowerCase() === username.toLowerCase());
    if (exists) {
      setMessage("⛔ ชื่อผู้ใช้นี้มีอยู่แล้ว");
      return;
    }

    const nextUser: UserAccount = {
      id: createId("user"),
      username,
      password,
      role: userForm.role,
      createdAt: new Date().toISOString()
    };

    setAccounts((prev) => [nextUser, ...prev]);
    setUserForm(EMPTY_USER_FORM);
    setMessage(`👤 เพิ่มผู้ใช้ ${username} เรียบร้อย`);
  };

  const handleDeleteUser = (userId: string) => {
    if (!isAdmin) {
      setMessage("⛔ มีสิทธิ์เฉพาะผู้ดูแลเท่านั้น");
      return;
    }

    if (session?.id === userId) {
      setMessage("⛔ ไม่สามารถลบบัญชีของตัวเองได้");
      return;
    }

    const target = accounts.find((user) => user.id === userId);
    if (!target) return;

    if (!window.confirm(`ยืนยันลบบัญชี ${target.username} ?`)) return;

    setAccounts((prev) => prev.filter((user) => user.id !== userId));
    setMessage(`🗑️ ลบบัญชี ${target.username} เรียบร้อย`);
  };

  const handleExportUsers = () => {
    if (!isAdmin) {
      setMessage("⛔ มีสิทธิ์เฉพาะผู้ดูแลเท่านั้น");
      return;
    }

    const rows = accounts.map((user) => ({
      username: user.username,
      password: user.password,
      role: user.role,
      createdAt: user.createdAt
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
    XLSX.writeFile(workbook, "รายชื่อผู้ใช้ระบบทะเบียนคุมบัญชี.xlsx");
    setMessage("📤 ส่งออกรายชื่อผู้ใช้สำเร็จ");
  };

  const handleOpenUserImportPicker = () => {
    userImportInputRef.current?.click();
  };

  const handleImportUsers = (event: ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      setMessage("⛔ มีสิทธิ์เฉพาะผู้ดูแลเท่านั้น");
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: false
        });

        const imported = rows
          .map(normalizeImportedUser)
          .filter((row): row is Omit<UserAccount, "id" | "createdAt"> => row !== null);

        if (imported.length === 0) {
          setMessage("⚠️ ไม่พบข้อมูลผู้ใช้ที่ถูกต้องในไฟล์");
          return;
        }

        setAccounts((prev) => {
          const byName = new Map<string, UserAccount>();
          prev.forEach((user) => {
            byName.set(user.username.toLowerCase(), user);
          });

          imported.forEach((user) => {
            const key = user.username.toLowerCase();
            const existed = byName.get(key);
            byName.set(key, {
              id: existed?.id ?? createId("user"),
              username: user.username,
              password: user.password,
              role: user.role,
              createdAt: existed?.createdAt ?? new Date().toISOString()
            });
          });

          const nextUsers = [...byName.values()];
          if (!nextUsers.some((user) => user.role === "admin")) {
            nextUsers.unshift(createDefaultAdmin());
          }
          return nextUsers;
        });

        setMessage(`📥 นำเข้าผู้ใช้สำเร็จ ${imported.length} รายการ`);
      } catch {
        setMessage("⚠️ ไฟล์ผู้ใช้ไม่ถูกต้อง");
      }
    };

    reader.readAsArrayBuffer(file);
    event.target.value = "";
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
          <p>บันทึก • โหลดเข้า/ออก Excel</p>

          <div className="session-row">
            <span className={`role-pill ${session.role === "admin" ? "role-admin" : "role-user"}`}>
              {session.role === "admin" ? "👑 ผู้ดูแล" : "🙋 ผู้ใช้"}
            </span>
            <span className="user-name">ผู้ใช้งาน: {session.username}</span>
            {isAdmin && (
              <button type="button" className="btn user-tab-btn" onClick={() => setUserPanelOpen((prev) => !prev)}>
                {userPanelOpen ? "ซ่อนผู้ใช้" : "👥 ผู้ใช้"}
              </button>
            )}
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

      {isAdmin && userPanelOpen && (
        <section className="card secondary-card fade-up delay-1">
          <h2>👥 จัดการผู้ใช้</h2>
          <form onSubmit={handleCreateUser} className="form-stack" autoComplete="off">
            <label>
              ชื่อผู้ใช้ใหม่
              <input type="text" value={userForm.username} onChange={onUserChange("username")} placeholder="new-user" />
            </label>
            <label>
              รหัสผ่าน
              <input type="text" value={userForm.password} onChange={onUserChange("password")} placeholder="password" />
            </label>
            <label>
              สิทธิ์
              <select value={userForm.role} onChange={onUserChange("role")}>
                <option value="user">ผู้ใช้</option>
                <option value="admin">ผู้ดูแล</option>
              </select>
            </label>
            <div className="action-row">
              <button type="submit" className="btn save-btn">
                ➕ เพิ่มผู้ใช้
              </button>
              <button type="button" className="btn export-btn" onClick={handleExportUsers}>
                📤 โหลดออกรายชื่อผู้ใช้
              </button>
              <button type="button" className="btn import-btn" onClick={handleOpenUserImportPicker}>
                📥 นำเข้ารายชื่อผู้ใช้
              </button>
              <input
                ref={userImportInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportUsers}
                hidden
              />
            </div>
          </form>

          <div className="mini-table-wrap">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>ชื่อผู้ใช้</th>
                  <th>สิทธิ์</th>
                  <th>สร้างเมื่อ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.role === "admin" ? "ผู้ดูแล" : "ผู้ใช้"}</td>
                    <td>{formatDateTime(user.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn danger-btn small-btn"
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={session.id === user.id}
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card fade-up delay-2">
        <h2>{editingIndex === null ? "🧾 เพิ่มรายการบัญชี" : "✏️ แก้ไขรายการบัญชี"}</h2>
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
              {editingIndex === null ? "💾 บันทึกข้อมูล" : "✅ อัปเดตรายการ"}
            </button>
            {editingIndex !== null && (
              <button type="button" className="btn muted-btn" onClick={resetRecordForm}>
                ยกเลิกการแก้ไข
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card secondary-card fade-up delay-3">
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
            เลือกช่องเอกสาร
            <select value={docFilterKey} onChange={(event) => setDocFilterKey(event.target.value as DocFilterKey)}>
              {DOC_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
              placeholder={
                docFilterKey === "ALL"
                  ? "พิมพ์เพื่อกรองทุกช่องเอกสาร เช่น RE001 หรือ JV001"
                  : `พิมพ์เพื่อกรอง ${docFilterKey} เช่น ${docFilterKey}-001`
              }
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

      <section className="card secondary-card fade-up delay-4">
        <h2>📁 โหลดเข้า / โหลดออก ข้อมูลรายการ</h2>
        <div className="action-row">
          <button type="button" className="btn export-btn" onClick={handleExportRecords}>
            📤 โหลดออก Excel
          </button>
          <button type="button" className="btn import-btn" onClick={handleOpenImportPicker}>
            📥 นำเข้า Excel
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImportRecords}
            hidden
          />
        </div>
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
                {isAdmin && <th>จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="empty" colSpan={tableColumns.length + (isAdmin ? 1 : 0)}>
                    ยังไม่มีข้อมูลที่ตรงเงื่อนไข
                  </td>
                </tr>
              ) : (
                filteredRows.map(({ record, index }) => (
                  <tr key={`${record["เลขที่เอกสาร"]}-${index}`}>
                    {tableColumns.map((column) => (
                      <td key={`${column}-${index}`}>{record[column] ?? ""}</td>
                    ))}
                    {isAdmin && (
                      <td>
                        <div className="row-action">
                          <button className="btn edit-btn small-btn" type="button" onClick={() => handleEditRecord(index)}>
                            แก้ไข
                          </button>
                          <button className="btn danger-btn small-btn" type="button" onClick={() => void handleDeleteRecord(index)}>
                            ลบ
                          </button>
                        </div>
                      </td>
                    )}
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
