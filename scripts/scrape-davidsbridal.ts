/**
 * David's Bridal catalog scraper.
 *
 * Uses David's Bridal Remix data endpoint (same JSON their site fetches).
 * Returns one hero variant per product with hex_code + CDN image.
 * Cursor-based pagination via Shopify endCursor.
 * Lab values computed directly from the hex — no separate color lookup needed.
 *
 * Usage:
 *   tsx scripts/scrape-davidsbridal.ts
 *   tsx scripts/scrape-davidsbridal.ts --limit=50
 *   tsx scripts/scrape-davidsbridal.ts --dry-run
 */

import { PrismaClient } from "@prisma/client";
import { hexToRgb, sRGBtoLab } from "../packages/color-math/src/index";

const prisma = new PrismaClient();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1]) : Infinity;

const BASE_URL = "https://www.davidsbridal.com";
const REMIX_ENDPOINT =
  `${BASE_URL}/bridesmaids/bridesmaid-dresses` +
  `?sc=nav_bridesmaids_allbridesmaids` +
  `&_data=routes%2F%28%24locale%29.%24menuItem.%24collectionHandle._index`;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer":
    "https://www.davidsbridal.com/bridesmaids/bridesmaid-dresses?sc=nav_bridesmaids_allbridesmaids",
  "sec-ch-ua": `"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"`,
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": `"macOS"`,
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
};

function normalizeHex(hex: string): string {
  if (!hex) return "#888888";
  hex = hex.replace(/^#/, "").trim();
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length !== 6) return "#888888";
  return "#" + hex.toLowerCase();
}

async function fetchPage(cursor?: string) {
  const url = cursor
    ? `${REMIX_ENDPOINT}&after=${encodeURIComponent(cursor)}`
    : REMIX_ENDPOINT;

  const res = await fetch(url, { headers: HEADERS });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from David's Bridal endpoint`);
  }

  const json = (await res.json()) as any;
  const products = json?.collection?.products;
  if (!products?.nodes) {
    throw new Error("Unexpected response shape — no collection.products.nodes");
  }

  return {
    nodes: products.nodes as any[],
    pageInfo: products.pageInfo as {
      hasNextPage: boolean;
      endCursor: string;
    },
  };
}

async function main() {
  console.log(`\n💒  David's Bridal scraper${DRY_RUN ? " (dry run)" : ""}\n`);

  let cursor: string | undefined;
  let page = 1;
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let hasNextPage = true;

  while (hasNextPage && imported < LIMIT) {
    process.stdout.write(`Page ${page} ... `);

    let nodes: any[];
    let pageInfo: { hasNextPage: boolean; endCursor: string };

    try {
      ({ nodes, pageInfo } = await fetchPage(cursor));
      console.log(`${nodes.length} products`);
    } catch (err: any) {
      console.error(`\n  Error: ${err.message}`);
      break;
    }

    for (const product of nodes) {
      if (imported >= LIMIT) break;

      const variant = product.variants?.nodes?.[0];
      if (!variant) { skipped++; continue; }

      const imageUrl: string = variant.image?.url ?? "";
      if (!imageUrl) { skipped++; continue; }

      const hexRaw: string =
        (variant.variantColorCode ?? []).find(
          (m: any) => m.key === "hex_code"
        )?.value ?? "";
      if (!hexRaw) { skipped++; continue; }

      const colorOpt = (variant.selectedOptions ?? []).find(
        (o: any) => o.name === "Color"
      );
      const colorName: string = colorOpt?.value ?? hexRaw.toUpperCase();

      const hex = normalizeHex(hexRaw);
      const [r, g, b] = hexToRgb(hex);
      const lab = sRGBtoLab(r, g, b);

      const externalId = variant.sku ?? `${product.handle}-${hexRaw}`;
      const price = parseFloat(variant.price?.amount ?? "0");
      const url = `${BASE_URL}/${product.handle}`;

      if (DRY_RUN) {
        console.log(`  [dry] ${product.title} / ${colorName} → ${hex}`);
        imported++;
        continue;
      }

      try {
        await prisma.dress.upsert({
          where: {
            retailer_externalId: { retailer: "davids-bridal", externalId },
          },
          create: {
            name: product.title,
            brand: "David's Bridal",
            price,
            currency: "USD",
            url,
            imageUrl,
            retailer: "davids-bridal",
            externalId,
            available: variant.availableForSale ?? true,
            colorRgbR: r,
            colorRgbG: g,
            colorRgbB: b,
            colorLabL: lab[0],
            colorLabA: lab[1],
            colorLabB: lab[2],
            colorHex: hex,
            colorName,
            enrichedAt: null,
          },
          update: {
            name: product.title,
            price,
            imageUrl,
            url,
            available: variant.availableForSale ?? true,
          },
        });
        imported++;
      } catch (err: any) {
        errors++;
      }
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
    page++;

    // Polite delay between pages — avoid triggering rate limits
    if (hasNextPage && imported < LIMIT) await wait(1500);
  }

  console.log(`\n✅  Done!`);
  console.log(`   Imported : ${imported}`);
  console.log(`   Skipped  : ${skipped}`);
  if (errors) console.log(`   Errors   : ${errors}`);
  if (!DRY_RUN && imported > 0) {
    console.log(
      `\nRun  ENRICH_CONCURRENCY=10 npm run enrich  to let Claude analyze each dress.`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
