import nurseSeedData from "@/nurse-system/sql/drive-seed.json";

export const NURSE_ALLOWED_ENTITIES = [
  "users",
  "students",
  "medicines",
  "visits",
  "visit_medicines",
  "medicine_stock_logs",
  "news",
  "feedback",
  "alerts",
  "audit_logs"
] as const;

export type NurseEntity = (typeof NURSE_ALLOWED_ENTITIES)[number];
export type NurseRow = Record<string, unknown>;

type DriveResponse = {
  ok?: boolean;
  error?: string;
  rows?: NurseRow[];
  service?: string;
  updatedAt?: string;
};

type NurseSeed = Partial<Record<NurseEntity, NurseRow[]>>;

const allowedEntitySet = new Set<string>(NURSE_ALLOWED_ENTITIES);
const parsedSeed = nurseSeedData as NurseSeed;
let seedPromise: Promise<void> | null = null;

function getConfig() {
  const scriptUrl = (process.env.NURSE_SCRIPT_URL || process.env.GOOGLE_SCRIPT_URL || "").trim();
  const token = (process.env.NURSE_SCRIPT_TOKEN || process.env.GOOGLE_SCRIPT_TOKEN || "").trim();

  if (!scriptUrl) {
    throw new Error("ยังไม่ได้ตั้งค่า NURSE_SCRIPT_URL (หรือ GOOGLE_SCRIPT_URL) ใน .env.local");
  }

  return { scriptUrl, token };
}

function assertEntity(entity: string): asserts entity is NurseEntity {
  if (!allowedEntitySet.has(entity)) {
    throw new Error(`ไม่รองรับ entity: ${entity}`);
  }
}

async function parseDriveResponse(response: Response): Promise<DriveResponse> {
  const text = await response.text();
  try {
    return JSON.parse(text) as DriveResponse;
  } catch {
    return {
      ok: false,
      error: `Apps Script ไม่ได้ตอบกลับเป็น JSON: ${text.slice(0, 160)}`
    };
  }
}

async function callDriveGet(action: string, extraParams: Record<string, string> = {}) {
  const { scriptUrl, token } = getConfig();
  const url = new URL(scriptUrl);
  url.searchParams.set("action", action);
  if (token) url.searchParams.set("token", token);

  for (const [key, value] of Object.entries(extraParams)) {
    if (value !== "") url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store"
  });

  const data = await parseDriveResponse(response);
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `Apps Script GET ล้มเหลว (${response.status})`);
  }

  return data;
}

async function callDrivePost(payload: Record<string, unknown>) {
  const { scriptUrl, token } = getConfig();
  const body = token ? { ...payload, token } : payload;

  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const data = await parseDriveResponse(response);
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `Apps Script POST ล้มเหลว (${response.status})`);
  }

  return data;
}

export async function pullEntity(entity: string): Promise<NurseRow[]> {
  assertEntity(entity);
  const data = await callDriveGet("pullEntity", { entity });
  return Array.isArray(data.rows) ? data.rows : [];
}

export async function pushEntity(entity: string, rows: NurseRow[]): Promise<void> {
  assertEntity(entity);
  await callDrivePost({
    action: "pushEntity",
    entity,
    rows
  });
}

async function seedEntityIfEmpty(entity: NurseEntity, rows: NurseRow[]) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const current = await pullEntity(entity);
  if (current.length > 0) return;
  await pushEntity(entity, rows);
}

async function runSeed() {
  for (const entity of NURSE_ALLOWED_ENTITIES) {
    const rows = parsedSeed[entity];
    if (!rows) continue;
    await seedEntityIfEmpty(entity, rows);
  }
}

export async function ensureSeedData() {
  if ((process.env.NURSE_AUTO_SEED || "1") !== "1") return;

  if (!seedPromise) {
    seedPromise = runSeed().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }

  await seedPromise;
}

export async function checkDriveHealth() {
  const data = await callDriveGet("health");
  return {
    service: data.service || "nurse-drive-store",
    updatedAt: data.updatedAt || new Date().toISOString()
  };
}

export function isAllowedEntity(entity: string) {
  return allowedEntitySet.has(entity);
}
