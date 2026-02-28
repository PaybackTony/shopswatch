"use client";

import { useState } from "react";
import { rgbToHex, relativeLuminance, getMatchQuality } from "@color-math/index";
import type { SearchResult } from "@/app/api/search/route";

interface DressCardProps {
  dress: SearchResult;
  index: number;
  onClick: () => void;
}

const QUALITY_COLORS: Record<string, string> = {
  exact: "#22c55e",
  "near-exact": "#22c55e",
  "very-close": "#84cc16",
  close: "#eab308",
  similar: "#f97316",
  distant: "#94a3b8",
};

const QUALITY_LABELS: Record<string, string> = {
  exact: "Exact Match",
  "near-exact": "Near Exact",
  "very-close": "Very Close",
  close: "Close",
  similar: "Similar",
  distant: "Distant",
};

/**
 * Deterministic pseudo-random card height based on dress ID.
 * In production, this would be the actual image aspect ratio.
 */
function cardHeight(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return 280 + (Math.abs(hash) % 180);
}

export function DressCard({ dress, index, onClick }: DressCardProps) {
  const [hovered, setHovered] = useState(false);

  const [r, g, b] = dress.colorRgb;
  const lum = relativeLuminance(r, g, b);
  const textColor = lum > 0.55 ? "#1a1a1a" : "#fafafa";
  const subtextColor =
    lum > 0.55 ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.55)";

  const quality = getMatchQuality(dress.deltaE);
  const qualityColor = QUALITY_COLORS[quality];
  const qualityLabel = QUALITY_LABELS[quality];
  const height = cardHeight(dress.id);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="animate-card-in mb-4 cursor-pointer overflow-hidden rounded-2xl"
      style={{
        breakInside: "avoid",
        animationDelay: `${index * 40}ms`,
        transition:
          "transform 0.3s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.3s ease",
        transform: hovered
          ? "translateY(-4px) scale(1.015)"
          : "translateY(0) scale(1)",
        boxShadow: hovered
          ? "0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)"
          : "0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
      }}
    >
      {/* Product image / color block */}
      <div
        className="relative flex flex-col justify-end p-4"
        style={{
          height,
          background: dress.imageUrl
            ? undefined
            : `linear-gradient(145deg, rgb(${r},${g},${b}), rgb(${Math.max(0, r - 20)},${Math.max(0, g - 20)},${Math.max(0, b - 20)}))`,
        }}
      >
        {/* If we have an actual product image, show it */}
        {dress.imageUrl && (
          <img
            src={dress.imageUrl}
            alt={dress.name}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        )}

        {/* Fabric texture overlay (for color blocks without images) */}
        {!dress.imageUrl && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(${lum > 0.5 ? "0,0,0" : "255,255,255"},0.02) 1px, rgba(${lum > 0.5 ? "0,0,0" : "255,255,255"},0.02) 2px)`,
            }}
          />
        )}

        {/* Match badge */}
        <div className="glass absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5">
          <div
            className="h-2 w-2 rounded-full"
            style={{
              background: qualityColor,
              boxShadow: `0 0 6px ${qualityColor}`,
            }}
          />
          <span className="text-[11px] font-medium tracking-wide text-white">
            {qualityLabel} · ΔE {dress.deltaE.toFixed(1)}
          </span>
        </div>

        {/* Color name */}
        <div
          className="glass absolute right-3 top-3 rounded-lg px-2.5 py-1"
          style={{
            background: `rgba(${lum > 0.5 ? "0,0,0,0.08" : "255,255,255,0.12"})`,
          }}
        >
          <span
            className="text-[10px] font-medium uppercase tracking-wider"
            style={{ color: textColor }}
          >
            {dress.colorName}
          </span>
        </div>

        {/* Gradient overlay */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              lum > 0.55
                ? "linear-gradient(transparent, rgba(0,0,0,0.06))"
                : "linear-gradient(transparent, rgba(0,0,0,0.25))",
          }}
        />

        {/* Product info */}
        <div className="relative z-10">
          <div
            className="font-display text-[17px] font-semibold leading-tight"
            style={{ color: textColor }}
          >
            {dress.name}
          </div>
          <div
            className="mt-1 flex items-center justify-between text-xs tracking-wide"
            style={{ color: subtextColor }}
          >
            <span>{dress.brand}</span>
            <span className="font-semibold" style={{ color: textColor }}>
              ${dress.price}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
