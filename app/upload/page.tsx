"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/compress-image";
import { addToQueue, listQueue, processQueue } from "@/lib/upload-queue";
import { getVisitorId, newId, usePresence } from "@/lib/use-presence";
import PhotoEditor from "./photo-editor";

const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || "Aniversário";

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

type Status = "idle" | "preview" | "uploading" | "success" | "queued" | "error";

const RETRY_EVERY_MS = 10_000;

export default function UploadPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const selectedFile = useRef<File | null>(null);
  const [editingFile, setEditingFile] = useState<File | null>(null);

  const [pendingCount, setPendingCount] = useState(0);
  const [retrying, setRetrying] = useState(false);

  usePresence("upload");

  const flushQueue = useCallback(async () => {
    const { sent, pending } = await processQueue().catch(() => ({ sent: 0, pending: -1 }));
    if (pending >= 0) setPendingCount(pending);
    // a foto que estava esperando sinal acabou de subir
    if (pending === 0) setStatus((current) => (current === "queued" ? "success" : current));
    return { sent, pending };
  }, []);

  // fotos guardadas sem sinal sobem sozinhas: ao abrir a página, quando a
  // internet volta, quando a pessoa volta para a aba e a cada 10s
  // guarda a página no celular para ela abrir mesmo sem sinal
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    listQueue()
      .then((queue) => {
        setPendingCount(queue.length);
        if (queue.length > 0) flushQueue();
      })
      .catch(() => {});

    const retry = () => {
      if (document.visibilityState === "visible") flushQueue();
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", retry);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [flushQueue]);

  useEffect(() => {
    if (pendingCount === 0) return;
    const interval = setInterval(flushQueue, RETRY_EVERY_MS);
    return () => clearInterval(interval);
  }, [pendingCount, flushQueue]);

  async function handleRetryNow() {
    setRetrying(true);
    await flushQueue();
    setRetrying(false);
  }

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
      const file = await compressImage(selectedFile.current);
      const extension = EXTENSION_BY_TYPE[file.type] ?? "jpg";
      const id = newId();
      const pathname = `photos/${Date.now()}_${getVisitorId()}_${id}.${extension}`;

      // primeiro guarda no celular: assim a foto nunca se perde, mesmo sem sinal
      await addToQueue({ id, pathname, blob: file, type: file.type || "image/jpeg", createdAt: Date.now() });
      const { pending } = await flushQueue();
      setStatus(pending === 0 ? "success" : "queued");
    } catch {
      setErrorMessage("Não foi possível preparar a foto. Tente escolher outra.");
      setStatus("error");
    }
  }

  function handleEdited(edited: File) {
    selectedFile.current = edited;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(edited));
    setEditingFile(null);
  }

  function handleReset() {
    setEditingFile(null);
    selectedFile.current = null;
    setPreviewUrl(null);
    setStatus("idle");
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
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

      {pendingCount > 0 && status !== "queued" && (
        <div className="w-full max-w-xs rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm space-y-2">
          <p>
            📤 {pendingCount} foto{pendingCount === 1 ? "" : "s"} aguardando sinal. Vai
            {pendingCount === 1 ? "" : "o"} subir sozinha{pendingCount === 1 ? "" : "s"} quando a
            internet voltar.
          </p>
          <button
            onClick={handleRetryNow}
            disabled={retrying}
            className="w-full rounded-lg border border-amber-400/40 py-2 font-medium disabled:opacity-50"
          >
            {retrying ? "Tentando…" : "Tentar enviar agora"}
          </button>
        </div>
      )}

      {status === "idle" && (
        <div className="flex flex-col items-center gap-5">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="animate-float w-56 h-56 rounded-full bg-gradient-to-br from-accent to-accent-2 flex flex-col items-center justify-center gap-2 text-lg font-semibold shadow-lg shadow-accent/30 active:scale-95 transition-transform"
          >
            <span className="text-5xl">📷</span>
            Tirar Foto
          </button>
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="w-56 rounded-xl border border-white/20 py-3 font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <span className="text-xl">🖼️</span>
            Escolher da galeria
          </button>
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {(status === "preview" || status === "uploading") && previewUrl && (
        <div className="w-full max-w-xs space-y-4">
          <img
            src={previewUrl}
            alt="Prévia da foto"
            className="w-full max-h-[55vh] object-contain rounded-2xl border border-white/10 bg-black/20"
          />
          <button
            onClick={() => setEditingFile(selectedFile.current)}
            disabled={status === "uploading"}
            className="w-full rounded-xl border border-white/20 py-3 font-medium flex items-center justify-center gap-2 disabled:opacity-40"
          >
            ✏️ Editar foto
          </button>
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
              {status === "uploading" ? "Enviando…" : "Enviar para o telão"}
            </button>
          </div>
        </div>
      )}

      {editingFile && status === "preview" && (
        <PhotoEditor
          file={editingFile}
          onDone={handleEdited}
          onCancel={() => setEditingFile(null)}
        />
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

      {status === "queued" && (
        <div className="space-y-5 animate-pop-in max-w-xs">
          <div className="text-6xl">📦</div>
          <p className="text-lg font-semibold">Foto guardada no seu celular!</p>
          <p className="text-sm text-foreground/70">
            O sinal está fraco agora. Ela vai para o telão sozinha assim que a internet
            voltar — deixe esta página aberta.
          </p>
          <button
            onClick={handleRetryNow}
            disabled={retrying}
            className="w-full rounded-xl border border-white/20 py-3 font-medium disabled:opacity-50"
          >
            {retrying ? "Tentando…" : "Tentar enviar agora"}
          </button>
          <button
            onClick={handleReset}
            className="w-full rounded-xl bg-gradient-to-r from-accent to-accent-2 py-3 font-semibold"
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
