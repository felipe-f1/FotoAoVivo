import { getCache, type RuntimeCache } from "@vercel/functions";

// Cache compartilhado entre as instâncias da Vercel (Runtime Cache).
// Fora da Vercel, ou se o cache falhar, cai para um Map em memória,
// para o site nunca quebrar por causa do cache.
const memory = new Map<string, { value: unknown; expiresAt: number }>();
let runtime: RuntimeCache | null | undefined;

function getRuntime(): RuntimeCache | null {
  if (runtime !== undefined) return runtime;
  try {
    runtime = getCache({ namespace: "fotoaovivo" });
  } catch {
    runtime = null;
  }
  return runtime;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const cache = getRuntime();
  if (cache) {
    try {
      return ((await cache.get(key)) as T | null) ?? null;
    } catch {
      // segue para a memória local
    }
  }
  const entry = memory.get(key);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.value as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number) {
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  const cache = getRuntime();
  if (!cache) return;
  try {
    await cache.set(key, value, { ttl: ttlSeconds, name: key });
  } catch {
    // a cópia em memória já foi salva
  }
}
