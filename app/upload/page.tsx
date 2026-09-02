"use client";

import { useRef, useState } from "react";

const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || "Aniversário";

type Status = "idle" | "preview" | "uploading" | "success" | "error";

export default function UploadPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFile = useRef<File | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    selectedFile.current = file;
    setPreviewUrl(URL.createObjectURL(file));
    setStatus("preview");
  }

  async function handleSend() {
    if (!selectedFile.current) return;
    setStatus("uploading");
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("photo", selectedFile.current);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Não foi possível enviar a foto.");
      }

      setStatus("success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao enviar.");
      setStatus("error");
    }
  }

  function handleReset() {
    selectedFile.current = null;
    setPreviewUrl(null);
    setStatus("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-6">
      <div className="space-y-1">
        <p className="text-accent-3 tracking-widest uppercase text-xs font-semibold">
          {eventName}
        </p>
        <h1 className="text-2xl font-bold">Compartilhe sua foto! 🎉</h1>
        <p className="text-foreground/60 text-sm max-w-xs mx-auto">
          Sua foto vai aparecer no telão em poucos segundos.
        </p>
      </div>

      {status === "idle" && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="animate-float w-56 h-56 rounded-full bg-gradient-to-br from-accent to-accent-2 flex flex-col items-center justify-center gap-2 text-lg font-semibold shadow-lg shadow-accent/30 active:scale-95 transition-transform"
        >
          <span className="text-5xl">📷</span>
          Tirar / Enviar Foto
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {(status === "preview" || status === "uploading") && previewUrl && (
        <div className="w-full max-w-xs space-y-4">
          <img
            src={previewUrl}
            alt="Prévia da foto"
            className="w-full aspect-square object-cover rounded-2xl border border-white/10"
          />
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={status === "uploading"}
              className="flex-1 rounded-xl border border-white/20 py-3 font-medium disabled:opacity-40"
            >
              Trocar
            </button>
            <button
              onClick={handleSend}
              disabled={status === "uploading"}
              className="flex-1 rounded-xl bg-gradient-to-r from-accent to-accent-2 py-3 font-semibold disabled:opacity-60"
            >
              {status === "uploading" ? "Enviando..." : "Enviar para o telão"}
            </button>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="space-y-6 animate-pop-in">
          <div className="text-6xl">✅</div>
          <p className="text-lg font-semibold">
            Sua foto já está no telão! 🎉
          </p>
          <button
            onClick={handleReset}
            className="rounded-xl bg-gradient-to-r from-accent to-accent-2 px-6 py-3 font-semibold"
          >
            Enviar outra foto
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-4 animate-pop-in">
          <div className="text-5xl">⚠️</div>
          <p className="text-foreground/80">{errorMessage}</p>
          <button
            onClick={handleReset}
            className="rounded-xl border border-white/20 px-6 py-3 font-medium"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </main>
  );
}
