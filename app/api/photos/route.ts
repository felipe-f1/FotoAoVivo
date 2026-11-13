import { NextResponse } from "next/server";
import { listPhotos } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const photos = await listPhotos();
  // a rota pública só expõe o necessário para telão e álbum
  return NextResponse.json({
    photos: photos.map(({ url, uploadedAt }) => ({ url, uploadedAt })),
  });
}
