"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || "Aniversário";
const REFRESH_MS = 10_000;
const ONLINE_WINDOW_MS = 3 * 60 * 1000;

type Photo = {
  url: string;
  pathname: string;
  uploadedAt: string;
  visitorId: string | null;
};

type Visitor = {
  id: string;
  name: string;
  device: string;
  page: string;
  firstSeen: string;
  lastSeen: string;
};

type Overview = { photos: Photo[]; visitors: Visitor[]; now: string };
type AuthState = "checking" | "login" | "unconfigured" | "ready";
type Tab = "fotos" | "acessos";

const PAGE_LABELS: Record<string, string> = {
  upload: "📸 Enviar foto",
  telao: "🖥️ Telão",
  album: "🖼️ Álbum",
  qr: "🔗 QR Code",
  home: "🏠 Início",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatAgo(iso: string, now: number) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "agora";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `há ${hours}h${String(minutes % 60).padStart(2, "0")}`;
}

export default function AdminPage() {
  const [auth, setAuth] = useState<AuthState>("checking");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [data, setData] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("fotos");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<Photo | null>(null);
  const [confirmPaths, setConfirmPaths] = useState<string[] | null>(null);
  const [toast, setToast] = useState("");

  const loadOverview = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      if (response.status === 401) {
        setAuth("login");
        return;
      }
      if (!response.ok) throw new Error();
      const overview = (await response.json()) as Overview;
      setData(overview);
      setLoadError("");
    } catch {
      setLoadError("Não foi possível atualizar agora. Tentando de novo…");
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/login", { cache: "no-store" })
      .then((response) => response.json())
      .then((status) => {
        if (!status.configured) setAuth("unconfigured");
        else setAuth(status.authenticated ? "ready" : "login");
      })
      .catch(() => setAuth("login"));
  }, []);

  useEffect(() => {
    if (auth !== "ready") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOverview();
    const interval = setInterval(loadOverview, REFRESH_MS);
    return () => clearInterval(interval);
  }, [auth, loadOverview]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timeout);
  }, [toast]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    setLoggingIn(false);
    if (response?.ok) {
      setPassword("");
      setAuth("ready");
    } else {
      const body = await response?.json().catch(() => null);
      setLoginError(body?.error ?? "Não foi possível entrar.");
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/login", { method: "DELETE" }).catch(() => {});
    setData(null);
    setAuth("login");
  }

  async function deletePhotos(pathnames: string[]) {
    setConfirmPaths(null);
    setDeleting((current) => new Set([...current, ...pathnames]));
    const response = await fetch("/api/admin/photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathnames }),
    }).catch(() => null);

    setDeleting((current) => {
      const next = new Set(current);
      pathnames.forEach((p) => next.delete(p));
      return next;
    });

    if (response?.ok) {
      setData((current) =>
        current
          ? { ...current, photos: current.photos.filter((p) => !pathnames.includes(p.pathname)) }
          : current
      );
      setSelected((current) => {
        const next = new Set(current);
        pathnames.forEach((p) => next.delete(p));
        return next;
      });
      if (preview && pathnames.includes(preview.pathname)) setPreview(null);
      setToast(
        pathnames.length === 1
          ? "Foto apagada. Ela sai do telão em poucos segundos."
          : `${pathnames.length} fotos apagadas. Elas saem do telão em poucos segundos.`
      );
    } else {
      setToast("Não foi possível apagar. Tente de novo.");
    }
  }

  function toggleSelected(pathname: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(pathname)) next.delete(pathname);
      else next.add(pathname);
      return next;
    });
  }

  const now = data ? new Date(data.now).getTime() : 0;

  const visitorsById = useMemo(() => {
    const map = new Map<string, Visitor>();
    data?.visitors.forEach((visitor) => map.set(visitor.id, visitor));
    return map;
  }, [data]);

  const photoCountByVisitor = useMemo(() => {
    const counts = new Map<string, number>();
    data?.photos.forEach((photo) => {
      if (photo.visitorId) counts.set(photo.visitorId, (counts.get(photo.visitorId) ?? 0) + 1);
    });
    return counts;
  }, [data]);

  const onlineVisitors = useMemo(
    () =>
      data?.visitors.filter(
        (visitor) => now - new Date(visitor.lastSeen).getTime() < ONLINE_WINDOW_MS
      ) ?? [],
    [data, now]
  );

  const telaoOnline = onlineVisitors.some((visitor) => visitor.page === "telao");

  function senderLabel(photo: Photo) {
    if (!photo.visitorId) return "Anônimo";
    const visitor = visitorsById.get(photo.visitorId);
    return visitor?.name || (visitor ? visitor.device : "Anônimo");
  }

  // ---------- telas de acesso ----------

  if (auth === "checking") {
    return (
      <main className="flex-1 flex items-center justify-center text-foreground/50">
        Carregando…
      </main>
    );
  }

  if (auth === "unconfigured") {
    return (
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-3">
          <div className="text-5xl">🔒</div>
          <h1 className="text-xl font-bold">Painel ainda não ativado</h1>
          <p className="text-foreground/60 text-sm">
            Crie a variável de ambiente <code className="text-accent-3">ADMIN_PASSWORD</code> no
            projeto da Vercel e faça um novo deploy.
          </p>
        </div>
      </main>
    );
  }

  if (auth === "login") {
    return (
      <main className="flex-1 flex items-center justify-center px-6">
        <form onSubmit={handleLogin} className="w-full max-w-xs space-y-4 text-center">
          <div className="text-5xl">🔐</div>
          <div>
            <p className="text-accent-3 tracking-widest uppercase text-xs font-semibold">
              {eventName}
            </p>
            <h1 className="text-2xl font-bold">Painel do administrador</h1>
          </div>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Senha"
            className="w-full rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-center focus:outline-none focus:border-accent"
          />
          {loginError && <p className="text-sm text-red-400">{loginError}</p>}
          <button
            type="submit"
            disabled={loggingIn || !password}
            className="w-full rounded-xl bg-gradient-to-r from-accent to-accent-2 py-3 font-semibold disabled:opacity-50"
          >
            {loggingIn ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </main>
    );
  }

  // ---------- painel ----------

  const photos = data?.photos ?? [];
  const visitors = data?.visitors ?? [];

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-accent-3 tracking-widest uppercase text-xs font-semibold">
            Painel do administrador
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold">{eventName}</h1>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <a href="/telao" target="_blank" className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/5">
            🖥️ Abrir telão
          </a>
          <a href="/qr" target="_blank" className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/5">
            🔗 QR Code
          </a>
          <a href="/album" target="_blank" className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/5">
            🖼️ Álbum
          </a>
          <button onClick={handleLogout} className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/5">
            Sair
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Fotos no telão" value={photos.length} emoji="📷" />
        <StatCard label="Online agora" value={onlineVisitors.length} emoji="🟢" />
        <StatCard label="Visitantes no total" value={visitors.length} emoji="👥" />
        <StatCard
          label="Telão"
          value={telaoOnline ? "No ar" : "Fechado"}
          emoji={telaoOnline ? "✅" : "⚠️"}
          tone={telaoOnline ? "good" : "warn"}
        />
      </section>

      {loadError && <p className="text-sm text-amber-400">{loadError}</p>}

      <nav className="flex gap-2 border-b border-white/10">
        {(["fotos", "acessos"] as Tab[]).map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`px-4 py-2 -mb-px border-b-2 font-medium capitalize ${
              tab === value
                ? "border-accent text-foreground"
                : "border-transparent text-foreground/50 hover:text-foreground/80"
            }`}
          >
            {value === "fotos" ? `Fotos (${photos.length})` : `Acessos (${visitors.length})`}
          </button>
        ))}
      </nav>

      {tab === "fotos" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-foreground/60">
              Clique na foto para ampliar. Marque várias para apagar de uma vez.
            </p>
            {selected.size > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(new Set())}
                  className="rounded-lg border border-white/15 px-3 py-2"
                >
                  Limpar seleção
                </button>
                <button
                  onClick={() => setConfirmPaths([...selected])}
                  className="rounded-lg bg-red-500/90 hover:bg-red-500 px-3 py-2 font-semibold"
                >
                  🗑️ Apagar {selected.size} selecionada{selected.size === 1 ? "" : "s"}
                </button>
              </div>
            )}
          </div>

          {!data ? (
            <p className="text-foreground/50">Carregando fotos…</p>
          ) : photos.length === 0 ? (
            <p className="text-foreground/50">Nenhuma foto enviada ainda.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {photos.map((photo) => {
                const isSelected = selected.has(photo.pathname);
                const isDeleting = deleting.has(photo.pathname);
                return (
                  <div
                    key={photo.pathname}
                    className={`group relative rounded-xl overflow-hidden border bg-white/5 transition ${
                      isSelected ? "border-red-400 ring-2 ring-red-400/60" : "border-white/10"
                    } ${isDeleting ? "opacity-40 pointer-events-none" : ""}`}
                  >
                    <button onClick={() => setPreview(photo)} className="block w-full aspect-square">
                      <img src={photo.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    </button>
                    <label className="absolute top-2 left-2 h-7 w-7 rounded-md bg-black/60 flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(photo.pathname)}
                        className="h-4 w-4 accent-red-500"
                      />
                    </label>
                    <button
                      onClick={() => setConfirmPaths([photo.pathname])}
                      title="Apagar foto"
                      className="absolute top-2 right-2 h-8 w-8 rounded-md bg-black/60 hover:bg-red-500 flex items-center justify-center"
                    >
                      🗑️
                    </button>
                    <div className="px-2 py-1.5 text-xs flex justify-between gap-2">
                      <span className="truncate text-foreground/80">{senderLabel(photo)}</span>
                      <span className="text-foreground/50 shrink-0">{formatTime(photo.uploadedAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "acessos" && (
        <section className="space-y-3">
          <p className="text-sm text-foreground/60">
            Cada aparelho que abriu o site. “Online” = com a página aberta nos últimos 3 minutos.
            O nome aparece quando o convidado preenche na tela de envio.
          </p>
          {!data ? (
            <p className="text-foreground/50">Carregando acessos…</p>
          ) : visitors.length === 0 ? (
            <p className="text-foreground/50">Ninguém acessou ainda.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-left text-foreground/60">
                  <tr>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">Aparelho</th>
                    <th className="px-3 py-2 font-medium">Página</th>
                    <th className="px-3 py-2 font-medium text-center">Fotos</th>
                    <th className="px-3 py-2 font-medium">Chegou</th>
                    <th className="px-3 py-2 font-medium">Última atividade</th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.map((visitor) => {
                    const online = now - new Date(visitor.lastSeen).getTime() < ONLINE_WINDOW_MS;
                    return (
                      <tr key={visitor.id} className="border-t border-white/5">
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs ${
                              online ? "text-emerald-400" : "text-foreground/40"
                            }`}
                          >
                            <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-white/20"}`} />
                            {online ? "Online" : "Offline"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {visitor.name || <span className="text-foreground/40">Sem nome</span>}
                        </td>
                        <td className="px-3 py-2 text-foreground/70">{visitor.device}</td>
                        <td className="px-3 py-2 text-foreground/70">
                          {PAGE_LABELS[visitor.page] ?? visitor.page}
                        </td>
                        <td className="px-3 py-2 text-center">{photoCountByVisitor.get(visitor.id) ?? 0}</td>
                        <td className="px-3 py-2 text-foreground/70">{formatTime(visitor.firstSeen)}</td>
                        <td className="px-3 py-2 text-foreground/70">{formatAgo(visitor.lastSeen, now)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-40 bg-black/90 flex flex-col items-center justify-center p-4 gap-4"
          onClick={() => setPreview(null)}
        >
          <img
            src={preview.url}
            alt=""
            onClick={(event) => event.stopPropagation()}
            className="max-h-[78vh] max-w-full rounded-2xl"
          />
          <div className="flex items-center gap-3" onClick={(event) => event.stopPropagation()}>
            <span className="text-sm text-foreground/70">
              {senderLabel(preview)} · {formatTime(preview.uploadedAt)}
            </span>
            <button
              onClick={() => setConfirmPaths([preview.pathname])}
              className="rounded-lg bg-red-500/90 hover:bg-red-500 px-3 py-2 text-sm font-semibold"
            >
              🗑️ Apagar
            </button>
            <button
              onClick={() => setPreview(null)}
              className="rounded-lg border border-white/20 px-3 py-2 text-sm"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {confirmPaths && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-white/10 p-6 space-y-4 text-center">
            <div className="text-4xl">🗑️</div>
            <p className="font-semibold">
              Apagar {confirmPaths.length === 1 ? "esta foto" : `${confirmPaths.length} fotos`}?
            </p>
            <p className="text-sm text-foreground/60">
              Some do telão e do álbum em poucos segundos, sem interromper o carrossel. Não dá para desfazer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmPaths(null)}
                className="flex-1 rounded-xl border border-white/20 py-2.5"
              >
                Cancelar
              </button>
              <button
                onClick={() => deletePhotos(confirmPaths)}
                className="flex-1 rounded-xl bg-red-500 py-2.5 font-semibold"
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-neutral-800 border border-white/10 px-4 py-3 text-sm shadow-xl">
          {toast}
        </div>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  emoji,
  tone,
}: {
  label: string;
  value: number | string;
  emoji: string;
  tone?: "good" | "warn";
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        tone === "warn"
          ? "border-amber-400/30 bg-amber-400/5"
          : tone === "good"
            ? "border-emerald-400/30 bg-emerald-400/5"
            : "border-white/10 bg-white/5"
      }`}
    >
      <p className="text-xs text-foreground/60">
        {emoji} {label}
      </p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
