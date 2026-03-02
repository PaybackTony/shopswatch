"use client";

import type { SwatchColorData } from "@/components/SwatchColorBar/SwatchColorBar";

interface SwatchColorStackProps {
  colors: SwatchColorData[];
  activeColorId: string | null;
  isOwner: boolean;
  onClick: () => void;
  onAddClick: () => void;
}

const MAX_VISIBLE = 5;

export function SwatchColorStack({
  colors,
  activeColorId,
  isOwner,
  onClick,
  onAddClick,
}: SwatchColorStackProps) {
  const visible = colors.slice(0, MAX_VISIBLE);
  const overflow = colors.length - MAX_VISIBLE;

  return (
    <div className="flex items-center">
      {/* Clickable stack */}
      <button
        onClick={onClick}
        className="flex items-center -space-x-3.5 transition-opacity hover:opacity-90"
        aria-label={`${colors.length} swatch colors`}
      >
        {visible.map((color, index) => {
          const isActive = color.id === activeColorId;
          return (
            <div
              key={color.id}
              className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full border-2 border-white transition-transform
                ${isActive ? "ring-2 ring-neutral-900 ring-offset-1" : ""}
              `}
              style={{
                backgroundColor: color.hex,
                zIndex: colors.length - index,
              }}
            />
          );
        })}

        {overflow > 0 && (
          <div
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border-2 border-white bg-neutral-200 text-[11px] font-medium text-neutral-600"
            style={{ zIndex: 0 }}
          >
            +{overflow}
          </div>
        )}
      </button>

      {/* Add color button (owner only) */}
      {isOwner && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddClick();
          }}
          className="ml-1.5 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border-2 border-dashed border-neutral-300 text-neutral-400 transition-all hover:border-neutral-400 hover:text-neutral-600 hover:scale-110"
          title="Add a color"
        >
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
            <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
