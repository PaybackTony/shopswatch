import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@db/index";
import { deltaE2000, sRGBtoLab, type Lab } from "@color-math/index";

export interface SearchResult {
  id: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  url: string;
  imageUrl: string;
  retailer: string;
  colorRgb: [number, number, number];
  colorHex: string;
  colorName: string;
  pattern: string | null;
  category: string | null;
  deltaE: number;
}

/**
 * GET /api/search?r=200&g=30&b=50&maxDe=30&limit=60&offset=0
 *
 * Search dresses by color, sorted by perceptual distance (CIEDE2000).
 *
 * The search happens in two stages:
 * 1. Postgres filters dresses within a bounding box in Lab space (fast, indexed)
 * 2. App layer computes exact ΔE2000 and sorts (precise, perceptual)
 *
 * This avoids computing ΔE for the entire catalog on every request.
 */
export async function GET(request: NextRequest) {
  try {
  const params = request.nextUrl.searchParams;

  const r = parseInt(params.get("r") ?? "");
  const g = parseInt(params.get("g") ?? "");
  const b = parseInt(params.get("b") ?? "");

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return NextResponse.json(
      { error: "Missing or invalid r, g, b parameters" },
      { status: 400 }
    );
  }

  const maxDe = parseFloat(params.get("maxDe") ?? "30");
  const limit = parseInt(params.get("limit") ?? "60");
  const offset = parseInt(params.get("offset") ?? "0");

  // Convert target color to Lab
  const targetLab: Lab = sRGBtoLab(r, g, b);

  // Stage 1: Coarse filter in Lab space using indexed columns.
  // A ΔE of ~30 roughly corresponds to ±30 units in L, ±40 in a/b.
  // We use generous bounds to avoid missing edge cases.
  const labMargin = maxDe * 1.5;

  const candidates = await prisma.dress.findMany({
    where: {
      available: true,
      colorLabL: { gte: targetLab[0] - labMargin, lte: targetLab[0] + labMargin },
      colorLabA: { gte: targetLab[1] - labMargin, lte: targetLab[1] + labMargin },
      colorLabB: { gte: targetLab[2] - labMargin, lte: targetLab[2] + labMargin },
    },
    select: {
      id: true,
      name: true,
      brand: true,
      price: true,
      currency: true,
      url: true,
      imageUrl: true,
      retailer: true,
      colorRgbR: true,
      colorRgbG: true,
      colorRgbB: true,
      colorHex: true,
      colorName: true,
      colorLabL: true,
      colorLabA: true,
      colorLabB: true,
      pattern: true,
      category: true,
    },
  });

  // Stage 2: Precise ΔE2000 calculation and sort
  const scored: SearchResult[] = candidates
    .map((d) => {
      const dressLab: Lab = [d.colorLabL, d.colorLabA, d.colorLabB];
      const de = deltaE2000(targetLab, dressLab);
      return {
        id: d.id,
        name: d.name,
        brand: d.brand,
        price: d.price,
        currency: d.currency,
        url: d.url,
        imageUrl: d.imageUrl,
        retailer: d.retailer,
        colorRgb: [d.colorRgbR, d.colorRgbG, d.colorRgbB] as [number, number, number],
        colorHex: d.colorHex,
        colorName: d.colorName,
        pattern: d.pattern,
        category: d.category,
        deltaE: de,
      };
    })
    .filter((d) => d.deltaE <= maxDe)
    .sort((a, b) => a.deltaE - b.deltaE);

  const paginated = scored.slice(offset, offset + limit);

  return NextResponse.json({
    results: paginated,
    total: scored.length,
    targetColor: { r, g, b, lab: targetLab },
    params: { maxDe, limit, offset },
  });
  } catch (err: any) {
    console.error("Search error:", err);
    return NextResponse.json({ error: err?.message ?? String(err), stack: err?.stack }, { status: 500 });
  }
}
