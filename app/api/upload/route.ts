import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { PHOTO_PATH_PATTERN } from "@/lib/storage";

export const dynamic = "force-dynamic";

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
// as fotos são reduzidas no celular antes do envio (~0,5–1,5 MB);
// o limite alto só cobre aparelhos onde a redução não funciona
const MAX_SIZE = 20 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadPresignedBody;

  try {
    const jsonResponse = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        if (!PHOTO_PATH_PATTERN.test(pathname)) {
          throw new Error("Caminho de upload inválido.");
        }

        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_SIZE,
        });

        return { token };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível enviar a foto." },
      { status: 400 }
    );
  }
}
