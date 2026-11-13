import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { listVisitors } from "@/lib/presence";
import { listPhotos } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const [photos, visitors] = await Promise.all([listPhotos(), listVisitors()]);
  return NextResponse.json({ photos, visitors, now: new Date().toISOString() });
}
