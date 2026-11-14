import { NextResponse } from "next/server";
import { listPhotos } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const photos = await listPhotos();
    // a rota pública só expõe o necessário para telão e álbum
    return NextResponse.json(
      { photos: photos.map(({ url, uploadedAt }) => ({ url, uploadedAt })) },
      {
        headers: {
          // a CDN da Vercel segura a resposta por 3s: 300 celulares abrindo o
          // álbum ao mesmo tempo viram poucas chamadas ao servidor
          "Cache-Control": "public, max-age=0, s-maxage=3, stale-while-revalidate=30",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Fotos indisponíveis no momento." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
