import { NextResponse, type NextRequest } from "next/server";
import { registerUploadedPhoto } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Chamado pelo celular logo depois do envio, para a foto entrar no telão na hora.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const pathname = typeof body?.pathname === "string" ? body.pathname : "";
  const photo = await registerUploadedPhoto(pathname).catch(() => null);
  if (!photo) return NextResponse.json({ error: "Foto não encontrada." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
