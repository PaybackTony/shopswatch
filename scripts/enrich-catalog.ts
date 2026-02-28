/**
 * Batch enrichment script for the Chromé catalog.
 *
 * Finds all dresses that haven't been enriched (or need re-enrichment)
 * and sends their product images to Claude for color analysis.
 *
 * Usage: npm run enrich
 *
 * Options (via env vars):
 *   ENRICH_BATCH_SIZE=20     Number of dresses per batch
 *   ENRICH_CONCURRENCY=3     Parallel requests to Claude
 *   ENRICH_FORCE=true        Re-enrich already processed dresses
 */

import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { sRGBtoLab } from "../packages/color-math/src/index";

const prisma = new PrismaClient();
const anthropic = new Anthropic();

const BATCH_SIZE = parseInt(process.env.ENRICH_BATCH_SIZE ?? "20");
const CONCURRENCY = parseInt(process.env.ENRICH_CONCURRENCY ?? "3");
const FORCE = process.env.ENRICH_FORCE === "true";

const ENRICHMENT_PROMPT = `Analyze this dress image and extract color information. Respond ONLY with a JSON object (no markdown, no backticks, no explanation) with this exact structure:

{
  "primary_color": {
    "r": <0-255>,
    "g": <0-255>,
    "b": <0-255>,
    "name": "<human-readable color name>",
    "hex": "<#RRGGBB>"
  },
  "pattern": "<one of: solid, floral, striped, plaid, polka-dot, abstract, geometric, animal-print, ombre, color-block, tie-dye, other>",
  "has_multi_color": <true|false>,
  "secondary_colors": [
    { "r": <0-255>, "g": <0-255>, "b": <0-255>, "name": "<name>", "hex": "<#RRGGBB>", "weight": <0.0-1.0> }
  ],
  "confidence": <0.0-1.0>,
  "notes": "<observations about lighting or accuracy, or null>",
  "category": "<mini|midi|maxi|shirt-dress|wrap|slip|a-line|bodycon|shift|fit-and-flare|other>",
  "occasion": "<casual|work|cocktail|formal|beach|bridal|other>",
  "season": "<spring|summer|fall|winter|all>",
  "fabric_guess": "<silk|cotton|polyester|linen|velvet|satin|chiffon|knit|denim|leather|lace|other>"
}

Focus on the DOMINANT COLOR of the garment fabric, ignoring background, skin, and accessories.`;

async function enrichDress(dress: { id: string; imageUrl: string }) {
  console.log(`  Enriching: ${dress.id}`);

  const job = await prisma.enrichmentJob.create({
    data: { dressId: dress.id, status: "processing" },
  });

  try {
    // Fetch image
    const imgRes = await fetch(dress.imageUrl);
    if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);

    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const mediaType = contentType.startsWith("image/")
      ? (contentType as "image/jpeg" | "image/png" | "image/webp" | "image/gif")
      : "image/jpeg";

    // Call Claude
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: ENRICHMENT_PROMPT },
          ],
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text response");

    const result = JSON.parse(textBlock.text);
    const lab = sRGBtoLab(
      result.primary_color.r,
      result.primary_color.g,
      result.primary_color.b
    );

    // Update dress
    await prisma.dress.update({
      where: { id: dress.id },
      data: {
        colorRgbR: result.primary_color.r,
        colorRgbG: result.primary_color.g,
        colorRgbB: result.primary_color.b,
        colorLabL: lab[0],
        colorLabA: lab[1],
        colorLabB: lab[2],
        colorName: result.primary_color.name,
        colorHex: result.primary_color.hex,
        pattern: result.pattern,
        hasMultiColor: result.has_multi_color,
        secondaryColors: result.secondary_colors,
        colorConfidence: result.confidence,
        colorNotes: result.notes,
        category: result.category,
        occasion: result.occasion,
        season: result.season,
        fabric: result.fabric_guess,
        enrichedAt: new Date(),
      },
    });

    await prisma.enrichmentJob.update({
      where: { id: job.id },
      data: { status: "completed", result: result as any },
    });

    console.log(
      `  ✓ ${dress.id}: ${result.primary_color.name} (${result.primary_color.hex}) [confidence: ${result.confidence}]`
    );
  } catch (error: any) {
    console.error(`  ✗ ${dress.id}: ${error.message}`);
    await prisma.enrichmentJob.update({
      where: { id: job.id },
      data: { status: "failed", error: error.message, attempts: { increment: 1 } },
    });
  }
}

async function processBatch(dresses: { id: string; imageUrl: string }[]) {
  // Process in parallel with concurrency limit
  for (let i = 0; i < dresses.length; i += CONCURRENCY) {
    const chunk = dresses.slice(i, i + CONCURRENCY);
    await Promise.allSettled(chunk.map(enrichDress));
  }
}

async function main() {
  console.log("🎨 Chromé Enrichment Pipeline");
  console.log(`   Batch size: ${BATCH_SIZE} | Concurrency: ${CONCURRENCY} | Force: ${FORCE}\n`);

  const where = FORCE ? {} : { enrichedAt: null };

  const total = await prisma.dress.count({ where });
  console.log(`Found ${total} dresses to enrich\n`);

  if (total === 0) {
    console.log("Nothing to do!");
    return;
  }

  let processed = 0;

  while (processed < total) {
    const batch = await prisma.dress.findMany({
      where,
      select: { id: true, imageUrl: true },
      take: BATCH_SIZE,
      skip: processed,
    });

    if (batch.length === 0) break;

    console.log(`Processing batch ${Math.floor(processed / BATCH_SIZE) + 1} (${batch.length} dresses):`);
    await processBatch(batch);

    processed += batch.length;
    console.log(`\nProgress: ${processed}/${total}\n`);
  }

  console.log("✅ Enrichment complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
