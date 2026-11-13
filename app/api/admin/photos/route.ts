import { del } from "@vercel/blob";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const VALID_PHOTO_PATH = /^photos\/[\w.-]+$/;

export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const pathnames: unknown[] = Array.isArray(body.pathnames) ? body.pathnames : [];
  const valid = pathnames.filter(
    (p): p is string => typeof p === "string" && VALID_PHOTO_PATH.test(p)
  );
  if (valid.length === 0) {
    return NextResponse.json({ error: "Nenhuma foto válida informada." }, { status: 400 });
  }

  try {
    await del(valid);
    return NextResponse.json({ deleted: valid.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível apagar." },
      { status: 500 }
    );
  }
}
