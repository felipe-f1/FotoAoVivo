import { list, put } from "@vercel/blob";

export const PRESENCE_PREFIX = "presence/";
export const VISITOR_ID_PATTERN = /^[0-9a-f-]{36}$/;
export const ONLINE_WINDOW_MS = 3 * 60 * 1000;

export type PresenceRecord = {
  id: string;
  name: string;
  device: string;
  page: string;
  firstSeen: string;
};

export type Visitor = PresenceRecord & { lastSeen: string };

const KNOWN_PAGES = new Set(["upload", "telao", "album", "qr", "home"]);

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
        : /CriOS|Chrome\//.test(userAgent)
          ? "Chrome"
          : /FxiOS|Firefox\//.test(userAgent)
            ? "Firefox"
            : /Safari\//.test(userAgent)
              ? "Safari"
              : "Navegador";
  return `${os} · ${browser}`;
}

export function sanitizePresence(input: {
  id?: unknown;
  name?: unknown;
  page?: unknown;
  firstSeen?: unknown;
}, userAgent: string): PresenceRecord | null {
  if (typeof input.id !== "string" || !VISITOR_ID_PATTERN.test(input.id)) return null;
  const name =
    typeof input.name === "string" ? input.name.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  const page =
    typeof input.page === "string" && KNOWN_PAGES.has(input.page) ? input.page : "home";
  const firstSeenDate =
    typeof input.firstSeen === "string" ? new Date(input.firstSeen) : new Date();
  const firstSeen = Number.isNaN(firstSeenDate.getTime())
    ? new Date().toISOString()
    : firstSeenDate.toISOString();

  return { id: input.id, name, page, firstSeen, device: describeDevice(userAgent) };
}

export async function savePresence(record: PresenceRecord): Promise<void> {
  await put(`${PRESENCE_PREFIX}${record.id}.json`, JSON.stringify(record), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

export async function listVisitors(): Promise<Visitor[]> {
  const { blobs } = await list({ prefix: PRESENCE_PREFIX, limit: 1000 });

  const visitors = await Promise.all(
    blobs.map(async (blob): Promise<Visitor | null> => {
      try {
        const response = await fetch(blob.url, { cache: "no-store" });
        if (!response.ok) return null;
        const record = (await response.json()) as PresenceRecord;
        // a data do blob é sempre atual, mesmo se o conteúdo vier do cache
        return { ...record, lastSeen: blob.uploadedAt.toISOString() };
      } catch {
        return null;
      }
    })
  );

  return visitors
    .filter((visitor): visitor is Visitor => visitor !== null)
    .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
}
