"use client";

const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.85;
const SKIP_BELOW_BYTES = 900 * 1024;

/**
 * Reduz a foto no próprio celular antes do envio (uma foto de 4–8 MB vira
 * ~0,5–1,5 MB). Envia mais rápido no 4G/Wi-Fi lotado da festa e economiza
 * armazenamento e tráfego. Se o navegador não conseguir, envia o original.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.size < SKIP_BELOW_BYTES && file.type === "image/jpeg") return file;
  if (typeof createImageBitmap !== "function") return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob || blob.size === 0 || blob.size >= file.size) return file;
    return new File([blob], "foto.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
