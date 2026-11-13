import { list } from "@vercel/blob";

export type Photo = {
  url: string;
  pathname: string;
  uploadedAt: string;
  visitorId: string | null;
};

const BLOB_PREFIX = "photos/";

// Novos uploads usam photos/<timestamp>_<visitorId>_<uuid>.<ext>;
// fotos antigas (photos/<timestamp>-<uuid>.<ext>) ficam sem visitante.
const VISITOR_IN_PATH = /^photos\/\d+_([0-9a-f-]{36})_/;

export async function listPhotos(): Promise<Photo[]> {
  const { blobs } = await list({ prefix: BLOB_PREFIX, limit: 1000 });
  return blobs
    .map((blob) => ({
      url: blob.url,
      pathname: blob.pathname,
      uploadedAt: blob.uploadedAt.toISOString(),
      visitorId: blob.pathname.match(VISITOR_IN_PATH)?.[1] ?? null,
    }))
    .sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
}
