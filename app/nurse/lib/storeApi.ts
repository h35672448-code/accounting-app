export type StoreRow = Record<string, unknown>;

type NurseSessionRole = "admin" | "user";

type StoreResponse = {
  ok?: boolean;
  rows?: StoreRow[];
  error?: string;
};

const NURSE_SESSION_STORAGE_KEY = "nurse_current_user";

function isBrowser() {
  return typeof window !== "undefined";
}

function getSessionRole(): NurseSessionRole | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(NURSE_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { role?: unknown };
    return parsed.role === "admin" || parsed.role === "user" ? parsed.role : null;
  } catch {
    return null;
  }
}

export function canWriteEntity(entity: string) {
  const role = getSessionRole();
  if (!role) return false;
  if (entity === "users") return role === "admin";
  return role === "admin" || role === "user";
}

function assertCanWriteEntity(entity: string) {
  const role = getSessionRole();
  if (!role) {
    throw new Error("กรุณาเข้าสู่ระบบผู้ดูแลหรือผู้ใช้ก่อนบันทึกข้อมูล");
  }

  if (entity === "users" && role !== "admin") {
    throw new Error("เฉพาะผู้ดูแลเท่านั้นที่เพิ่ม แก้ไข หรือลบผู้ใช้ได้");
  }
}

async function parseJson(response: Response): Promise<StoreResponse> {
  const text = await response.text();
  try {
    return JSON.parse(text) as StoreResponse;
  } catch {
    return {
      ok: false,
      error: `API ตอบกลับไม่ใช่ JSON: ${text.slice(0, 160)}`
    };
  }
}

export async function fetchEntity(entity: string): Promise<StoreRow[]> {
  const response = await fetch(`/api/nurse/store?entity=${encodeURIComponent(entity)}`, {
    method: "GET",
    cache: "no-store"
  });

  const data = await parseJson(response);
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `ดึงข้อมูล ${entity} ไม่สำเร็จ`);
  }

  return Array.isArray(data.rows) ? data.rows : [];
}

export async function saveEntity(entity: string, rows: StoreRow[]): Promise<void> {
  assertCanWriteEntity(entity);

  const response = await fetch("/api/nurse/store", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ entity, rows }),
    cache: "no-store"
  });

  const data = await parseJson(response);
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `บันทึกข้อมูล ${entity} ไม่สำเร็จ`);
  }
}
