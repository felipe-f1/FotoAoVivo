"use client";

import { useEffect, useState } from "react";

const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || "Aniversário";

type Photo = {
  url: string;
  uploadedAt: string;
};

export default function AlbumPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/photos", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.photos)) setPhotos(data.photos);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedPhoto = selectedIndex !== null ? photos[selectedIndex] : null;

  function showNext() {
    setSelectedIndex((index) =>
      index === null ? null : (index + 1) % photos.length
    );
  }

  function showPrev() {
    setSelectedIndex((index) =>
      index === null ? null : (index - 1 + photos.length) % photos.length
    );
  }

  return (
    <main className="flex-1 px-6 py-10 max-w-6xl mx-auto w-full">
      <header className="text-center mb-8 space-y-1">
        <p className="text-accent-3 tracking-widest uppercase text-xs font-semibold">
          Álbum completo
        </p>
        <h1 className="text-3xl font-bold">{eventName}</h1>
        <p className="text-foreground/60 text-sm">
          {photos.length} foto{photos.length === 1 ? "" : "s"} compartilhada
          {photos.length === 1 ? "" : "s"} pelos convidados
        </p>
      </header>

      {loading ? (
        <p className="text-center text-foreground/50">Carregando fotos...</p>
      ) : photos.length === 0 ? (
        <p className="text-center text-foreground/50">
          Nenhuma foto enviada ainda.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((photo, index) => (
            <button
              key={photo.url}
              onClick={() => setSelectedIndex(index)}
              className="aspect-square overflow-hidden rounded-xl border border-white/10"
            >
              <img
                src={photo.url}
                alt="Foto do evento"
                className="w-full h-full object-cover hover:scale-105 transition-transform"
              />
            </button>
          ))}
        </div>
      )}

      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedIndex(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl"
            onClick={() => setSelectedIndex(null)}
          >
            ✕
          </button>
          <button
            className="absolute left-2 sm:left-6 text-white text-4xl px-2"
            onClick={(event) => {
              event.stopPropagation();
              showPrev();
            }}
          >
            ‹
          </button>
          <img
            src={selectedPhoto.url}
            alt="Foto ampliada"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[85vh] max-w-full rounded-2xl"
          />
          <button
            className="absolute right-2 sm:right-6 text-white text-4xl px-2"
            onClick={(event) => {
              event.stopPropagation();
              showNext();
            }}
          >
            ›
          </button>
        </div>
      )}
    </main>
  );
}
