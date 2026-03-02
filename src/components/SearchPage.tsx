"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ColorPickerDialog } from "@/components/ColorPickerDialog/ColorPickerDialog";
import { MasonryGrid } from "@/components/MasonryGrid/MasonryGrid";
import { DetailModal } from "@/components/DetailModal/DetailModal";
import { rgbToHex } from "@color-math/index";
import { useIsDevMode } from "@/lib/useIsDevMode";
import type { SearchResult } from "@/app/api/search/route";

const DEFAULT_COLOR: [number, number, number] = [188, 143, 143]; // Rosy Brown

export function SearchPage() {
  const router = useRouter();
  const isDevMode = useIsDevMode();
  const [selectedColor, setSelectedColor] = useState<
    [number, number, number] | null
  >(null);
  const [maxDeltaE, setMaxDeltaE] = useState(30);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedDress, setSelectedDress] = useState<SearchResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creatingSwatch, setCreatingSwatch] = useState(false);

  const searchByColor = useCallback(
    async (rgb: [number, number, number], maxDe = maxDeltaE) => {
      setSelectedColor(rgb);
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

  // Load default results on mount
  useEffect(() => {
    searchByColor(DEFAULT_COLOR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToleranceChange = (newMaxDe: number) => {
    setMaxDeltaE(newMaxDe);
    if (selectedColor) searchByColor(selectedColor, newMaxDe);
  };

  const clearFilter = () => {
    setSelectedColor(null);
    setResults([]);
    setTotal(0);
  };

  const createSwatch = async () => {
    setCreatingSwatch(true);
    try {
      const body: Record<string, unknown> = {};
      if (selectedColor) {
        body.color = {
          hex: rgbToHex(...selectedColor),
          r: selectedColor[0],
          g: selectedColor[1],
          b: selectedColor[2],
        };
      }
      const res = await fetch("/api/swatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/swatch/${data.id}?edit=${data.ownerToken}`);
      }
    } catch (err) {
      console.error("Failed to create swatch:", err);
    } finally {
      setCreatingSwatch(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-100 bg-cream/95 glass">
        <div className="mx-auto max-w-[1400px] px-6 py-5 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="shrink-0">
              <img
                src="/shoptheswatch.svg"
                alt="Shop the Swatch"
                className="h-10 sm:h-12 brightness-0"
              />
            </div>

            <div className="flex items-center gap-3">
              {/* Color selector */}
              <button
                onClick={() => setDialogOpen(true)}
                className="h-10 w-10 rounded-full border-2 border-white shadow-md transition-all hover:scale-110 hover:shadow-lg"
                style={{
                  background: selectedColor
                    ? rgbToHex(...selectedColor)
                    : "conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
                }}
                title={selectedColor ? rgbToHex(...selectedColor).toUpperCase() : "Choose a color"}
              />

              {/* Create Swatch CTA */}
              <button
                onClick={createSwatch}
                disabled={creatingSwatch}
                className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-neutral-700 disabled:opacity-50"
              >
                {creatingSwatch ? "Creating..." : "Create Swatch"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 sm:px-8">
        <section className="pb-12 pt-6">
          {/* Results bar */}
          {selectedColor && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] tracking-wide text-neutral-400">
                {loading
                  ? "Searching..."
                  : `${total} ${total === 1 ? "match" : "matches"}${isDevMode ? " · sorted by perceptual color distance" : " · sorted by best match"}`}
              </p>

              <div className="flex items-center gap-4">
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
                      ΔE {maxDeltaE}
                    </span>
                  </label>
                )}
                <button
                  onClick={clearFilter}
                  className="text-xs text-neutral-400 transition-colors hover:text-neutral-700"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
            </div>
          ) : selectedColor && results.length === 0 ? (
            <div className="animate-fade-in py-20 text-center">
              <div className="mb-4 text-5xl opacity-30">🎨</div>
              <p className="font-display text-xl text-neutral-400">
                No dresses within this color range
              </p>
              <p className="mt-2 text-[13px] text-neutral-300">
                {isDevMode ? "Try increasing the tolerance slider" : "Try selecting a different shade"}
              </p>
            </div>
          ) : !selectedColor ? (
            <div className="py-20 text-center">
              <button
                onClick={() => setDialogOpen(true)}
                className="font-display text-xl text-neutral-300 transition-colors hover:text-neutral-500"
              >
                Select a color to discover dresses →
              </button>
            </div>
          ) : (
            <MasonryGrid
              results={results}
              selectedColor={selectedColor}
              onDressClick={setSelectedDress}
              isDevMode={isDevMode}
            />
          )}
        </section>
      </div>

      {/* Color Picker Dialog */}
      <ColorPickerDialog
        isOpen={dialogOpen}
        initialColor={selectedColor}
        onClose={() => setDialogOpen(false)}
        onApply={searchByColor}
      />

      {/* Detail Modal */}
      {selectedDress && selectedColor && (
        <DetailModal
          dress={selectedDress}
          targetColor={selectedColor}
          onClose={() => setSelectedDress(null)}
          isDevMode={isDevMode}
        />
      )}
    </div>
  );
}
