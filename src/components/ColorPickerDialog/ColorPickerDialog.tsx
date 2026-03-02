"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { HexColorPicker } from "react-colorful";
import { hexToRgb, rgbToHex, relativeLuminance } from "@color-math/index";
import { ImageColorSampler } from "@/components/ImageColorSampler/ImageColorSampler";

const STORAGE_KEY = "sts_recent_colors";
const MAX_RECENT = 8;

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecent(hex: string): void {
  const prev = loadRecent();
  const next = [hex, ...prev.filter((c) => c !== hex)].slice(0, MAX_RECENT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

type Mode = "picker" | "image";

interface Props {
  isOpen: boolean;
  initialColor: [number, number, number] | null;
  onClose: () => void;
  onApply: (rgb: [number, number, number]) => void;
}

export function ColorPickerDialog({
  isOpen,
  initialColor,
  onClose,
  onApply,
}: Props) {
  const [mode, setMode] = useState<Mode>("picker");
  const [hex, setHex] = useState(
    initialColor ? rgbToHex(...initialColor) : "#c08080"
  );
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setRecentColors(loadRecent());
    setMode("picker");
    if (initialColor) setHex(rgbToHex(...initialColor));
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleApply = useCallback(() => {
    const rgb = hexToRgb(hex);
    saveRecent(hex);
    onApply(rgb);
    onClose();
  }, [hex, onApply, onClose]);

  const handleImageColor = useCallback(
    (rgb: [number, number, number]) => {
      const h = rgbToHex(...rgb);
      saveRecent(h);
      onApply(rgb);
      onClose();
    },
    [onApply, onClose]
  );

  if (!isOpen) return null;

  const isValid = /^#[0-9a-fA-F]{6}$/.test(hex);
  const displayHex = isValid ? hex : "#c08080";
  const [r, g, b] = hexToRgb(displayHex);
  const lum = relativeLuminance(r, g, b);
  const textOnColor = lum > 0.35 ? "#1a1a1a" : "#ffffff";
  const textOnColorMuted = lum > 0.35 ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.55)";

  const headerBg = mode === "picker" ? displayHex : "#141414";
  const headerLum =
    mode === "picker" ? lum : 0;
  const headerText = headerLum > 0.35 ? "#1a1a1a" : "#ffffff";
  const headerTextMuted =
    headerLum > 0.35 ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className="animate-fade-in w-full max-h-[94dvh] overflow-y-auto rounded-[24px] bg-white shadow-[0_32px_80px_rgba(0,0,0,0.28)] sm:max-w-[580px] sm:max-h-[88vh] sm:rounded-[28px]">

        {/* ── Color band header ── */}
        <div
          className="relative px-7 pb-5 pt-6 transition-colors duration-300"
          style={{ background: headerBg }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.15em]"
                style={{ color: headerTextMuted }}>
                Shop by Color
              </p>
              <h2
                className="font-display text-[26px] font-semibold leading-tight tracking-tight"
                style={{ color: headerText }}
              >
                {mode === "picker" ? displayHex.toUpperCase() : "From Image"}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none transition-colors"
              style={{
                color: headerTextMuted,
                background: headerLum > 0.35 ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)",
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Tab strip ── */}
        <div className="border-b border-neutral-100 px-7 pt-4">
          <div className="flex gap-5">
            {(["picker", "image"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="relative pb-3 text-[13px] font-medium transition-colors"
                style={{ color: mode === m ? "#1a1a1a" : "#a3a3a3" }}
              >
                {m === "picker" ? "Color Picker" : "From Image"}
                {mode === m && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                    style={{ background: displayHex }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="px-7 pb-7 pt-5">
          {mode === "picker" ? (
            <>
              {/* Gradient picker */}
              <div className="h-[220px] sm:h-[270px]">
                <HexColorPicker
                  color={displayHex}
                  onChange={setHex}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>

              {/* Hex input */}
              <div className="mt-5 flex items-center gap-3">
                <div
                  className="h-11 w-11 shrink-0 rounded-xl shadow-md"
                  style={{
                    background: displayHex,
                    boxShadow: `0 4px 14px ${displayHex}66`,
                  }}
                />
                <input
                  type="text"
                  value={hex.toUpperCase()}
                  onChange={(e) => {
                    let v = e.target.value;
                    if (!v.startsWith("#")) v = "#" + v;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setHex(v.toLowerCase());
                  }}
                  spellCheck={false}
                  className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-[15px] tracking-wider text-neutral-700 focus:border-neutral-400 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Recent colors */}
              {recentColors.length > 0 && (
                <div className="mt-6">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                    Recent
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {recentColors.map((c) => (
                      <button
                        key={c}
                        onClick={() => setHex(c)}
                        title={c.toUpperCase()}
                        className="h-8 w-8 rounded-full transition-transform hover:scale-110 active:scale-95"
                        style={{
                          background: c,
                          boxShadow:
                            displayHex === c
                              ? `0 0 0 2px white, 0 0 0 3.5px #1a1a1a`
                              : "0 2px 6px rgba(0,0,0,0.18)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-7 flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-2xl border border-neutral-200 py-3.5 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 rounded-2xl py-3.5 text-sm font-semibold tracking-wide shadow-lg transition-opacity hover:opacity-90"
                  style={{
                    background: displayHex,
                    color: textOnColor,
                    boxShadow: `0 8px 24px ${displayHex}55`,
                  }}
                >
                  Search
                </button>
              </div>
            </>
          ) : (
            <ImageColorSampler onColorSelect={handleImageColor} />
          )}
        </div>
      </div>
    </div>
  );
}
