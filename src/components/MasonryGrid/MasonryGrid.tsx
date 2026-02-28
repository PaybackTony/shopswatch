"use client";

import { DressCard } from "@/components/DressCard/DressCard";
import type { SearchResult } from "@/app/api/search/route";

interface MasonryGridProps {
  results: SearchResult[];
  selectedColor: [number, number, number];
  onDressClick: (dress: SearchResult) => void;
}

export function MasonryGrid({
  results,
  selectedColor,
  onDressClick,
}: MasonryGridProps) {
  return (
    <div className="masonry-grid">
      {results.map((dress, i) => (
        <DressCard
          key={dress.id}
          dress={dress}
          index={i}
          onClick={() => onDressClick(dress)}
        />
      ))}
    </div>
  );
}
