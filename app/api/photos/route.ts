import { NextResponse } from "next/server";
import { listPhotos } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const photos = await listPhotos();
  return NextResponse.json({ photos });
}
