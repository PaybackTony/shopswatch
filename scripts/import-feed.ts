/**
 * Affiliate feed importer for Azazie and David's Bridal.
 *
 * Downloads product data from affiliate TSV/CSV feeds and upserts
 * dresses into the DB. Newly imported dresses have enrichedAt=null,
 * so running `npm run enrich` will pick them up for Claude color analysis.
 *
 * Usage:
 *   tsx scripts/import-feed.ts <retailer> <feed-file> [options]
 *
 * Retailers:
 *   azazie          ShareASale TSV feed
 *   davids-bridal   Impact/CJ CSV feed
 *
 * Options:
 *   --columns       Print column headers found in the file and exit (useful for debugging)
 *   --dry-run       Parse and log rows without writing to DB
 *   --limit=N       Only import first N matching rows
 *
 * Examples:
 *   tsx scripts/import-feed.ts azazie ~/Downloads/azazie.txt --columns
 *   tsx scripts/import-feed.ts azazie ~/Downloads/azazie.txt --limit=50
 *   tsx scripts/import-feed.ts davids-bridal ~/Downloads/davids.csv --dry-run
 */

import { createReadStream } from "fs";
import { resolve } from "path";
import readline from "readline";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Retailer configs ────────────────────────────────────────────────────────
// Column names are matched case-insensitively. Add alternatives in the arrays.

interface RetailerConfig {
  id: string;
  displayName: string;
  separator: string;
  // Each entry is a list of candidate column names to try, in priority order
  fields: {
    externalId: string[];
    name: string[];
    price: string[];
    url: string[];
    imageUrl: string[];
    category: string[];
  };
  // Return true if this row should be imported as a dress
  isDress: (row: Record<string, string>) => boolean;
}

const CONFIGS: Record<string, RetailerConfig> = {
  azazie: {
    id: "azazie",
    displayName: "Azazie",
    separator: "\t",
    fields: {
      externalId: ["SKUNumber", "SKU", "ProductID", "Product ID"],
      name: ["ProductName", "Product Name", "Name"],
      price: ["Price", "SalePrice", "RetailPrice", "Sale Price"],
      url: ["BuyURL", "ProductURL", "Buy URL", "URL", "Link"],
      imageUrl: ["ImageURL", "Image URL", "Image", "LargeImage"],
      category: ["CategoryName", "Category Name", "Category", "SubCategory"],
    },
    isDress: (row) => {
      const cat = (row.category ?? "").toLowerCase();
      const name = (row.name ?? "").toLowerCase();
      return (
        cat.includes("dress") ||
        cat.includes("gown") ||
        name.includes("dress") ||
        name.includes("gown")
      );
    },
  },

  "davids-bridal": {
    id: "davids-bridal",
    displayName: "David's Bridal",
    separator: ",",
    fields: {
      externalId: ["id", "sku", "item_group_id", "product_id"],
      name: ["title", "name", "product_name"],
      price: ["price", "sale_price", "regular_price"],
      url: ["link", "url", "product_url", "mobile_link"],
      imageUrl: ["image_link", "image_url", "additional_image_link"],
      category: ["product_type", "category", "google_product_category"],
    },
    isDress: (row) => {
      const cat = (row.category ?? "").toLowerCase();
      const name = (row.name ?? "").toLowerCase();
      return (
        cat.includes("dress") ||
        cat.includes("gown") ||
        name.includes("dress") ||
        name.includes("gown")
      );
    },
  },
};

// ─── CSV/TSV parser ───────────────────────────────────────────────────────────

