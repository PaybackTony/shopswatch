"use client";

import { useEffect } from "react";
import { rgbToHex, sRGBtoLab, getMatchQuality } from "@color-math/index";
import type { SearchResult } from "@/app/api/search/route";

interface DetailModalProps {
  dress: SearchResult;
  targetColor: [number, number, number];
  onClose: () => void;
  isDevMode?: boolean;
}

export function DetailModal({ dress, targetColor, onClose, isDevMode }: DetailModalProps) {
  const [r, g, b] = dress.colorRgb;
  const lab = sRGBtoLab(r, g, b);
  const quality = getMatchQuality(dress.deltaE);

  const details: { label: string; value: string }[] = [];
  if (dress.category) details.push({ label: "Style", value: dress.category });
  if (dress.occasion) details.push({ label: "Occasion", value: dress.occasion });
  if (dress.fabric) details.push({ label: "Fabric", value: dress.fabric });
  if (dress.season) details.push({ label: "Season", value: dress.season });
  if (dress.pattern && dress.pattern !== "solid") details.push({ label: "Pattern", value: dress.pattern });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-8"
      style={{
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-h-[94dvh] sm:max-h-[88vh] flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl sm:max-w-[420px] sm:rounded-2xl"
      >
        <div className="flex-1 overflow-y-auto">
          {/* Image / color block */}
          <div
            className="relative"
            style={{
              minHeight: dress.imageUrl ? undefined : 280,
              background: dress.imageUrl
                ? undefined
                : `linear-gradient(145deg, rgb(${r},${g},${b}), rgb(${Math.max(0, r - 30)},${Math.max(0, g - 30)},${Math.max(0, b - 30)}))`,
            }}
          >
            {dress.imageUrl && (
              <img
                src={dress.imageUrl}
                alt={dress.name}
                className="block w-full"
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
                {isDevMode && (
                  <span className="font-mono text-xs text-white">
                    ΔE {dress.deltaE.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Product details */}
          <div className="px-6 pb-6 pt-5">
            <h3 className="font-display text-[22px] font-semibold text-neutral-900">
              {dress.name}
            </h3>
            <p className="mt-1 text-sm text-neutral-400">
              {dress.brand} · {dress.colorName}
            </p>

            {/* Product attributes */}
            {details.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {details.map(({ label, value }) => (
                  <span
                    key={label}
                    className="rounded-full bg-neutral-100 px-3 py-1 text-[12px] capitalize text-neutral-500"
                  >
                    {value}
                  </span>
                ))}
              </div>
            )}

            {/* Technical color data (dev only) */}
            {isDevMode && (
              <div className="mt-4 rounded-xl bg-parchment p-4 font-mono text-[11px] leading-relaxed text-neutral-400">
                <div>
                  RGB: {r}, {g}, {b}
                </div>
                <div>HEX: {rgbToHex(r, g, b).toUpperCase()}</div>
                <div>Lab: {lab.map((v) => v.toFixed(1)).join(", ")}</div>
                <div>
                  ΔE2000: {dress.deltaE.toFixed(2)} ({quality.replace("-", " ")})
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CTA area — pinned to bottom */}
        <div className="shrink-0 border-t border-neutral-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-semibold text-neutral-900">
              ${dress.price}
            </span>
            <a
              href={dress.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-neutral-900 px-7 py-3 text-sm font-medium tracking-wide text-white transition-colors hover:bg-neutral-700"
            >
              View at {dress.retailer ? dress.retailer.charAt(0).toUpperCase() + dress.retailer.slice(1) : "Retailer"} →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
