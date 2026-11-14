"use client";

import { useEffect } from "react";

const VISITOR_KEY = "fotoaovivo:visitor";
const HEARTBEAT_MS = 60_000;

let fallbackVisitorId: string | null = null;

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // navegadores antigos sem randomUUID
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16)
  );
}

export function getVisitorId(): string {
  try {
    const stored = localStorage.getItem(VISITOR_KEY);
    if (stored) return stored;
    const id = fallbackVisitorId ?? newId();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    fallbackVisitorId ??= newId();
    return fallbackVisitorId;
  }
}

export { newId };

function sendPresence(page: string) {
  fetch("/api/presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: getVisitorId(), page }),
    keepalive: true,
  }).catch(() => {});
}

// Avisa o servidor que este aparelho está com a página aberta (só com a aba visível).
export function usePresence(page: string) {
  useEffect(() => {
    sendPresence(page);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") sendPresence(page);
    }, HEARTBEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") sendPresence(page);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [page]);
}
