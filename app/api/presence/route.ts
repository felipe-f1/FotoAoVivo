import { NextResponse, type NextRequest } from "next/server";
import { sanitizePresence, savePresence } from "@/lib/presence";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const record = body
    ? sanitizePresence(body, request.headers.get("user-agent") ?? "")
    : null;
  if (!record) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  try {
    await savePresence(record);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Falha ao registrar acesso." }, { status: 500 });
  }
}
