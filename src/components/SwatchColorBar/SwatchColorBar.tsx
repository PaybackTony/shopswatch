"use client";

import { relativeLuminance } from "@color-math/index";

export interface SwatchColorData {
  id: string;
  hex: string;
  r: number;
  g: number;
  b: number;
  name: string | null;
  sortOrder: number;
}

interface SwatchColorBarProps {
  colors: SwatchColorData[];
  activeColorId: string | null;
  isOwner: boolean;
  onSelectColor: (color: SwatchColorData) => void;
  onAddColor: () => void;
  onRemoveColor: (id: string) => void;
}

export function SwatchColorBar({
  colors,
  activeColorId,
  isOwner,
  onSelectColor,
  onAddColor,
  onRemoveColor,
}: SwatchColorBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {colors.map((color) => {
        const isActive = color.id === activeColorId;
        const lum = relativeLuminance(color.r, color.g, color.b);
        const xColor = lum > 0.35 ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.7)";

        return (
          <div key={color.id} className="group relative">
            <button
              onClick={() => onSelectColor(color)}
              title={color.name ?? color.hex.toUpperCase()}
              className="relative h-11 w-11 rounded-full transition-all duration-200 hover:scale-110"
              style={{
                background: color.hex,
                boxShadow: isActive
                  ? `0 0 0 2.5px white, 0 0 0 4.5px #1a1a1a, 0 4px 12px ${color.hex}55`
                  : `0 2px 8px rgba(0,0,0,0.15)`,
              }}
            />

            {/* Color name tooltip */}
            {color.name && (
              <span className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100">
                {color.name}
              </span>
            )}

            {/* Remove button (owner only) */}
            {isOwner && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveColor(color.id);
                }}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs leading-none shadow-md opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: xColor }}
                title="Remove color"
              >
                ×
              </button>
            )}
          </div>
        );
      })}

      {/* Add color button (owner only) */}
      {isOwner && (
        <button
          onClick={onAddColor}
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-neutral-300 text-neutral-400 transition-all hover:border-neutral-400 hover:text-neutral-600 hover:scale-110"
          title="Add a color"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
