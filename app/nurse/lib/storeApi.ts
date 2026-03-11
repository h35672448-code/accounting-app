export type StoreRow = Record<string, unknown>;

type StoreResponse = {
  ok?: boolean;
  rows?: StoreRow[];
  error?: string;
};

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
