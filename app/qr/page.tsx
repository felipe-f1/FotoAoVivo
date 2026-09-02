"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || "Aniversário";

export default function QrPage() {
  const [uploadUrl, setUploadUrl] = useState("");

  useEffect(() => {
    setUploadUrl(`${window.location.origin}/upload`);
  }, []);

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-16 text-center print:bg-white print:text-black">
      <p className="text-accent-3 print:text-black tracking-widest uppercase text-sm font-semibold">
        {eventName}
      </p>
      <h1 className="text-3xl font-bold">Aponte a câmera para o QR Code</h1>
      <p className="text-foreground/60 print:text-black max-w-sm">
        Sua foto aparece direto no telão da festa! 🎉
      </p>

      <div className="bg-white p-6 rounded-3xl">
        {uploadUrl && <QRCodeSVG value={uploadUrl} size={280} />}
      </div>

      <p className="text-foreground/40 print:text-black text-xs break-all max-w-xs">
        {uploadUrl}
      </p>

      <button
        onClick={() => window.print()}
        className="print:hidden rounded-xl border border-white/20 px-6 py-3 font-medium mt-4"
      >
        Imprimir
      </button>
    </main>
  );
}
