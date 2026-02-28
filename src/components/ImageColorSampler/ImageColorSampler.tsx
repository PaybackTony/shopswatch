"use client";

import { useState, useRef, useCallback } from "react";

const MAGNIFIER_SIZE = 96;
const ZOOM_RADIUS = 18;

function toHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

interface Props {
  onColorSelect: (rgb: [number, number, number]) => void;
}

export function ImageColorSampler({ onColorSelect }: Props) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hoveredColor, setHoveredColor] = useState<
    [number, number, number] | null
  >(null);
  const [magnifierPos, setMagnifierPos] = useState({ x: 0, y: 0 });
  const [showMagnifier, setShowMagnifier] = useState(false);

  // Both canvases are always in the DOM so refs are never null
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const magCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadImage = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      const scale = Math.min(1, 700 / img.width, 600 / img.height);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      setImageLoaded(true);
    };
    img.src = url;
  }, []);

  const toCanvasXY = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const x = Math.round((clientX - rect.left) * (canvas.width / rect.width));
      const y = Math.round((clientY - rect.top) * (canvas.height / rect.height));
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
      return { x, y };
    },
    []
  );

  const samplePixel = useCallback(
    (cx: number, cy: number): [number, number, number] | null => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return null;
      const d = ctx.getImageData(cx, cy, 1, 1).data;
      return [d[0], d[1], d[2]];
    },
    []
  );

  const updateMagnifier = useCallback(
    (cx: number, cy: number, clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      const magCanvas = magCanvasRef.current;
      const container = containerRef.current;
      if (!canvas || !magCanvas || !container) return;

      const magCtx = magCanvas.getContext("2d")!;
      magCtx.imageSmoothingEnabled = false;
      magCtx.clearRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
      magCtx.drawImage(
        canvas,
        cx - ZOOM_RADIUS, cy - ZOOM_RADIUS,
        ZOOM_RADIUS * 2, ZOOM_RADIUS * 2,
        0, 0,
        MAGNIFIER_SIZE, MAGNIFIER_SIZE
      );

      // Crosshair
      const mid = MAGNIFIER_SIZE / 2;
      magCtx.save();
      magCtx.strokeStyle = "rgba(255,255,255,0.9)";
      magCtx.lineWidth = 1.5;
      magCtx.shadowColor = "rgba(0,0,0,0.5)";
      magCtx.shadowBlur = 2;
      magCtx.beginPath();
      magCtx.moveTo(mid - 9, mid); magCtx.lineTo(mid + 9, mid);
      magCtx.moveTo(mid, mid - 9); magCtx.lineTo(mid, mid + 9);
      magCtx.stroke();
      magCtx.restore();

      const cRect = container.getBoundingClientRect();
      setMagnifierPos({
        x: Math.max(4, clientX - cRect.left - MAGNIFIER_SIZE - 14),
        y: Math.max(4, clientY - cRect.top - MAGNIFIER_SIZE - 14),
      });
    },
    []
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      const coords = toCanvasXY(clientX, clientY);
      if (!coords) { setShowMagnifier(false); return; }
      const rgb = samplePixel(coords.x, coords.y);
      if (!rgb) return;
      setHoveredColor(rgb);
      setShowMagnifier(true);
      updateMagnifier(coords.x, coords.y, clientX, clientY);
    },
    [toCanvasXY, samplePixel, updateMagnifier]
  );

  const handleSelect = useCallback(
    (clientX: number, clientY: number) => {
      const coords = toCanvasXY(clientX, clientY);
      if (!coords) return;
      const rgb = samplePixel(coords.x, coords.y);
      if (rgb) onColorSelect(rgb);
      setShowMagnifier(false);
    },
    [toCanvasXY, samplePixel, onColorSelect]
  );

  const reset = () => {
    setImageLoaded(false);
    setHoveredColor(null);
    setShowMagnifier(false);
  };

  const hexColor = hoveredColor ? toHex(...hoveredColor) : null;

  return (
    <div ref={containerRef} className="relative select-none">
      {/* Upload area — shown until image is loaded */}
      {!imageLoaded && (
        <label className="flex h-52 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 transition-colors hover:border-neutral-300 hover:bg-neutral-100">
          <svg
            className="mb-3 h-10 w-10 text-neutral-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.2}
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          <span className="text-sm font-medium text-neutral-400">
            Upload an image
          </span>
          <span className="mt-1 text-xs text-neutral-300">
            Click to browse · any photo works
          </span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && loadImage(e.target.files[0])}
          />
        </label>
      )}

      {/* Canvas — always in DOM so ref is valid when img.onload fires */}
      <canvas
        ref={canvasRef}
        className="block w-full cursor-crosshair rounded-xl"
        style={{
          display: imageLoaded ? "block" : "none",
          maxHeight: 300,
          touchAction: "none",
        }}
        onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
        onMouseLeave={() => setShowMagnifier(false)}
        onMouseUp={(e) => handleSelect(e.clientX, e.clientY)}
        onTouchMove={(e) => {
          e.preventDefault();
          const t = e.touches[0];
          handleMove(t.clientX, t.clientY);
        }}
        onTouchEnd={(e) => {
          const t = e.changedTouches[0];
          handleSelect(t.clientX, t.clientY);
        }}
      />

      {/* Magnifier — always in DOM so ref is valid */}
      <div
        className="pointer-events-none absolute overflow-hidden rounded-full"
        style={{
          width: MAGNIFIER_SIZE,
          height: MAGNIFIER_SIZE,
          left: magnifierPos.x,
          top: magnifierPos.y,
          visibility: showMagnifier ? "visible" : "hidden",
          border: "3px solid white",
          boxShadow: "0 0 0 1.5px rgba(0,0,0,0.15), 0 8px 28px rgba(0,0,0,0.28)",
          zIndex: 10,
        }}
      >
        <canvas ref={magCanvasRef} width={MAGNIFIER_SIZE} height={MAGNIFIER_SIZE} />
      </div>

      {/* Color readout and reset — only shown with image */}
      {imageLoaded && (
        <>
          <div className="mt-3 flex min-h-[28px] items-center gap-3">
            {hoveredColor ? (
              <>
                <div
                  className="h-6 w-6 shrink-0 rounded-md shadow-sm"
                  style={{
                    background: hexColor ?? undefined,
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                />
                <span className="font-mono text-xs text-neutral-600">
                  {hexColor?.toUpperCase()}
                </span>
                <span className="ml-auto text-[11px] text-neutral-300">
                  {hoveredColor.join(", ")}
                </span>
              </>
            ) : (
              <span className="text-xs text-neutral-400">
                Hover to preview · click to pick
              </span>
            )}
          </div>
          <button
            onClick={reset}
            className="mt-1.5 text-[11px] text-neutral-400 transition-colors hover:text-neutral-600"
          >
            Change image
          </button>
        </>
      )}
    </div>
  );
}
