"use client";

import { rgbToHex, sRGBtoLab, getMatchQuality } from "@color-math/index";
import type { SearchResult } from "@/app/api/search/route";

interface DetailModalProps {
  dress: SearchResult;
  targetColor: [number, number, number];
  onClose: () => void;
}

export function DetailModal({ dress, targetColor, onClose }: DetailModalProps) {
  const [r, g, b] = dress.colorRgb;
  const lab = sRGBtoLab(r, g, b);
  const quality = getMatchQuality(dress.deltaE);

  return (
    <div
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-[200] flex items-center justify-center p-8"
      style={{
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Color display */}
        <div
          className="relative h-[300px]"
          style={{
            background: dress.imageUrl
              ? undefined
              : `linear-gradient(145deg, rgb(${r},${g},${b}), rgb(${Math.max(0, r - 30)},${Math.max(0, g - 30)},${Math.max(0, b - 30)}))`,
          }}
        >
          {dress.imageUrl && (
            <img
              src={dress.imageUrl}
              alt={dress.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="glass absolute right-3.5 top-3.5 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-xl text-white transition-colors hover:bg-black/50"
          >
            ×
          </button>

          {/* Color comparison */}
          <div className="absolute bottom-4 left-4 flex gap-2">
            <div className="glass flex items-center gap-2 rounded-xl bg-black/60 px-3.5 py-2">
              <div
                className="h-5 w-5 rounded-full border-2 border-white/60"
                style={{ background: rgbToHex(...targetColor) }}
              />
              <span className="text-[11px] text-white">→</span>
              <div
                className="h-5 w-5 rounded-full border-2 border-white/60"
                style={{ background: rgbToHex(r, g, b) }}
              />
              <span className="font-mono text-xs text-white">
                ΔE {dress.deltaE.toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Product details */}
        <div className="px-6 pb-7 pt-6">
          <h3 className="font-display text-[22px] font-semibold text-neutral-900">
            {dress.name}
          </h3>
          <p className="mt-1 text-sm text-neutral-400">
            {dress.brand} · {dress.colorName}
            {dress.pattern && dress.pattern !== "solid" && (
              <> · {dress.pattern}</>
            )}
          </p>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-2xl font-semibold text-neutral-900">
              ${dress.price}
            </span>
            <a
              href={dress.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-neutral-900 px-7 py-3 text-sm font-medium tracking-wide text-white transition-colors hover:bg-neutral-700"
            >
              View at Retailer →
            </a>
          </div>

          {/* Technical color data */}
          <div className="mt-5 rounded-xl bg-parchment p-4 font-mono text-[11px] leading-relaxed text-neutral-400">
            <div>
              RGB: {r}, {g}, {b}
            </div>
            <div>HEX: {rgbToHex(r, g, b).toUpperCase()}</div>
            <div>Lab: {lab.map((v) => v.toFixed(1)).join(", ")}</div>
            <div>
              ΔE2000: {dress.deltaE.toFixed(2)} ({quality.replace("-", " ")})
            </div>
            {dress.category && <div>Category: {dress.category}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
