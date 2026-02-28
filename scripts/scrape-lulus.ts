/**
 * Lulus bridal catalog scraper.
 *
 * Uses Lulus' public search API — no auth, no GraphQL.
 * One DB row per product × color swatch. Color is derived from
 * the colorName using a fashion color lookup table so search works
 * immediately. Claude enrichment (npm run enrich) then improves
 * accuracy and adds pattern/fabric/category metadata.
 *
 * Usage:
 *   tsx scripts/scrape-lulus.ts
 *   tsx scripts/scrape-lulus.ts --limit=50
 *   tsx scripts/scrape-lulus.ts --dry-run
 */

import { PrismaClient } from "@prisma/client";
import { sRGBtoLab, hexToRgb } from "../lib/color-math/src/index";

const prisma = new PrismaClient();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1]) : Infinity;

// ── Fashion color name → hex lookup ──────────────────────────────────────────
const COLOR_MAP: Record<string, string> = {
  // Blues
  "navy": "#0d1b4b", "navy blue": "#0d1b4b", "dark navy": "#0a1535",
  "blue": "#4169e1", "royal blue": "#2551c3", "cobalt": "#0047ab",
  "dusty blue": "#7096a8", "slate blue": "#6a84a0", "powder blue": "#b0c4de",
  "sky blue": "#87ceeb", "cornflower blue": "#6495ed", "periwinkle": "#ccccff",
  "denim": "#1560bd", "ocean": "#0077b6", "steel blue": "#4682b4",
  // Pinks
  "blush": "#e8b4b8", "pink": "#ffc0cb", "light pink": "#ffb6c1",
  "dusty rose": "#c9a0a0", "dusty pink": "#c9a0a0", "rose": "#c9677c",
  "hot pink": "#ff69b4", "magenta": "#ff00ff", "fuchsia": "#ff00ff",
  "mauve": "#d4a5a5", "nude": "#f2c4a0", "blush pink": "#e8b4b8",
  "rose gold": "#b76e79",
  // Purples
  "lavender": "#b57edc", "purple": "#7b2d8b", "violet": "#8f00ff",
  "plum": "#843179", "wisteria": "#c9a0dc", "lilac": "#c8a2c8",
  "orchid": "#da70d6", "grape": "#6f2da8", "amethyst": "#9966cc",
  "burgundy": "#800020",
  // Greens
  "sage": "#77916f", "dusty sage": "#7f9e7f", "olive": "#808000",
  "forest green": "#228b22", "dark green": "#006400", "hunter green": "#355e3b",
  "mint": "#98ff98", "mint green": "#98ff98", "emerald": "#50c878",
  "teal": "#008080", "turquoise": "#40e0d0", "jade": "#00a86b",
  "eucalyptus": "#44a882", "moss": "#8a9a5b", "fern": "#4f7942",
  // Reds & Warm
  "red": "#cc0000", "wine": "#722f37", "merlot": "#73343a",
  "cranberry": "#9b1b30", "crimson": "#dc143c", "scarlet": "#ff2400",
  "coral": "#ff6b6b", "terracotta": "#e27946", "rust": "#b7410e",
  "copper": "#b87333", "sienna": "#a0522d",
  // Oranges & Yellows
  "orange": "#ff8c00", "peach": "#ffcba4", "apricot": "#fbceb1",
  "yellow": "#ffd700", "lemon": "#fff44f", "butter": "#fffacd",
  "mustard": "#ffdb58", "gold": "#ffd700",
  // Neutrals
  "white": "#ffffff", "ivory": "#fffff0", "off white": "#faf0e6",
  "cream": "#fffdd0", "champagne": "#f7e7ce", "champagne gold": "#f7e7ce",
  "silver": "#c0c0c0", "gray": "#808080", "grey": "#808080",
  "light gray": "#d3d3d3", "charcoal": "#36454f", "black": "#000000",
  "tan": "#d2b48c", "camel": "#c19a6b", "beige": "#f5f5dc",
  "taupe": "#b5a698", "brown": "#8b4513", "chocolate": "#7b3f00",
  // Metallics
  "bronze": "#cd7f32", "platinum": "#e5e4e2",
  // Patterns (use dominant color)
  "floral": "#c9a0a0", "print": "#808080", "multi": "#808080",
};

function colorNameToHex(name: string): string {
  const key = name.toLowerCase().trim();
  // Exact match
  if (COLOR_MAP[key]) return COLOR_MAP[key];
  // Partial match — find the longest key that appears in the name
  let best = "";
  for (const k of Object.keys(COLOR_MAP)) {
    if (key.includes(k) && k.length > best.length) best = k;
  }
  return COLOR_MAP[best] ?? "#888888"; // fallback: medium gray
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36",
  "Accept": "application/json",
};

async function main() {
  console.log(`\n💗  Lulus scraper${DRY_RUN ? " (dry run)" : ""}\n`);

  let page = 1;
  let imported = 0;
  let skipped = 0;
  let morePages = true;

  while (morePages && imported < LIMIT) {
    process.stdout.write(`Page ${page} ... `);

    const res = await fetch(
      `https://www.lulus.com/api/search/products/433?p=${page}&subsite=bridal`,
      { headers: HEADERS }
    );

    if (!res.ok) {
      console.log(`HTTP ${res.status} — stopping`);
      break;
    }

    const json = (await res.json()) as any;
    const products = json?.content?.products;

    if (!products?.length) {
      console.log("no more products");
      morePages = false;
      break;
    }

    console.log(`${products.length} products`);

    for (const product of products) {
      if (imported >= LIMIT) break;

      for (const swatch of product.swatches ?? []) {
        if (imported >= LIMIT) break;

        const imageUrl = swatch.images?.[0]?.imagePath
          ? `https://www.lulus.com${swatch.images[0].imagePath}`
          : null;

        if (!imageUrl) { skipped++; continue; }

        const swatchId = String(swatch.id);
        const name: string = swatch.name ?? "";
        const colorName: string = swatch.colorName ?? "";
        const price: number = swatch.productPrice?.updatedPrice ?? 0;
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const url = `https://www.lulus.com/products/${slug}/${swatchId}`;

        const hex = colorNameToHex(colorName || name);
        const [r, g, b] = hexToRgb(hex);
        const lab = sRGBtoLab(r, g, b);

        if (DRY_RUN) {
          console.log(`  [dry] ${name} / ${colorName} → ${hex}`);
          imported++;
          continue;
        }

        try {
          await prisma.dress.upsert({
            where: { retailer_externalId: { retailer: "lulus", externalId: swatchId } },
            create: {
              name,
              brand: "Lulus",
              price,
              currency: "USD",
              url,
              imageUrl,
              retailer: "lulus",
              externalId: swatchId,
              available: true,
              colorRgbR: r,
              colorRgbG: g,
              colorRgbB: b,
              colorLabL: lab[0],
              colorLabA: lab[1],
              colorLabB: lab[2],
              colorHex: hex,
              colorName,
              enrichedAt: null, // Claude will verify & improve color accuracy
            },
            update: {
              name,
              price,
              imageUrl,
              url,
              available: true,
            },
          });
          imported++;
        } catch (err: any) {
          skipped++;
        }
      }
    }

    page++;
    await wait(400);
  }

  console.log(`\n✅  Done!`);
  console.log(`   Imported : ${imported}`);
  console.log(`   Skipped  : ${skipped}`);
  if (!DRY_RUN && imported > 0) {
    console.log(`\nRun  ENRICH_CONCURRENCY=10 npm run enrich  to let Claude analyze each dress.`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
