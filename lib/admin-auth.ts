import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "fotoaovivo_admin";
export const ADMIN_SESSION_SECONDS = 60 * 60 * 24; // 24h

function getPassword(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  return password && password.length > 0 ? password : null;
}

// O cookie guarda um hash derivado da senha: trocar a senha na Vercel
// derruba todas as sessões abertas.
function sessionToken(password: string): string {
  return createHash("sha256").update(`fotoaovivo-admin:${password}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function isAdminConfigured(): boolean {
  return getPassword() !== null;
}

export function checkPassword(attempt: string): string | null {
  const password = getPassword();
  if (!password || !safeEqual(attempt, password)) return null;
  return sessionToken(password);
}

export function isAdminRequest(request: NextRequest): boolean {
  const password = getPassword();
  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!password || !cookie) return false;
  return safeEqual(cookie, sessionToken(password));
}
