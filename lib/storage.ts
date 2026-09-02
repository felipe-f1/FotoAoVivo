import { put, list } from "@vercel/blob";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type Photo = {
  url: string;
  uploadedAt: string;
};

const BLOB_PREFIX = "photos/";
const LOCAL_DIR = path.join(process.cwd(), "public", "uploads");

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function savePhoto(
  buffer: Buffer,
  contentType: string,
  filename: string
): Promise<string> {
  if (hasBlobToken()) {
    const blob = await put(`${BLOB_PREFIX}${filename}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

export async function listPhotos(): Promise<Photo[]> {
  if (hasBlobToken()) {
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

  await mkdir(LOCAL_DIR, { recursive: true });
  const files = await readdir(LOCAL_DIR);
  const photos = await Promise.all(
    files.map(async (file) => {
      const stats = await stat(path.join(LOCAL_DIR, file));
      return { url: `/uploads/${file}`, uploadedAt: stats.mtime.toISOString() };
    })
  );
  return photos.sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}
