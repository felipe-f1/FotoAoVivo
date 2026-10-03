"use client";

import { useEffect, useRef, useState } from "react";

const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || "Aniversário";
const POLL_INTERVAL_MS = 4000;
const SLIDE_INTERVAL_MS = 5000;
const MAX_VISIBLE = 60;
const FILMSTRIP_SIZE = 10;

type Photo = {
  url: string;
  uploadedAt: string;
};

export default function TelaoPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const newestUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPhotos() {
      try {
        const response = await fetch("/api/photos", { cache: "no-store" });
        const data = await response.json();
        if (cancelled || !Array.isArray(data.photos)) return;

        const nextPhotos: Photo[] = data.photos.slice(0, MAX_VISIBLE);
        setPhotos(nextPhotos);

        const newestUrl = nextPhotos[0]?.url ?? null;
        if (newestUrl && newestUrl !== newestUrlRef.current) {
          newestUrlRef.current = newestUrl;
          setCurrentIndex(0);
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

  useEffect(() => {
    if (photos.length < 2) return;
    const interval = setInterval(() => {
      setCurrentIndex((index) => (index + 1) % photos.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [photos.length]);

  const currentPhoto = photos[currentIndex];
  const filmstrip = photos.slice(0, FILMSTRIP_SIZE);

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

      {!currentPhoto ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-foreground/50">
          <span className="text-6xl">📸</span>
          <p className="text-lg">Aguardando as primeiras fotos...</p>
          <p className="text-sm">Escaneie o QR Code para enviar a sua!</p>
        </div>
      ) : (
        <div className="flex-1 relative rounded-3xl overflow-hidden">
          <div
            key={`${currentPhoto.url}-bg`}
            className="absolute inset-0 bg-cover bg-center scale-110 blur-2xl opacity-40"
            style={{ backgroundImage: `url(${currentPhoto.url})` }}
          />
          <div className="absolute inset-0 bg-black/30" />

          <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-10">
            <img
              key={currentPhoto.url}
              src={currentPhoto.url}
              alt="Foto do evento"
              className="animate-pop-in max-h-full max-w-full object-contain rounded-2xl shadow-2xl shadow-black/50"
            />
          </div>

          {photos.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-3">
              <div className="flex gap-2 bg-black/40 backdrop-blur px-3 py-2 rounded-2xl">
                {filmstrip.map((photo, index) => (
                  <img
                    key={photo.url}
                    src={photo.url}
                    alt=""
                    className={`h-12 w-12 sm:h-14 sm:w-14 object-cover rounded-lg transition-all ${
                      index === currentIndex
                        ? "ring-2 ring-accent-3 scale-105 opacity-100"
                        : "opacity-50"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-foreground/60">
                {currentIndex + 1} / {photos.length}
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