function parseLine(line: string, sep: string): string[] {
  if (sep === "\t") return line.split("\t").map((v) => v.trim());

  // Simple CSV parser (handles quoted fields)
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

// ─── Field resolver ───────────────────────────────────────────────────────────

function resolveField(
  candidates: string[],
  headers: string[]
): string | null {
  const lower = headers.map((h) => h.toLowerCase());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function buildFieldMap(
  config: RetailerConfig,
  headers: string[]
): Record<string, string> | null {
  const map: Record<string, string> = {};
  const missing: string[] = [];

  for (const [field, candidates] of Object.entries(config.fields)) {
    const resolved = resolveField(candidates, headers);
    if (resolved) {
      map[field] = resolved;
    } else if (["externalId", "name", "url", "imageUrl"].includes(field)) {
      missing.push(`${field} (tried: ${candidates.join(", ")})`);
    }
  }

  if (missing.length > 0) {
    console.error("\n❌  Could not map required columns:");
    missing.forEach((m) => console.error(`   - ${m}`));
    console.error("\nRun with --columns to see what headers your feed has.\n");
    return null;
  }

  return map;
}

function parsePrice(raw: string): number {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const retailerKey = args[0];
  const feedPath = args[1];
  const showColumns = args.includes("--columns");
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]) : Infinity;

  if (!retailerKey || !feedPath) {
    console.error("Usage: tsx scripts/import-feed.ts <retailer> <feed-file> [--columns] [--dry-run] [--limit=N]");
    console.error("Retailers: azazie, davids-bridal");
    process.exit(1);
  }

  const config = CONFIGS[retailerKey];
  if (!config) {
    console.error(`Unknown retailer: ${retailerKey}. Options: ${Object.keys(CONFIGS).join(", ")}`);
    process.exit(1);
  }

  const filePath = resolve(feedPath);
  console.log(`\n📦  Importing ${config.displayName} feed: ${filePath}`);
  if (dryRun) console.log("   (dry run — no DB writes)\n");

  // ── Read file ──────────────────────────────────────────────────────────────
  const rl = readline.createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let headers: string[] = [];
  let fieldMap: Record<string, string> | null = null;
  let rowNum = 0;
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for await (const line of rl) {
    if (!line.trim() || line.startsWith("#")) continue;

    // First non-empty line = headers
    if (headers.length === 0) {
      headers = parseLine(line, config.separator);

      if (showColumns) {
        console.log(`\nColumns found in feed (${headers.length} total):\n`);
        headers.forEach((h, i) => console.log(`  [${i}] ${h}`));
        console.log();
        process.exit(0);
      }

      fieldMap = buildFieldMap(config, headers);
      if (!fieldMap) process.exit(1);

      console.log("Field mapping:");
      for (const [k, v] of Object.entries(fieldMap)) {
        console.log(`  ${k.padEnd(12)} → "${v}"`);
      }
      console.log();
      continue;
    }

    if (!fieldMap) break;
    if (imported >= limit) break;

    rowNum++;
    const values = parseLine(line, config.separator);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });

    // Map to our field names for the isDress check
    const normalized: Record<string, string> = {};
    for (const [field, col] of Object.entries(fieldMap)) {
      normalized[field] = row[col] ?? "";
    }

    if (!config.isDress(normalized)) { skipped++; continue; }

    const externalId = normalized.externalId;
    const imageUrl = normalized.imageUrl;
    const url = normalized.url;
    const name = normalized.name;

    if (!externalId || !imageUrl || !url || !name) { skipped++; continue; }

    // Skip clearly broken image URLs
    if (!imageUrl.startsWith("http")) { skipped++; continue; }

    const price = parsePrice(normalized.price ?? "0");
    const category = (normalized.category ?? "").toLowerCase();

    if (dryRun) {
      console.log(`  [dry] ${name} — ${imageUrl.slice(0, 60)}...`);
      imported++;
      continue;
    }

    try {
      await prisma.dress.upsert({
        where: { retailer_externalId: { retailer: config.id, externalId } },
        update: { name, price, url, imageUrl, available: true },
        create: {
          name,
          brand: config.displayName,
          price,
          currency: "USD",
          url,
          imageUrl,
          retailer: config.id,
          externalId,
          available: true,
          // Placeholder color — enrichment pipeline will overwrite
          colorRgbR: 0,
          colorRgbG: 0,
          colorRgbB: 0,
          colorLabL: 0,
          colorLabA: 0,
          colorLabB: 0,
          colorName: "pending",
          colorHex: "#000000",
          enrichedAt: null,
        },
      });
      imported++;
      if (imported % 50 === 0) process.stdout.write(`\r   ${imported} imported...`);
    } catch (err: any) {
      errors++;
      if (errors <= 3) console.error(`\n  ✗ Row ${rowNum}: ${err.message}`);
    }
  }

  console.log(`\n\n✅  Done!`);
  console.log(`   Imported : ${imported}`);
  console.log(`   Skipped  : ${skipped} (non-dress or missing fields)`);
  if (errors) console.log(`   Errors   : ${errors}`);
  if (!dryRun && imported > 0) {
    console.log(`\nNext step → npm run enrich`);
    console.log(`  This will send each dress image to Claude for color analysis.`);
    console.log(`  Concurrency is 3 by default. Set ENRICH_CONCURRENCY=10 to go faster.\n`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
