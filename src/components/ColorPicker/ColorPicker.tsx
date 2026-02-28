"use client";

import { useState } from "react";
import { COLOR_PRESETS } from "@/lib/color-presets";
import { rgbToHex, hexToRgb, relativeLuminance } from "@color-math/index";

interface ColorPickerProps {
  selectedColor: [number, number, number] | null;
  onColorChange: (rgb: [number, number, number]) => void;
}

export function ColorPicker({ selectedColor, onColorChange }: ColorPickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customHex, setCustomHex] = useState("#c28686");

  const isSelected = (rgb: [number, number, number]) =>
    selectedColor?.[0] === rgb[0] &&
    selectedColor?.[1] === rgb[1] &&
    selectedColor?.[2] === rgb[2];

  return (
    <div>
      {/* Preset grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-2">
        {COLOR_PRESETS.map((preset) => {
          const hex = rgbToHex(...preset.rgb);
          const selected = isSelected(preset.rgb);
          const lum = relativeLuminance(...preset.rgb);

          return (
            <button
              key={preset.name}
              onClick={() => onColorChange(preset.rgb)}
              className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border bg-white px-1 pb-2 pt-2.5 transition-all"
              style={{
                borderColor: selected
                  ? "#1a1a1a"
                  : `rgba(0,0,0,${lum > 0.9 ? 0.12 : 0.06})`,
                borderWidth: selected ? 2 : 1,
                transform: selected ? "scale(1.05)" : "scale(1)",
                boxShadow: selected ? "0 4px 12px rgba(0,0,0,0.12)" : "none",
              }}
            >
              <div
                className="h-9 w-9 rounded-full"
                style={{
                  background: hex,
                  border: `1px solid rgba(0,0,0,${lum > 0.9 ? 0.1 : 0.04})`,
                  boxShadow: selected ? "0 0 0 3px rgba(0,0,0,0.08)" : "none",
                }}
              />
              <span
                className="text-[10px] tracking-wide text-neutral-500"
                style={{ fontWeight: selected ? 600 : 400 }}
              >
                {preset.name}
              </span>
            </button>
          );
        })}

        {/* Custom color toggle */}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed border-neutral-300 bg-white px-1 pb-2 pt-2.5 transition-all hover:border-neutral-400"
          style={{ background: showCustom ? "#f8f6f3" : "#fff" }}
        >
          <div
            className="h-9 w-9 rounded-full opacity-70"
            style={{
              background:
                "conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
            }}
          />
          <span className="text-[10px] tracking-wide text-neutral-500">
            Custom
          </span>
        </button>
      </div>

      {/* Custom picker */}
      {showCustom && (
        <div className="mt-4 flex items-center gap-4 rounded-xl bg-parchment p-4">
          <input
            type="color"
            value={customHex}
            onChange={(e) => {
              setCustomHex(e.target.value);
              onColorChange(hexToRgb(e.target.value));
            }}
            className="h-12 w-12 cursor-pointer rounded-lg border-none bg-transparent p-0"
          />
          <div>
            <div className="text-[13px] font-medium text-neutral-700">
              Pick any color
            </div>
            <div className="mt-0.5 font-mono text-xs text-neutral-400">
              {customHex.toUpperCase()}
            </div>
          </div>
          <button
            onClick={() => onColorChange(hexToRgb(customHex))}
            className="ml-auto rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-700"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
