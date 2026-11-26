// The image editor: crop and rotate, nothing more. The picture turns a quarter at a time; the crop is a
// box with its handles (drag inside to move it), free or held to a ratio. Save hands the app the result as
// a Blob of the picture's own type (PNG stays PNG; JPEG and WebP at quality 0.92); the app writes it.
import { useEffect, useRef, useState } from "react";
import { Key } from "../Key.tsx";
import { Segmented } from "../controls.tsx";
import { FULL, drag, fitRatio, pixels, turnRect, turned, type Rect, type Turn } from "./crop.ts";

type Ratio = "free" | "original" | "1:1" | "4:3" | "16:9";
const RATIOS: { value: Ratio; label: string }[] = [
  { value: "free", label: "Free" }, { value: "original", label: "Original" }, { value: "1:1", label: "1:1" }, { value: "4:3", label: "4:3" }, { value: "16:9", label: "16:9" },
];
const HANDLES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

/** The picture turned and cropped, as a canvas (the editor's Save, and anyone's). */
export function render(img: HTMLImageElement, turn: Turn, crop: Rect): HTMLCanvasElement {
  const { w: W, h: H } = turned(img.naturalWidth, img.naturalHeight, turn), px = pixels(crop, W, H);
  const c = document.createElement("canvas");
  c.width = px.w; c.height = px.h;
  const g = c.getContext("2d")!;
  g.translate(-px.x, -px.y);
  g.translate(W / 2, H / 2);
  g.rotate((turn * Math.PI) / 180);
  g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return c;
}

export function ImageEditor({ src, type = "image/png", name, onSave, onCancel }: {
  src: string; type?: string; name: string; onSave: (blob: Blob) => void | Promise<void>; onCancel: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null), [error, setError] = useState<string | null>(null);
  const [turn, setTurn] = useState<Turn>(0), [crop, setCrop] = useState<Rect>(FULL), [ratio, setRatio] = useState<Ratio>("free"), [busy, setBusy] = useState(false);
  const stage = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.onerror = () => setError("The picture couldn't be read.");
    i.src = src;
  }, [src]);

  const size = img ? turned(img.naturalWidth, img.naturalHeight, turn) : { w: 1, h: 1 };
  const ratioOf = (r: Ratio) => (r === "free" ? null : r === "original" ? size.w / size.h : (([a, b]) => a / b)(r.split(":").map(Number)));
  const ratioPx = ratioOf(ratio);

  // the turned picture drawn to fit the stage; the crop box sits over it in the same pixels
  useEffect(() => {
    if (!img || !stage.current || !canvas.current) return;
    const fit = () => {
      const s = stage.current!, k = Math.min((s.clientWidth - 48) / size.w, (s.clientHeight - 48) / size.h, 1);
      const w = Math.max(1, Math.round(size.w * k)), h = Math.max(1, Math.round(size.h * k)), c = canvas.current!;
      c.width = w * devicePixelRatio; c.height = h * devicePixelRatio; c.style.width = `${w}px`; c.style.height = `${h}px`;
      const g = c.getContext("2d")!;
      g.setTransform(devicePixelRatio * k, 0, 0, devicePixelRatio * k, 0, 0);
      g.translate(size.w / 2, size.h / 2);
      g.rotate((turn * Math.PI) / 180);
      g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      setView({ w, h });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage.current);
    return () => ro.disconnect();
  }, [img, turn, size.w, size.h]);

  const rotate = (by: 90 | -90) => { setTurn((t) => (((t + by + 360) % 360) as Turn)); setCrop((r) => turnRect(r, by)); };
  const pickRatio = (r: Ratio) => {
    setRatio(r);
    if (r === "free" || !img) return;
    setCrop(fitRatio(FULL, ratioOf(r)!, size.w, size.h));
  };

  // a drag on the box (move) or a handle (resize), in fractions of the picture
  const start = (edge: string) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const from = crop, x0 = e.clientX, y0 = e.clientY;
    const move = (m: PointerEvent) => setCrop(drag(from, edge, (m.clientX - x0) / view.w, (m.clientY - y0) / view.h, ratioPx, size.w, size.h));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const nudge = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    setCrop((r) => drag(r, "", d[0], d[1], null, size.w, size.h));
  };

  const save = async () => {
    if (!img) return;
    setBusy(true);
    try {
      const out = type === "image/jpeg" || type === "image/webp" ? type : "image/png";
      const blob = await new Promise<Blob | null>((res) => render(img, turn, crop).toBlob(res, out, 0.92));
      if (!blob) throw new Error("the picture couldn't be made");
      await onSave(blob);
    } catch (e) { setError(String((e as Error).message ?? e)); } finally { setBusy(false); }
  };

  const px = img ? pixels(crop, size.w, size.h) : null;
  const changed = turn !== 0 || crop.x !== 0 || crop.y !== 0 || crop.w !== 1 || crop.h !== 1;
  return (
    <div className="pb-imgedit" aria-label={`Edit ${name}`}>
      <div className="pb-imgedit-bar">
        <Key size="sm" kind="quiet" round icon="rotate-left" label="Rotate left" onClick={() => rotate(-90)} />
        <Key size="sm" kind="quiet" round icon="rotate-right" label="Rotate right" onClick={() => rotate(90)} />
        <span className="sep pb-imgedit-sep" />
        <Segmented label="Crop ratio" value={ratio} onChange={pickRatio} options={RATIOS} />
        <span className="pb-imgedit-size">{px ? `${px.w} × ${px.h}` : ""}</span>
        <span className="pb-imgedit-end">
          <Key size="sm" kind="quiet" onClick={() => { setTurn(0); setCrop(FULL); setRatio("free"); }} disabled={!changed}>Reset</Key>
          <Key size="sm" onClick={onCancel}>Cancel</Key>
          <Key size="sm" kind="primary" onClick={save} busy={busy} disabled={!img || !changed}>Save</Key>
        </span>
      </div>
      <div ref={stage} className="pb-imgedit-stage">
        {error && <div className="pb-imgedit-error">{error}</div>}
        <div className="pb-imgedit-pic" style={{ width: view.w || undefined, height: view.h || undefined }}>
          <canvas ref={canvas} />
          {img && view.w > 0 && (
            <div className="pb-imgedit-crop" tabIndex={0} role="group" aria-label="Crop: drag to move, the handles to resize, arrows to nudge"
              style={{ left: crop.x * view.w, top: crop.y * view.h, width: crop.w * view.w, height: crop.h * view.h }}
              onPointerDown={start("")} onKeyDown={nudge}>
              <i className="grid" />
              {HANDLES.map((h) => <i key={h} className={`h ${h}`} onPointerDown={start(h)} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
