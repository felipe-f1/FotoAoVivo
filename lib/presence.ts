import { cacheGet, cacheSet } from "@/lib/shared-cache";

// Os acessos ficam no cache da Vercel, não no Blob, para não gastar o limite
// de operações do plano gratuito. Cada instância junta os sinais na memória e
// grava no cache compartilhado no máximo a cada 15s.
export const VISITOR_ID_PATTERN = /^[0-9a-f-]{36}$/;
const PRESENCE_KEY = "presence:all:v1";
const FLUSH_MS = 15_000;
const KEEP_MS = 12 * 60 * 60 * 1000;
const MAX_VISITORS = 3000;

export type Visitor = {
  id: string;
  device: string;
  page: string;
  firstSeen: string;
  lastSeen: string;
};

type VisitorMap = Record<string, Visitor>;

const KNOWN_PAGES = new Set(["upload", "telao", "album", "qr", "home"]);
const pending: VisitorMap = {};
let lastFlush = 0;
let flushing: Promise<void> | null = null;

export function describeDevice(userAgent: string): string {
  const os = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(userAgent)
            ? "Mac"
            : /Linux/.test(userAgent)
              ? "Linux"
              : "Outro";
  const browser = /SamsungBrowser/.test(userAgent)
    ? "Samsung Internet"
    : /Edg\//.test(userAgent)
      ? "Edge"
      : /Instagram/.test(userAgent)
        ? "Instagram"
        : /WhatsApp/.test(userAgent)
          ? "WhatsApp"
          : /CriOS|Chrome\//.test(userAgent)
            ? "Chrome"
            : /FxiOS|Firefox\//.test(userAgent)
              ? "Firefox"
              : /Safari\//.test(userAgent)
                ? "Safari"
                : "Navegador";
  return `${os} · ${browser}`;
}

function merge(target: VisitorMap, incoming: VisitorMap) {
  for (const visitor of Object.values(incoming)) {
    const current = target[visitor.id];
    if (!current) {
      target[visitor.id] = visitor;
      continue;
    }
    target[visitor.id] = {
      ...visitor,
      firstSeen: current.firstSeen < visitor.firstSeen ? current.firstSeen : visitor.firstSeen,
      lastSeen: current.lastSeen > visitor.lastSeen ? current.lastSeen : visitor.lastSeen,
      page: current.lastSeen > visitor.lastSeen ? current.page : visitor.page,
    };
  }
}

function prune(map: VisitorMap): VisitorMap {
  const cutoff = Date.now() - KEEP_MS;
  const kept = Object.values(map)
    .filter((v) => new Date(v.lastSeen).getTime() > cutoff)
    .sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1))
    .slice(0, MAX_VISITORS);
  return Object.fromEntries(kept.map((v) => [v.id, v]));
}

async function flush() {
  flushing ??= (async () => {
    try {
      const batch = { ...pending };
      for (const id of Object.keys(batch)) delete pending[id];
      const shared = (await cacheGet<VisitorMap>(PRESENCE_KEY)) ?? {};
      merge(shared, batch);
      await cacheSet(PRESENCE_KEY, prune(shared), 24 * 60 * 60);
      lastFlush = Date.now();
    } catch {
      // perder um ciclo de presença não é grave; o próximo sinal corrige
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

export async function recordPresence(
  input: { id?: unknown; page?: unknown },
  userAgent: string
): Promise<boolean> {
  if (typeof input.id !== "string" || !VISITOR_ID_PATTERN.test(input.id)) return false;
  const page = typeof input.page === "string" && KNOWN_PAGES.has(input.page) ? input.page : "home";
  const now = new Date().toISOString();

  const existing = pending[input.id];
  pending[input.id] = {
    id: input.id,
    device: describeDevice(userAgent),
    page,
    firstSeen: existing?.firstSeen ?? now,
    lastSeen: now,
  };

  if (Date.now() - lastFlush > FLUSH_MS || Object.keys(pending).length > 200) {
    await flush();
  }
  return true;
}

export async function listVisitors(): Promise<Visitor[]> {
  await flush();
  const shared = (await cacheGet<VisitorMap>(PRESENCE_KEY)) ?? {};
  return Object.values(shared).sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
}
