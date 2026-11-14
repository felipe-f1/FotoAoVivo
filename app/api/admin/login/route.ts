import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  checkPassword,
  isAdminConfigured,
  isAdminRequest,
} from "@/lib/admin-auth";
import { cacheGet, cacheSet } from "@/lib/shared-cache";

const MAX_FAILURES = 8;
const LOCK_SECONDS = 10 * 60;

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "desconhecido"
  );
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    configured: isAdminConfigured(),
    authenticated: isAdminRequest(request),
  });
}

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Defina a variável ADMIN_PASSWORD na Vercel para ativar o painel." },
      { status: 503 }
    );
  }

  // bloqueia quem errar a senha muitas vezes seguidas (proteção contra força bruta)
  const failuresKey = `admin:login-failures:${clientIp(request)}`;
  const failures = (await cacheGet<number>(failuresKey)) ?? 0;
  if (failures >= MAX_FAILURES) {
    return NextResponse.json(
      { error: "Muitas tentativas erradas. Aguarde 10 minutos e tente de novo." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";
  const token = checkPassword(password);
  if (!token) {
    await cacheSet(failuresKey, failures + 1, LOCK_SECONDS);
    // pequena espera para dificultar tentativa e erro em massa
    await new Promise((resolve) => setTimeout(resolve, 800));
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }
  await cacheSet(failuresKey, 0, 1);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
