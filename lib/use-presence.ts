"use client";

import { useEffect } from "react";

const VISITOR_KEY = "fotoaovivo:visitor";
const FIRST_SEEN_KEY = "fotoaovivo:firstSeen";
export const NAME_KEY = "fotoaovivo:name";
const HEARTBEAT_MS = 60_000;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // navegação privada ou armazenamento bloqueado: segue sem salvar
  }
}

let fallbackVisitorId: string | null = null;

export function getVisitorId(): string {
  const stored = readStorage(VISITOR_KEY);
  if (stored) return stored;
  const id = fallbackVisitorId ?? crypto.randomUUID();
  fallbackVisitorId = id;
  writeStorage(VISITOR_KEY, id);
  return id;
}

export function getVisitorName(): string {
  return readStorage(NAME_KEY) ?? "";
}

export function setVisitorName(name: string) {
  writeStorage(NAME_KEY, name);
}

export function sendPresence(page: string) {
  let firstSeen = readStorage(FIRST_SEEN_KEY);
  if (!firstSeen) {
    firstSeen = new Date().toISOString();
    writeStorage(FIRST_SEEN_KEY, firstSeen);
  }
  fetch("/api/presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: getVisitorId(), name: getVisitorName(), page, firstSeen }),
    keepalive: true,
  }).catch(() => {});
}

// Avisa o servidor que este aparelho está com a página aberta.
// Só envia com a aba visível, para economizar operações no Blob.
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
