import { NextRequest, NextResponse } from "next/server";
import { ensureSeedData, isAllowedEntity, pullEntity, pushEntity } from "@/lib/nurse-drive";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const entity = String(request.nextUrl.searchParams.get("entity") || "").trim();
    if (!entity) {
      return NextResponse.json({ ok: false, error: "ต้องระบุ query entity" }, { status: 400 });
    }

    if (!isAllowedEntity(entity)) {
      return NextResponse.json({ ok: false, error: `entity ไม่รองรับ: ${entity}` }, { status: 400 });
    }

    await ensureSeedData();
    const rows = await pullEntity(entity);
    return NextResponse.json({ ok: true, entity, rows });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "ดึงข้อมูลจาก Google Sheet ไม่สำเร็จ"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      entity?: string;
      rows?: unknown[];
    };

    const entity = String(body.entity || "").trim();
    if (!entity) {
      return NextResponse.json({ ok: false, error: "ต้องส่ง entity" }, { status: 400 });
    }

    if (!isAllowedEntity(entity)) {
      return NextResponse.json({ ok: false, error: `entity ไม่รองรับ: ${entity}` }, { status: 400 });
    }

    const rows = Array.isArray(body.rows)
      ? body.rows.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
      : [];

    await pushEntity(entity, rows);
    return NextResponse.json({ ok: true, entity, count: rows.length });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "บันทึกข้อมูลลง Google Sheet ไม่สำเร็จ"
      },
      { status: 500 }
    );
  }
}
