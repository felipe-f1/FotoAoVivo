"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Editor simples, 100% no celular (nada é enviado até o convidado tocar em "Enviar").
// Os filtros são aplicados pixel a pixel, em vez de ctx.filter, para funcionar
// igual em iPhones antigos (Safari < 18 ignora ctx.filter).

const WORK_MAX = 2048;
const EXPORT_QUALITY = 0.9;

type Aspect = "original" | "1:1" | "4:5" | "9:16" | "16:9";
type Tab = "cortar" | "filtros" | "ajustes";

type Adjust = {
  brightness: number; // -50..50
  contrast: number; // -50..50
  saturation: number; // -100..100
  warmth: number; // -50..50
  mono: number; // 0..1 (preto e branco)
  sepia: number; // 0..1
};

const NEUTRAL: Adjust = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, mono: 0, sepia: 0 };

const FILTERS: { id: string; label: string; adjust: Adjust }[] = [
  { id: "original", label: "Original", adjust: NEUTRAL },
  { id: "vivo", label: "Vivo", adjust: { ...NEUTRAL, saturation: 40, contrast: 15 } },
  { id: "quente", label: "Quente", adjust: { ...NEUTRAL, warmth: 25, saturation: 15, brightness: 5 } },
  { id: "frio", label: "Frio", adjust: { ...NEUTRAL, warmth: -25, brightness: 5 } },
  { id: "pb", label: "P&B", adjust: { ...NEUTRAL, mono: 1, contrast: 15 } },
  { id: "sepia", label: "Sépia", adjust: { ...NEUTRAL, sepia: 0.8, contrast: 5 } },
  { id: "vintage", label: "Vintage", adjust: { ...NEUTRAL, sepia: 0.35, contrast: -10, brightness: 8, saturation: -20 } },
  { id: "drama", label: "Drama", adjust: { ...NEUTRAL, contrast: 35, saturation: -15, brightness: -5 } },
];

const ASPECTS: { id: Aspect; label: string; ratio: number | null }[] = [
  { id: "original", label: "Original", ratio: null },
  { id: "1:1", label: "Quadrado", ratio: 1 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
  { id: "9:16", label: "Story", ratio: 9 / 16 },
  { id: "16:9", label: "Paisagem", ratio: 16 / 9 },
];

type Geometry = {
  rotation: number; // 0, 90, 180, 270
  flip: boolean;
  aspect: Aspect;
  zoom: number; // 1..3
  center: { x: number; y: number }; // 0..1 dentro da imagem girada
};

const INITIAL_GEOMETRY: Geometry = {
  rotation: 0,
  flip: false,
  aspect: "original",
  zoom: 1,
  center: { x: 0.5, y: 0.5 },
};

function isNeutral(a: Adjust) {
  return Object.keys(NEUTRAL).every((k) => a[k as keyof Adjust] === NEUTRAL[k as keyof Adjust]);
}

/** Calcula a área visível (em coordenadas da imagem já girada). */
function computeView(source: HTMLCanvasElement, g: Geometry) {
  const sideways = g.rotation % 180 !== 0;
  const rw = sideways ? source.height : source.width;
  const rh = sideways ? source.width : source.height;
  const ratio = ASPECTS.find((a) => a.id === g.aspect)?.ratio ?? rw / rh;

  let cw = rw;
  let ch = rw / ratio;
  if (ch > rh) {
    ch = rh;
    cw = rh * ratio;
  }
  const vw = cw / g.zoom;
  const vh = ch / g.zoom;
  const cx = Math.min(Math.max(g.center.x * rw, vw / 2), rw - vw / 2);
  const cy = Math.min(Math.max(g.center.y * rh, vh / 2), rh - vh / 2);
  return { rw, rh, vw, vh, cx, cy, ratio };
}

function applyAdjust(ctx: CanvasRenderingContext2D, width: number, height: number, a: Adjust) {
  if (isNeutral(a)) return;
  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;
  const b = a.brightness * 2.55;
  const c = 1 + a.contrast / 50;
  const s = 1 + a.saturation / 100;
  const w = a.warmth * 0.8;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] + b;
    let g = d[i + 1] + b;
    let bl = d[i + 2] + b;

    r = (r - 128) * c + 128;
    g = (g - 128) * c + 128;
    bl = (bl - 128) * c + 128;

    const gray = 0.299 * r + 0.587 * g + 0.114 * bl;
    r = gray + (r - gray) * s;
    g = gray + (g - gray) * s;
    bl = gray + (bl - gray) * s;

    r += w;
    bl -= w;

    if (a.mono > 0) {
      const m = 0.299 * r + 0.587 * g + 0.114 * bl;
      r += (m - r) * a.mono;
      g += (m - g) * a.mono;
      bl += (m - bl) * a.mono;
    }
    if (a.sepia > 0) {
      const sr = 0.393 * r + 0.769 * g + 0.189 * bl;
      const sg = 0.349 * r + 0.686 * g + 0.168 * bl;
      const sb = 0.272 * r + 0.534 * g + 0.131 * bl;
      r += (sr - r) * a.sepia;
      g += (sg - g) * a.sepia;
      bl += (sb - bl) * a.sepia;
    }

    d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    d[i + 2] = bl < 0 ? 0 : bl > 255 ? 255 : bl;
  }
  ctx.putImageData(image, 0, 0);
}

