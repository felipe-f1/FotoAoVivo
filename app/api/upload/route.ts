import { NextRequest, NextResponse } from "next/server";
import { savePhoto } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MAX_SIZE = 15 * 1024 * 1024;
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("photo");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Nenhuma foto enviada." }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Foto muito grande (máx. 15MB)." }, { status: 400 });
  }

  const extension = EXTENSION_BY_TYPE[file.type] ?? "jpg";
  const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const url = await savePhoto(buffer, file.type || "image/jpeg", filename);

  return NextResponse.json({ url });
}
