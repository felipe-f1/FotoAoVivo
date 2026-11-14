"use client";

import { useEffect, useRef, useState } from "react";
import { usePresence } from "@/lib/use-presence";

const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || "Aniversário";
const POLL_INTERVAL_MS = 4000;
const SLIDE_INTERVAL_MS = 5000;
const MAX_VISIBLE = 60;
const FILMSTRIP_SIZE = 10;
const FETCH_TIMEOUT_MS = 8000;

type Photo = {
  url: string;
  uploadedAt: string;
};

export default function TelaoPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  // A foto atual é guardada pela URL, não pela posição: se uma foto for
  // apagada no painel, as demais não "pulam" e o telão segue normalmente.
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const seenUrlsRef = useRef<Set<string> | null>(null);
  const photosRef = useRef<Photo[]>([]);
  const brokenUrlsRef = useRef<Set<string>>(new Set());
  const [offline, setOffline] = useState(false);

  usePresence("telao");

  useEffect(() => {
    let cancelled = false;

    async function fetchPhotos() {
      // se a internet travar, desiste da tentativa e mantém as fotos na tela
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await fetch("/api/photos", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.json();
        if (cancelled || !Array.isArray(data.photos)) return;
        setOffline(false);

        const nextPhotos: Photo[] = data.photos
          .filter((photo: Photo) => !brokenUrlsRef.current.has(photo.url))
          .slice(0, MAX_VISIBLE);
        const previousPhotos = photosRef.current;
        photosRef.current = nextPhotos;
        setPhotos(nextPhotos);

        const isFirstLoad = seenUrlsRef.current === null;
        const seen = seenUrlsRef.current ?? new Set<string>();
        const arrived = nextPhotos.filter((photo) => !seen.has(photo.url));
        nextPhotos.forEach((photo) => seen.add(photo.url));
        seenUrlsRef.current = seen;

        setCurrentUrl((current) => {
          // foto nova chegou: mostra na hora (a mais recente)
          if (!isFirstLoad && arrived.length > 0) return arrived[0].url;
          if (current && nextPhotos.some((photo) => photo.url === current)) return current;
          if (nextPhotos.length === 0) return null;
          // a foto que estava na tela foi apagada: segue para a próxima da fila
          const oldIndex = current
            ? previousPhotos.findIndex((photo) => photo.url === current)
            : -1;
          if (oldIndex >= 0) {
            const survivor = previousPhotos
              .slice(oldIndex + 1)
              .find((photo) => nextPhotos.some((next) => next.url === photo.url));
            if (survivor) return survivor.url;
          }
          return nextPhotos[0].url;
        });
      } catch {
        // falha de rede: continua mostrando as fotos que já tem e tenta de novo
        if (!cancelled) setOffline(true);
      } finally {
        clearTimeout(timeout);
      }
    }

    fetchPhotos();
    const interval = setInterval(fetchPhotos, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const currentIndex = Math.max(
    0,
    photos.findIndex((photo) => photo.url === currentUrl)
  );

  // cada foto fica 5s na tela, contando a partir do momento em que apareceu
  useEffect(() => {
    if (photos.length < 2) return;
    const timeout = setTimeout(() => {
      const list = photosRef.current;
      const index = list.findIndex((photo) => photo.url === currentUrl);
      setCurrentUrl(list[(index + 1) % list.length]?.url ?? null);
    }, SLIDE_INTERVAL_MS);
    return () => clearTimeout(timeout);
  }, [currentUrl, photos.length]);

  const currentPhoto = photos[currentIndex];
  const filmstrip = photos.slice(0, FILMSTRIP_SIZE);
  const nextPhoto = photos.length > 1 ? photos[(currentIndex + 1) % photos.length] : null;

  // pré-carrega a próxima foto para a troca ser instantânea
  useEffect(() => {
    if (!nextPhoto) return;
    const image = new Image();
    image.src = nextPhoto.url;
  }, [nextPhoto]);

  // foto que não abre (apagada ou corrompida): pula sem deixar a tela vazia
  function handleBrokenImage(url: string) {
    brokenUrlsRef.current.add(url);
    const remaining = photosRef.current.filter((photo) => photo.url !== url);
    photosRef.current = remaining;
    setPhotos(remaining);
    setCurrentUrl((current) => (current === url ? (remaining[0]?.url ?? null) : current));
  }

  return (
    <main className="flex-1 flex flex-col p-6 sm:p-10 gap-6 min-h-screen">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-accent via-accent-2 to-accent-3 bg-clip-text text-transparent">
          {eventName}
        </h1>
        <p className="text-foreground/50 text-sm">
          {offline && <span className="mr-2 text-amber-400/80">● reconectando</span>}
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
              onError={() => handleBrokenImage(currentPhoto.url)}
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
