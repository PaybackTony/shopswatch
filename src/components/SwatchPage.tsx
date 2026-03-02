"use client";

import { useState, useCallback, useEffect } from "react";
import { ColorPickerDialog } from "@/components/ColorPickerDialog/ColorPickerDialog";
import { MasonryGrid } from "@/components/MasonryGrid/MasonryGrid";
import { DetailModal } from "@/components/DetailModal/DetailModal";
import { type SwatchColorData } from "@/components/SwatchColorBar/SwatchColorBar";
import { SwatchColorStack } from "@/components/SwatchColorStack/SwatchColorStack";
import { SwatchColorPopover } from "@/components/SwatchColorPopover/SwatchColorPopover";
import { ShareButton } from "@/components/ShareButton/ShareButton";
import { rgbToHex } from "@color-math/index";
import { useIsDevMode } from "@/lib/useIsDevMode";
import type { SearchResult } from "@/app/api/search/route";

interface SwatchPageProps {
  swatch: {
    id: string;
    name: string | null;
    colors: SwatchColorData[];
    createdAt: string;
  };
  isOwner: boolean;
  ownerToken?: string;
}

export function SwatchPage({ swatch, isOwner, ownerToken }: SwatchPageProps) {
  const isDevMode = useIsDevMode();
  const [colors, setColors] = useState<SwatchColorData[]>(swatch.colors);
  const [activeColor, setActiveColor] = useState<SwatchColorData | null>(
    swatch.colors[0] ?? null
  );
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [maxDeltaE, setMaxDeltaE] = useState(30);
  const [selectedDress, setSelectedDress] = useState<SearchResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [mutating, setMutating] = useState(false);

  const selectedColorRgb: [number, number, number] | null = activeColor
    ? [activeColor.r, activeColor.g, activeColor.b]
    : null;

  // ── Auto-search the first color on mount ──
  useEffect(() => {
    if (activeColor) {
      searchByColor([activeColor.r, activeColor.g, activeColor.b]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Search by color ──
  const searchByColor = useCallback(
    async (rgb: [number, number, number], maxDe = maxDeltaE) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          r: rgb[0].toString(),
          g: rgb[1].toString(),
          b: rgb[2].toString(),
          maxDe: maxDe.toString(),
          limit: "80",
        });
        const res = await fetch(`/api/search?${params}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setTotal(data.total ?? 0);
      } catch (err) {
        console.error("Search failed:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [maxDeltaE]
  );

  // ── Select a swatch color to search ──
  const handleSelectColor = useCallback(
    (color: SwatchColorData) => {
      setActiveColor(color);
      searchByColor([color.r, color.g, color.b]);
    },
    [searchByColor]
  );

  // ── Tolerance change ──
  const handleToleranceChange = useCallback(
    (newMaxDe: number) => {
      setMaxDeltaE(newMaxDe);
      if (activeColor) {
        searchByColor([activeColor.r, activeColor.g, activeColor.b], newMaxDe);
      }
    },
    [activeColor, searchByColor]
  );

  // ── Add color (owner only) ──
  const handleAddColor = useCallback(
    async (rgb: [number, number, number]) => {
      if (!ownerToken) return;
      setMutating(true);
      try {
        const hex = rgbToHex(...rgb);
        const res = await fetch(`/api/swatch/${swatch.id}/colors`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerToken,
            color: { hex, r: rgb[0], g: rgb[1], b: rgb[2] },
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setColors(data.colors);
          // Auto-select the newly added color
          const newest = data.colors[data.colors.length - 1];
          if (newest) {
            setActiveColor(newest);
            searchByColor([newest.r, newest.g, newest.b]);
          }
        }
      } catch (err) {
        console.error("Failed to add color:", err);
      } finally {
        setMutating(false);
      }
    },
    [ownerToken, swatch.id, searchByColor]
  );

  // ── Remove color (owner only) ──
  const handleRemoveColor = useCallback(
    async (colorId: string) => {
      if (!ownerToken) return;
      setMutating(true);
      try {
        const res = await fetch(
          `/api/swatch/${swatch.id}/colors/${colorId}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ownerToken }),
          }
        );
        const data = await res.json();
        if (res.ok) {
          setColors(data.colors);
          // If we removed the active color, select the first remaining one
          if (activeColor?.id === colorId) {
            const next = data.colors[0] ?? null;
            setActiveColor(next);
            if (next) {
              searchByColor([next.r, next.g, next.b]);
            } else {
              setResults([]);
              setTotal(0);
            }
          }
        }
      } catch (err) {
        console.error("Failed to remove color:", err);
      } finally {
        setMutating(false);
      }
    },
    [ownerToken, swatch.id, activeColor, searchByColor]
  );

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-40 overflow-visible border-b border-neutral-100 bg-cream/95 glass">
        <div className="mx-auto max-w-[1400px] px-6 py-4 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            {/* Logo */}
            <a href="/" className="shrink-0">
              <img
                src="/shoptheswatch.svg"
                alt="Shop the Swatch"
                className="h-10 sm:h-12 brightness-0"
              />
            </a>

            {/* Right side: Swatch + Share */}
            <div className="flex items-center gap-3">
              {colors.length > 0 && (
                <div className="relative">
                  <div className="rounded-full bg-white/90 px-3 py-1.5 shadow-sm border border-neutral-100">
                    <SwatchColorStack
                      colors={colors}
                      activeColorId={activeColor?.id ?? null}
                      isOwner={isOwner}
                      onClick={() => setPopoverOpen(!popoverOpen)}
                      onAddClick={() => setDialogOpen(true)}
                    />
                  </div>
                  <SwatchColorPopover
                    isOpen={popoverOpen}
                    onClose={() => setPopoverOpen(false)}
                    colors={colors}
                    activeColorId={activeColor?.id ?? null}
                    isOwner={isOwner}
                    onSelectColor={(color) => {
                      handleSelectColor(color);
                      setPopoverOpen(false);
                    }}
                    onAddColor={() => setDialogOpen(true)}
                    onRemoveColor={handleRemoveColor}
                  />
                </div>
              )}

              {/* Share button (desktop) */}
              <div className="hidden sm:block shrink-0">
                <ShareButton swatchId={swatch.id} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 sm:px-8">
        <section className="pb-12 pt-6">
          {/* Results bar */}
          {activeColor && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] tracking-wide text-neutral-400">
                {loading
                  ? "Searching..."
                  : `${total} ${total === 1 ? "match" : "matches"} for ${activeColor.name ?? activeColor.hex.toUpperCase()}${isDevMode ? " · sorted by perceptual color distance" : " · sorted by best match"}`}
              </p>

              {isDevMode && (
                <label className="flex items-center gap-2 text-xs text-neutral-400">
                  <span>Tolerance</span>
                  <input
                    type="range"
                    min={5}
                    max={60}
                    value={maxDeltaE}
                    onChange={(e) =>
                      handleToleranceChange(Number(e.target.value))
                    }
                    className="w-24"
                  />
                  <span className="min-w-[36px] font-mono text-[11px] text-neutral-500">
                    &Delta;E {maxDeltaE}
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Content area */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
            </div>
          ) : colors.length === 0 ? (
            <div className="py-20 text-center">
              {isOwner ? (
                <button
                  onClick={() => setDialogOpen(true)}
                  className="font-display text-xl text-neutral-300 transition-colors hover:text-neutral-500"
                >
                  Add your first color to get started &rarr;
                </button>
              ) : (
                <p className="font-display text-xl text-neutral-300">
                  This swatch has no colors yet
                </p>
              )}
            </div>
          ) : !activeColor ? (
            <div className="py-20 text-center">
              <p className="font-display text-xl text-neutral-300">
                Select a color above to discover matching dresses
              </p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="animate-fade-in py-20 text-center">
              <div className="mb-4 text-5xl opacity-30">🎨</div>
              <p className="font-display text-xl text-neutral-400">
                No dresses within this color range
              </p>
              <p className="mt-2 text-[13px] text-neutral-300">
                {isDevMode ? "Try increasing the tolerance slider" : "Try selecting a different shade"}
              </p>
            </div>
          ) : (
            <MasonryGrid
              results={results}
              selectedColor={selectedColorRgb!}
              onDressClick={setSelectedDress}
              isDevMode={isDevMode}
            />
          )}
        </section>
      </div>

      {/* Color Picker Dialog (owner only) */}
      {isOwner && (
        <ColorPickerDialog
          isOpen={dialogOpen}
          initialColor={selectedColorRgb}
          onClose={() => setDialogOpen(false)}
          onApply={handleAddColor}
        />
      )}

      {/* Share button (mobile floating) */}
      <div className="fixed bottom-5 right-5 z-40 sm:hidden">
        <ShareButton swatchId={swatch.id} />
      </div>

      {/* Detail Modal */}
      {selectedDress && selectedColorRgb && (
        <DetailModal
          dress={selectedDress}
          targetColor={selectedColorRgb}
          onClose={() => setSelectedDress(null)}
          isDevMode={isDevMode}
        />
      )}
    </div>
  );
}
