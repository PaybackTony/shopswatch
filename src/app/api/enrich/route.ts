import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@db/index";
import { sRGBtoLab } from "@color-math/index";

const anthropic = new Anthropic();

/**
 * POST /api/enrich
 *
 * Sends a dress image to Claude for color analysis.
 * Claude returns structured color data which is stored in the database.
 *
 * Body: { dressId: string }
 */
export async function POST(request: NextRequest) {
  const { dressId } = await request.json();

  if (!dressId) {
    return NextResponse.json({ error: "dressId required" }, { status: 400 });
  }

  const dress = await prisma.dress.findUnique({ where: { id: dressId } });
  if (!dress) {
    return NextResponse.json({ error: "Dress not found" }, { status: 404 });
  }

  // Create enrichment job
  const job = await prisma.enrichmentJob.create({
    data: { dressId, status: "processing" },
  });

  try {
    // Fetch the product image
    const imageResponse = await fetch(dress.imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    // Determine media type from URL or response headers
    const contentType =
      imageResponse.headers.get("content-type") ?? "image/jpeg";
    const mediaType = contentType.startsWith("image/")
      ? (contentType as "image/jpeg" | "image/png" | "image/webp" | "image/gif")
      : "image/jpeg";

    // Ask Claude to analyze the image
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: "text",
              text: `Analyze this dress image and extract color information. Respond ONLY with a JSON object (no markdown, no backticks, no explanation) with this exact structure:

{
  "primary_color": {
    "r": <0-255>,
    "g": <0-255>,
    "b": <0-255>,
    "name": "<human-readable color name, e.g. 'Dusty Rose', 'Forest Green'>",
    "hex": "<#RRGGBB>"
  },
  "pattern": "<one of: solid, floral, striped, plaid, polka-dot, abstract, geometric, animal-print, ombre, color-block, tie-dye, other>",
  "has_multi_color": <true|false>,
  "secondary_colors": [
    {
      "r": <0-255>, "g": <0-255>, "b": <0-255>,
      "name": "<name>",
      "hex": "<#RRGGBB>",
      "weight": <0.0-1.0, approximate proportion of this color>
    }
  ],
  "confidence": <0.0-1.0, how confident you are in the primary color extraction>,
  "notes": "<any relevant observations, e.g. 'Studio lighting appears warm, actual garment may be cooler' or null>",
  "category": "<one of: mini, midi, maxi, shirt-dress, wrap, slip, a-line, bodycon, shift, fit-and-flare, other>",
  "occasion": "<one of: casual, work, cocktail, formal, beach, bridal, other>",
  "season": "<one of: spring, summer, fall, winter, all>",
  "fabric_guess": "<best guess: silk, cotton, polyester, linen, velvet, satin, chiffon, knit, denim, leather, lace, other>"
}

Focus on the DOMINANT COLOR of the garment fabric itself, ignoring background, skin tones, and accessories. If the garment has a print/pattern, identify the most prominent/background color as primary.`,
            },
          ],
        },
      ],
    });

    // Parse Claude's response
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const result = JSON.parse(textBlock.text);

    // Convert primary color to Lab
    const lab = sRGBtoLab(
      result.primary_color.r,
      result.primary_color.g,
      result.primary_color.b
    );

    // Update dress record
    await prisma.dress.update({
      where: { id: dressId },
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

    // Update job
    await prisma.enrichmentJob.update({
      where: { id: job.id },
      data: { status: "completed", result: result as any },
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    await prisma.enrichmentJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: error.message,
        attempts: { increment: 1 },
      },
    });

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
