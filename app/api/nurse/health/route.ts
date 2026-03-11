import { NextResponse } from "next/server";
import { checkDriveHealth } from "@/lib/nurse-drive";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await checkDriveHealth();
    return NextResponse.json({
      ok: true,
      provider: "drive",
      mode: "single-port-next",
      ...status
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        provider: "drive",
        mode: "single-port-next",
        error: error instanceof Error ? error.message : "เชื่อมต่อ Apps Script ไม่สำเร็จ"
      },
      { status: 500 }
    );
  }
}
