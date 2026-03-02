import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type DriverResponse = {
  ok?: boolean;
  records?: unknown[];
  synced?: number;
  emailed?: boolean;
  error?: string;
};

function getConfig() {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL?.trim();
  const token = process.env.GOOGLE_SCRIPT_TOKEN?.trim() || "";
  const notifyEmail = process.env.GOOGLE_NOTIFY_EMAIL?.trim() || "";

  if (!scriptUrl) {
    throw new Error("ยังไม่ได้ตั้ง GOOGLE_SCRIPT_URL ใน .env.local");
  }

  return { scriptUrl, token, notifyEmail };
}

async function parseDriverResponse(response: Response): Promise<DriverResponse> {
  const text = await response.text();

  try {
    return JSON.parse(text) as DriverResponse;
  } catch {
    return {
      ok: false,
      error: `Google Driver ไม่ได้ตอบกลับเป็น JSON: ${text.slice(0, 160)}`
    };
  }
}

export async function GET() {
  try {
    const { scriptUrl, token } = getConfig();
    const url = new URL(scriptUrl);
    url.searchParams.set("action", "pullRecords");
    if (token) url.searchParams.set("token", token);

    const driverResponse = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store"
    });

    const driverData = await parseDriverResponse(driverResponse);
    if (!driverResponse.ok || !driverData.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: driverData.error || "Google Driver ตอบกลับไม่สำเร็จ"
        },
        { status: 502 }
      );
    }

    const records = Array.isArray(driverData.records) ? driverData.records : [];
    return NextResponse.json({ ok: true, records });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "เชื่อมต่อ Google Driver ไม่สำเร็จ"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { scriptUrl, token, notifyEmail } = getConfig();
    const body = (await request.json().catch(() => ({}))) as {
      records?: unknown[];
    };
    const records = Array.isArray(body.records) ? body.records : [];


    const payload: Record<string, unknown> = {
      action: "pushRecords",
      records
    };

    if (token) {
      payload.token = token;
    }
    if (notifyEmail) {
      payload.notifyEmail = notifyEmail;
    }

    const driverResponse = await fetch(scriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    const driverData = await parseDriverResponse(driverResponse);
    if (!driverResponse.ok || !driverData.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: driverData.error || "Google Driver ตอบกลับไม่สำเร็จ"
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      synced: typeof driverData.synced === "number" ? driverData.synced : records.length,
      emailed: Boolean(driverData.emailed)
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "เชื่อมต่อ Google Driver ไม่สำเร็จ"
      },
      { status: 500 }
    );
  }
}
