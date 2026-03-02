"use client";

import { useEffect, useRef } from "react";
import { relativeLuminance } from "@color-math/index";
import type { SwatchColorData } from "@/components/SwatchColorBar/SwatchColorBar";

interface SwatchColorPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  colors: SwatchColorData[];
  activeColorId: string | null;
  isOwner: boolean;
  onSelectColor: (color: SwatchColorData) => void;
  onAddColor: () => void;
  onRemoveColor: (id: string) => void;
}

export function SwatchColorPopover({
  isOpen,
  onClose,
  colors,
  activeColorId,
  isOwner,
  onSelectColor,
  onAddColor,
  onRemoveColor,
}: SwatchColorPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use setTimeout to avoid closing immediately from the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  return (
    <div
      ref={popoverRef}
      className={`absolute right-0 top-full mt-2 z-50 w-72 sm:w-80 rounded-2xl border border-neutral-100 bg-white p-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-all duration-200
        ${isOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-1 pointer-events-none"}
      `}
    >
      {/* Header */}
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
        Swatch Colors
      </p>

      {/* Color list */}
      <div className="flex flex-col gap-1 max-h-[280px] overflow-y-auto">
        {colors.map((color) => {
          const isActive = color.id === activeColorId;
          const lum = relativeLuminance(color.r, color.g, color.b);

          return (
            <button
              key={color.id}
              onClick={() => onSelectColor(color)}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors
                ${isActive ? "bg-neutral-50" : "hover:bg-neutral-50/60"}
              `}
            >
              {/* Color circle */}
              <div
                className="h-8 w-8 shrink-0 rounded-full"
                style={{
                  backgroundColor: color.hex,
                  boxShadow: isActive
                    ? "0 0 0 2px white, 0 0 0 3.5px #1a1a1a"
                    : "0 2px 6px rgba(0,0,0,0.12)",
                }}
              />

              {/* Color info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-700 truncate">
                  {color.name ?? color.hex.toUpperCase()}
                </p>
                {color.name && (
                  <p className="text-[11px] font-mono text-neutral-400">
                    {color.hex.toUpperCase()}
                  </p>
                )}
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="shrink-0 text-neutral-900">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}

              {/* Remove button (owner only, not on active) */}
              {isOwner && !isActive && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveColor(color.id);
                  }}
                  className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-neutral-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-neutral-100 hover:text-neutral-500"
                  title="Remove color"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </button>
          );
        })}
      </div>

      {/* Add color button (owner only) */}
      {isOwner && (
        <button
          onClick={() => {
            onAddColor();
            onClose();
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 py-2.5 text-sm font-medium text-neutral-400 transition-colors hover:border-neutral-300 hover:text-neutral-600"
        >
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
            <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add Color
        </button>
      )}
    </div>
  );
}
