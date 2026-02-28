/**
 * Azazie catalog scraper.
 *
 * Uses Azazie's new listing API (mall-product subdomain, isNewApi=true).
 * One DB row per product × displayed color — hex is pulled directly from the
 * colorSwitch entry so no separate color-hex lookup is needed.
 *
 * Optionally iterate by color family to get each dress in specific colors
 * with matching CDN images (each color family = unique styleId + unique image).
 *
 * Usage:
 *   tsx scripts/scrape-azazie.ts
 *   tsx scripts/scrape-azazie.ts --limit=50
 *   tsx scripts/scrape-azazie.ts --dry-run
 *   tsx scripts/scrape-azazie.ts --colors=blue,pink,green,red,purple
 */

import { PrismaClient } from "@prisma/client";
import { hexToRgb, sRGBtoLab } from "../lib/color-math/src/index";

const prisma = new PrismaClient();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1]) : Infinity;
const colorsArg = args.find((a) => a.startsWith("--colors="));
// Color families to iterate; null = no filter (default listing color per product)
const COLOR_FAMILIES: string[] | null = colorsArg
  ? colorsArg.split("=")[1].split(",").map((c) => c.trim())
  : null;

const BASE_URL = "https://www.azazie.com";
const API_URL =
  "https://mall-product.azazie.com/1.0/list/content-new" +
  "?format=list&cat_name=bridesmaid-dresses&dress_type=dress" +
  "&limit=60&in_stock=&is_outlet=0&version=b&activityVerison=a" +
  "&galleryVersion=B&sodGalleryVersion=A&topic=azazie" +
  "&show_final_sale=0&only_show_final_sale=0" +
  "&atelier_ab_version=b&reviewVersion=a&isNewApi=true";

const HEADERS = {
  "accept": "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "content-type": "application/json;charset=UTF-8",
  "origin": "https://www.azazie.com",
  "referer": "https://www.azazie.com/",
  "sec-ch-ua": `"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"`,
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": `"macOS"`,
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
  "x-app": "pc",
  "x-clientid": "rCA0T2mjTN6ggijRBEpjAg==",
  "x-countrycode": "US",
  "x-languagecode": "en",
  "x-project": "azazie",
};

function normalizeHex(hex: string): string {
  if (!hex) return "#888888";
  hex = hex.replace(/^#/, "").trim();
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length !== 6) return "#888888";
  return "#" + hex.toLowerCase();
}

async function fetchPage(page: number, colorFamily?: string) {
  const body: Record<string, any> = {
    originUrl: colorFamily
      ? `/all/bridesmaid-dresses/colors-family/${colorFamily}`
      : "/all/bridesmaid-dresses",
  };
  if (colorFamily) body.filters = { "colors-family": [colorFamily] };

  const res = await fetch(`${API_URL}&page=${page}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = (await res.json()) as any;
  const d = json?.data;
  if (!d?.prodList) throw new Error("Unexpected response — no prodList");

  return {
    products: d.prodList as any[],
    totalPages: d.pageInfo?.totalPage ?? 1,
    totalCount: d.pageInfo?.totalCount ?? 0,
  };
}

async function scrapeColorFamily(
  colorFamily: string | undefined,
  imported: { n: number },
  skipped: { n: number },
  errors: { n: number }
) {
  const label = colorFamily ?? "default";
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && imported.n < LIMIT) {
    process.stdout.write(
      `  [${label}] Page ${page}/${totalPages === 1 ? "?" : totalPages} ... `
    );

    let products: any[];
    try {
      const result = await fetchPage(page, colorFamily);
      products = result.products;
      totalPages = result.totalPages;
      if (page === 1) process.stdout.write(`(${result.totalCount} total) `);
      console.log(`${products.length} products`);
    } catch (err: any) {
      console.error(`\n  Error: ${err.message}`);
      break;
    }

    for (const p of products) {
      if (imported.n >= LIMIT) break;

      const imageUrl: string = p.imgUrl ?? "";
      if (!imageUrl) { skipped.n++; continue; }

      const colorKey: string = p.key ?? p.color ?? "";
      const colorSwitch: Record<string, any> = p.colorSwitch ?? {};

      // Get hex for the currently displayed color from colorSwitch
      const csEntry =
        colorSwitch[colorKey] ?? Object.values(colorSwitch)[0] ?? {};
      const hexRaw: string = csEntry?.hexes?.[0] ?? "";
      if (!hexRaw) { skipped.n++; continue; }

      const hex = normalizeHex(hexRaw);
      const [r, g, b] = hexToRgb(hex);
      const lab = sRGBtoLab(r, g, b);

      const colorName: string = csEntry?.name ?? p.shownColor ?? colorKey;
      const price: number = parseFloat(p.shopPrice ?? "0") || 0;
      const externalId = String(
        p.goodsStyleId ?? `${p.goodsId}-${colorKey}`
      );
      const slug = (p.goodsUrl ?? "").replace(/^\/products\//, "");
      const url =
        `${BASE_URL}/products/${slug}/${externalId}` +
        `?country=US&ambassador_info_id=8386&aa_code=13F786F1&referrer_code=9d9657`;

      if (DRY_RUN) {
        console.log(`    [dry] ${p.goodsName} / ${colorName} → ${hex}`);
        imported.n++;
        continue;
      }

      try {
        await prisma.dress.upsert({
          where: {
            retailer_externalId: { retailer: "azazie", externalId },
          },
          create: {
            name: p.goodsName,
            brand: "Azazie",
            price,
            currency: "USD",
            url,
            imageUrl,
            retailer: "azazie",
            externalId,
            available: true,
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
            name: p.goodsName,
            price,
            imageUrl,
            url,
            available: true,
          },
        });
        imported.n++;
      } catch (err: any) {
        errors.n++;
      }
    }

    page++;
    if (page <= totalPages && imported.n < LIMIT) await wait(1200);
  }
}

async function main() {
  const colorFamilies = COLOR_FAMILIES ?? [undefined];
  console.log(
    `\n🌸  Azazie scraper${DRY_RUN ? " (dry run)" : ""}` +
    (COLOR_FAMILIES ? ` — colors: ${COLOR_FAMILIES.join(", ")}` : "") +
    "\n"
  );

  const imported = { n: 0 };
  const skipped = { n: 0 };
  const errors = { n: 0 };

  for (const cf of colorFamilies) {
    if (cf) console.log(`\n── Color family: ${cf} ──`);
    await scrapeColorFamily(cf, imported, skipped, errors);
    if (imported.n >= LIMIT) break;
    if (colorFamilies.length > 1) await wait(2000); // pause between families
  }

  console.log(`\n✅  Done!`);
  console.log(`   Imported : ${imported.n}`);
  console.log(`   Skipped  : ${skipped.n}`);
  if (errors.n) console.log(`   Errors   : ${errors.n}`);
  if (!DRY_RUN && imported.n > 0) {
    console.log(
      `\nRun  ENRICH_CONCURRENCY=10 npm run enrich  to let Claude analyze each dress.`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