/** Desenha a imagem editada num canvas de saída (usado na prévia e no arquivo final). */
function render(
  target: HTMLCanvasElement,
  source: HTMLCanvasElement,
  g: Geometry,
  adjust: Adjust,
  maxSide: number
) {
  const view = computeView(source, g);
  const scale = Math.min(maxSide / view.vw, maxSide / view.vh, 1);
  const outW = Math.max(1, Math.round(view.vw * scale));
  const outH = Math.max(1, Math.round(view.vh * scale));
  target.width = outW;
  target.height = outH;

  const ctx = target.getContext("2d", { willReadFrequently: true });
  if (!ctx) return view;
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  ctx.translate(outW / 2, outH / 2);
  ctx.scale(scale, scale);
  ctx.translate(-view.cx, -view.cy);
  ctx.translate(view.rw / 2, view.rh / 2);
  // espelha antes de girar: o espelho é sempre na horizontal da tela
  if (g.flip) ctx.scale(-1, 1);
  ctx.rotate((g.rotation * Math.PI) / 180);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  ctx.restore();

  applyAdjust(ctx, outW, outH, adjust);
  return { ...view, scale };
}

async function loadSource(file: File): Promise<HTMLCanvasElement> {
  // <img> já respeita a orientação EXIF em todos os navegadores atuais
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    const ratio = Math.min(1, WORK_MAX / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * ratio);
    canvas.height = Math.round(image.naturalHeight * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PhotoEditor({
  file,
  onDone,
  onCancel,
}: {
  file: File;
  onDone: (edited: File) => void;
  onCancel: () => void;
}) {
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("cortar");
  const [geometry, setGeometry] = useState<Geometry>(INITIAL_GEOMETRY);
  const [adjust, setAdjust] = useState<Adjust>(NEUTRAL);
  const [filterId, setFilterId] = useState("original");
  const previewRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<{ scale: number; rw: number; rh: number; cx: number; cy: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number; center: { x: number; y: number } } | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSource(file)
      .then((canvas) => !cancelled && setSource(canvas))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [file]);

  // trava a rolagem da página enquanto o editor está aberto
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const drawPreview = useCallback(() => {
    if (!source || !previewRef.current || !boxRef.current) return;
    const box = boxRef.current.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const maxSide = Math.max(200, Math.min(box.width, box.height) * dpr);
    const result = render(previewRef.current, source, geometry, adjust, maxSide);
    viewRef.current =
      "scale" in result
        ? { scale: result.scale, rw: result.rw, rh: result.rh, cx: result.cx, cy: result.cy }
        : null;

    // encaixa o canvas na área disponível mantendo a proporção
    const ratio = previewRef.current.width / previewRef.current.height;
    let cssW = box.width;
    let cssH = box.width / ratio;
    if (cssH > box.height) {
      cssH = box.height;
      cssW = box.height * ratio;
    }
    previewRef.current.style.width = `${cssW}px`;
    previewRef.current.style.height = `${cssH}px`;
    if (viewRef.current) viewRef.current.scale *= cssW / previewRef.current.width;
  }, [source, geometry, adjust]);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(drawPreview);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [drawPreview]);

  useEffect(() => {
    window.addEventListener("resize", drawPreview);
    return () => window.removeEventListener("resize", drawPreview);
  }, [drawPreview]);

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (geometry.zoom <= 1 && geometry.aspect === "original") return;
    const view = viewRef.current;
    if (!view) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    // parte do centro já ajustado aos limites, para o arraste responder na hora
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      center: { x: view.cx / view.rw, y: view.cy / view.rh },
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    const view = viewRef.current;
    if (!drag || !view) return;
    const dx = (event.clientX - drag.x) / view.scale / view.rw;
    const dy = (event.clientY - drag.y) / view.scale / view.rh;
    setGeometry((g) => ({
      ...g,
      center: {
        x: Math.min(1, Math.max(0, drag.center.x - dx)),
        y: Math.min(1, Math.max(0, drag.center.y - dy)),
      },
    }));
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function chooseFilter(id: string) {
    const preset = FILTERS.find((f) => f.id === id);
    if (!preset) return;
    setFilterId(id);
    setAdjust(preset.adjust);
  }

  function setAdjustValue(key: keyof Adjust, value: number) {
    setAdjust((a) => ({ ...a, [key]: value }));
  }

  async function handleDone() {
    if (!source) return;
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      render(canvas, source, geometry, adjust, WORK_MAX);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", EXPORT_QUALITY)
      );
      if (!blob) throw new Error("export");
      onDone(new File([blob], "foto-editada.jpg", { type: "image/jpeg" }));
    } catch {
      setSaving(false);
      setLoadError(true);
    }
  }

  function handleResetAll() {
    setGeometry(INITIAL_GEOMETRY);
    setAdjust(NEUTRAL);
    setFilterId("original");
  }

  const canPan = geometry.zoom > 1 || geometry.aspect !== "original";

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col text-white select-none">
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button onClick={onCancel} disabled={saving} className="text-sm text-white/70 px-2 py-1">
          Cancelar
        </button>
        <button onClick={handleResetAll} disabled={saving || !source} className="text-xs text-white/50 px-2 py-1">
          Desfazer tudo
        </button>
        <button
          onClick={handleDone}
          disabled={saving || !source}
          className="rounded-lg bg-gradient-to-r from-accent to-accent-2 px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Concluir"}
        </button>
      </header>

      <div ref={boxRef} className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-hidden">
        {loadError ? (
          <div className="text-center space-y-3 max-w-xs">
            <div className="text-4xl">⚠️</div>
            <p className="text-sm text-white/70">
              Não foi possível editar esta foto neste celular. Você ainda pode enviá-la sem edição.
            </p>
            <button onClick={onCancel} className="rounded-xl border border-white/20 px-4 py-2 text-sm">
              Voltar
            </button>
          </div>
        ) : !source ? (
          <p className="text-white/50 text-sm">Abrindo a foto…</p>
        ) : (
          <canvas
            ref={previewRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`rounded-lg touch-none ${canPan ? "cursor-grab" : ""}`}
          />
        )}
      </div>

      {source && !loadError && (
        <div className="border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
          <div className="px-4 py-3 min-h-[118px]">
            {tab === "cortar" && (
              <div className="space-y-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {ASPECTS.map((a) => (
                    <Chip
                      key={a.id}
                      active={geometry.aspect === a.id}
                      onClick={() => setGeometry((g) => ({ ...g, aspect: a.id, center: { x: 0.5, y: 0.5 } }))}
                    >
                      {a.label}
                    </Chip>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setGeometry((g) => ({ ...g, rotation: (g.rotation + 90) % 360, center: { x: 0.5, y: 0.5 } }))}
                    className="rounded-lg border border-white/20 px-3 py-2 text-sm shrink-0"
                  >
                    ↻ Girar
                  </button>
                  <button
                    onClick={() => setGeometry((g) => ({ ...g, flip: !g.flip }))}
                    className="rounded-lg border border-white/20 px-3 py-2 text-sm shrink-0"
                  >
                    ⇋ Espelhar
                  </button>
                  <label className="flex-1 flex items-center gap-2 text-xs text-white/60">
                    Zoom
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.01}
                      value={geometry.zoom}
                      onChange={(e) => setGeometry((g) => ({ ...g, zoom: Number(e.target.value) }))}
                      className="flex-1 accent-pink-500"
                    />
                  </label>
                </div>
                {canPan && <p className="text-[11px] text-white/40">Arraste a foto para ajustar o enquadramento.</p>}
              </div>
            )}

            {tab === "filtros" && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {FILTERS.map((f) => (
                  <Chip key={f.id} active={filterId === f.id} onClick={() => chooseFilter(f.id)}>
                    {f.label}
                  </Chip>
                ))}
              </div>
            )}

            {tab === "ajustes" && (
              <div className="space-y-2">
                <Slider label="Brilho" min={-50} max={50} value={adjust.brightness} onChange={(v) => setAdjustValue("brightness", v)} />
                <Slider label="Contraste" min={-50} max={50} value={adjust.contrast} onChange={(v) => setAdjustValue("contrast", v)} />
                <Slider label="Cor" min={-100} max={100} value={adjust.saturation} onChange={(v) => setAdjustValue("saturation", v)} />
                <Slider label="Temperatura" min={-50} max={50} value={adjust.warmth} onChange={(v) => setAdjustValue("warmth", v)} />
              </div>
            )}
          </div>

          <nav className="grid grid-cols-3 border-t border-white/10">
            {(
              [
                ["cortar", "✂️ Cortar"],
                ["filtros", "🎨 Filtros"],
                ["ajustes", "☀️ Ajustes"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`py-3 text-sm font-medium ${tab === id ? "text-white" : "text-white/45"}`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-sm border transition ${
        active ? "bg-white text-black border-white font-semibold" : "border-white/20 text-white/80"
      }`}
    >
      {children}
    </button>
  );
}

function Slider({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-xs text-white/70">
      <span className="w-20 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-pink-500"
      />
      <span className="w-8 text-right tabular-nums">{value > 0 ? `+${value}` : value}</span>
    </label>
  );
}
