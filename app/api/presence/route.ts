import { NextResponse, type NextRequest } from "next/server";
import { recordPresence } from "@/lib/presence";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ok = body ? await recordPresence(body, request.headers.get("user-agent") ?? "") : false;
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
