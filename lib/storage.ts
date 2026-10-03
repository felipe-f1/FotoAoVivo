import { list } from "@vercel/blob";

export type Photo = {
  url: string;
  uploadedAt: string;
};

const BLOB_PREFIX = "photos/";

export async function listPhotos(): Promise<Photo[]> {
  const { blobs } = await list({ prefix: BLOB_PREFIX, limit: 1000 });
  return blobs
    .map((blob) => ({
      url: blob.url,
      uploadedAt: blob.uploadedAt.toISOString(),
    }))
    .sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
}
