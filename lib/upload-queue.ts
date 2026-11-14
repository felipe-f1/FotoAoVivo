"use client";

import { uploadPresigned } from "@vercel/blob/client";

// Fila de envio: a foto é guardada no próprio celular (IndexedDB) antes de
// subir. Se não houver sinal, ela fica salva e é enviada sozinha quando a
// internet voltar — mesmo que a pessoa feche e abra a página de novo.

export type QueuedPhoto = {
  id: string;
  pathname: string;
  blob: Blob;
  type: string;
  createdAt: number;
};

const DB_NAME = "fotoaovivo";
const STORE = "pending-uploads";
const UPLOAD_TIMEOUT_MS = 90_000;

const memoryQueue = new Map<string, QueuedPhoto>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function addToQueue(photo: QueuedPhoto) {
  memoryQueue.set(photo.id, photo);
  await withStore("readwrite", (store) => store.put(photo));
}

async function removeFromQueue(id: string) {
  memoryQueue.delete(id);
  await withStore("readwrite", (store) => store.delete(id));
}

export async function listQueue(): Promise<QueuedPhoto[]> {
  const stored = (await withStore<QueuedPhoto[]>("readonly", (store) => store.getAll())) ?? [];
  const all = new Map(stored.map((p) => [p.id, p]));
  memoryQueue.forEach((p, id) => all.set(id, p));
  return [...all.values()].sort((a, b) => a.createdAt - b.createdAt);
}

/** Pergunta ao servidor se a foto já chegou (e a coloca no telão se sim). */
async function confirmOnServer(pathname: string): Promise<boolean> {
  try {
    const response = await fetch("/api/photos/added", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathname }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function uploadOne(photo: QueuedPhoto): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    await uploadPresigned(photo.pathname, photo.blob, {
      access: "public",
      handleUploadUrl: "/api/upload",
      contentType: photo.type || "image/jpeg",
      abortSignal: controller.signal,
    });
    await confirmOnServer(photo.pathname);
    return true;
  } catch {
    // o envio pode ter chegado e só a resposta se perdeu: confere antes de repetir
    return confirmOnServer(photo.pathname);
  } finally {
    clearTimeout(timeout);
  }
}

let running: Promise<{ sent: number; pending: number }> | null = null;

/** Tenta enviar tudo o que está na fila. Para no primeiro erro (sem sinal). */
export function processQueue(): Promise<{ sent: number; pending: number }> {
  running ??= (async () => {
    let sent = 0;
    try {
      const queue = await listQueue();
      for (const photo of queue) {
        if (typeof navigator !== "undefined" && navigator.onLine === false) break;
        const ok = await uploadOne(photo);
        if (!ok) break;
        await removeFromQueue(photo.id);
        sent++;
      }
    } finally {
      running = null;
    }
    const pending = (await listQueue()).length;
    return { sent, pending };
  })();
  return running;
}
