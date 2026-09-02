"use client";

import { useEffect, useState } from "react";

const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || "Aniversário";
const POLL_INTERVAL_MS = 4000;
const MAX_VISIBLE = 25;

type Photo = {
  url: string;
  uploadedAt: string;
};

export default function TelaoPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchPhotos() {
      try {
        const response = await fetch("/api/photos", { cache: "no-store" });
        const data = await response.json();
        if (!cancelled && Array.isArray(data.photos)) {
          setPhotos(data.photos.slice(0, MAX_VISIBLE));
        }
      } catch {
        // ignora falhas pontuais de rede e tenta de novo no próximo ciclo
      }
    }

    fetchPhotos();
    const interval = setInterval(fetchPhotos, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const [spotlight, ...rest] = photos;

  return (
    <main className="flex-1 flex flex-col p-6 sm:p-10 gap-6 min-h-screen">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-accent via-accent-2 to-accent-3 bg-clip-text text-transparent">
          {eventName}
        </h1>
        <p className="text-foreground/50 text-sm">
          {photos.length} foto{photos.length === 1 ? "" : "s"} recebida
          {photos.length === 1 ? "" : "s"}
        </p>
      </header>

      {photos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-foreground/50">
          <span className="text-6xl">📸</span>
          <p className="text-lg">Aguardando as primeiras fotos...</p>
          <p className="text-sm">Escaneie o QR Code para enviar a sua!</p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div key={spotlight.url} className="lg:col-span-2 animate-pop-in">
            <img
              src={spotlight.url}
              alt="Foto mais recente"
              className="w-full h-full max-h-[75vh] object-cover rounded-3xl border-4 border-accent/40 shadow-2xl shadow-accent/20"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3 content-start">
            {rest.map((photo) => (
              <img
                key={photo.url}
                src={photo.url}
                alt="Foto do evento"
                className="animate-pop-in w-full aspect-square object-cover rounded-xl border border-white/10"
              />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
