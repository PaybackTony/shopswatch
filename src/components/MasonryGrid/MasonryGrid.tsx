"use client";

import { useState, useEffect } from "react";
import { DressCard } from "@/components/DressCard/DressCard";
import type { SearchResult } from "@/app/api/search/route";

interface MasonryGridProps {
  results: SearchResult[];
  selectedColor: [number, number, number];
  onDressClick: (dress: SearchResult) => void;
  isDevMode?: boolean;
}

/** Return the column count matching our CSS breakpoints. */
function getColumnCount(): number {
  if (typeof window === "undefined") return 2;
  const w = window.innerWidth;
  if (w >= 1280) return 5;
  if (w >= 1024) return 4;
  if (w >= 768) return 3;
  return 2;
}

/**
 * Distribute items round-robin across columns so the visual reading
 * order is left→right (row-first) while each column packs vertically
 * for a true masonry look.
 */
function distributeToColumns<T>(items: T[], cols: number): T[][] {
  const columns: T[][] = Array.from({ length: cols }, () => []);
  items.forEach((item, i) => {
    columns[i % cols].push(item);
  });
  return columns;
}

export function MasonryGrid({
  results,
  selectedColor,
  onDressClick,
  isDevMode,
}: MasonryGridProps) {
  const [colCount, setColCount] = useState(getColumnCount);

  useEffect(() => {
    const onResize = () => setColCount(getColumnCount());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const columns = distributeToColumns(results, colCount);

  return (
    <div className="masonry-grid">
      {columns.map((col, colIdx) => (
        <div key={colIdx} className="masonry-grid-column">
          {col.map((dress, rowIdx) => (
            <DressCard
              key={dress.id}
              dress={dress}
              index={rowIdx * colCount + colIdx}
              onClick={() => onDressClick(dress)}
              isDevMode={isDevMode}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
