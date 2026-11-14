import { head, list } from "@vercel/blob";
import { cacheGet, cacheSet } from "@/lib/shared-cache";

export type Photo = {
  url: string;
  pathname: string;
  uploadedAt: string;
  visitorId: string | null;
};

const BLOB_PREFIX = "photos/";
export const PHOTO_PATH_PATTERN = /^photos\/[\w-]+\.(jpg|jpeg|png|webp|heic|heif)$/;
// Novos uploads usam photos/<timestamp>_<visitorId>_<uuid>.<ext>
const VISITOR_IN_PATH = /^photos\/\d+_([0-9a-f-]{36})_/;

// No plano gratuito cada list() gasta uma "operação avançada" do Blob
// (limite de 2.000/mês). Por isso a lista fica em cache e é atualizada a cada
// envio/exclusão; o list() completo só roda para reconferir, no máximo a cada 2 min.
const LIST_KEY = "photos:list:v1";
const DELETED_KEY = "photos:deleted:v1";
const RESYNC_MS = 120_000;
const CACHE_TTL_S = 6 * 60 * 60;

type CachedList = { photos: Photo[]; syncedAt: number };

function toPhoto(blob: { url: string; pathname: string; uploadedAt: Date }): Photo {
  return {
    url: blob.url,
    pathname: blob.pathname,
    uploadedAt: blob.uploadedAt.toISOString(),
    visitorId: blob.pathname.match(VISITOR_IN_PATH)?.[1] ?? null,
  };
}

function sortNewestFirst(photos: Photo[]): Photo[] {
  return photos.sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}

async function getDeleted(): Promise<string[]> {
  return (await cacheGet<string[]>(DELETED_KEY)) ?? [];
}

async function listFromBlob(): Promise<Photo[]> {
  const photos: Photo[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: BLOB_PREFIX, limit: 1000, cursor });
    photos.push(...page.blobs.map(toPhoto));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return sortNewestFirst(photos);
}

let inflightSync: Promise<Photo[]> | null = null;

async function syncFromBlob(): Promise<Photo[]> {
  // evita várias consultas simultâneas na mesma instância
  inflightSync ??= (async () => {
    try {
      const deleted = new Set(await getDeleted());
      const photos = (await listFromBlob()).filter((p) => !deleted.has(p.pathname));
      await cacheSet(LIST_KEY, { photos, syncedAt: Date.now() } satisfies CachedList, CACHE_TTL_S);
      return photos;
    } finally {
      inflightSync = null;
    }
  })();
  return inflightSync;
}

export async function listPhotos(): Promise<Photo[]> {
  const cached = await cacheGet<CachedList>(LIST_KEY);
  if (cached && Date.now() - cached.syncedAt < RESYNC_MS) return cached.photos;
  try {
    return await syncFromBlob();
  } catch (error) {
    // se o Blob falhar, continua servindo a última lista conhecida
    if (cached) return cached.photos;
    throw error;
  }
}

/** Registra uma foto recém-enviada sem precisar listar o Blob inteiro. */
export async function registerUploadedPhoto(pathname: string): Promise<Photo | null> {
  if (!PHOTO_PATH_PATTERN.test(pathname)) return null;
  // head() confirma que a foto existe mesmo (operação simples, mais barata)
  const blob = await head(pathname).catch(() => null);
  if (!blob) return null;

  const photo = toPhoto({ url: blob.url, pathname: blob.pathname, uploadedAt: blob.uploadedAt });
  const cached = await cacheGet<CachedList>(LIST_KEY);
  if (!cached) {
    await syncFromBlob().catch(() => {});
    return photo;
  }
  if (!cached.photos.some((p) => p.pathname === photo.pathname)) {
    await cacheSet(
      LIST_KEY,
      { photos: sortNewestFirst([photo, ...cached.photos]), syncedAt: cached.syncedAt },
      CACHE_TTL_S
    );
  }
  return photo;
}

/** Tira fotos apagadas da lista em cache (e impede que voltem numa reconferência). */
export async function forgetPhotos(pathnames: string[]) {
  const deleted = new Set([...(await getDeleted()), ...pathnames]);
  await cacheSet(DELETED_KEY, [...deleted].slice(-2000), CACHE_TTL_S);
  const cached = await cacheGet<CachedList>(LIST_KEY);
  if (cached) {
    await cacheSet(
      LIST_KEY,
      { photos: cached.photos.filter((p) => !deleted.has(p.pathname)), syncedAt: cached.syncedAt },
      CACHE_TTL_S
    );
  }
}
