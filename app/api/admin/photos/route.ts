import { del } from "@vercel/blob";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { forgetPhotos, PHOTO_PATH_PATTERN } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const pathnames: unknown[] = Array.isArray(body.pathnames) ? body.pathnames.slice(0, 200) : [];
  const valid = pathnames.filter(
    (p): p is string => typeof p === "string" && PHOTO_PATH_PATTERN.test(p)
  );
  if (valid.length === 0) {
    return NextResponse.json({ error: "Nenhuma foto válida informada." }, { status: 400 });
  }

  try {
    // tira do telão primeiro (instantâneo), depois apaga o arquivo
    await forgetPhotos(valid);
    await del(valid);
    return NextResponse.json({ deleted: valid.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível apagar." },
      { status: 500 }
    );
  }
}
