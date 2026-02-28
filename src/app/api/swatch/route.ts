import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@db/index";

/**
 * POST /api/swatch
 *
 * Create a new swatch, optionally with a first color.
 *
 * Body: { name?: string, color?: { hex, r, g, b, name? } }
 * Returns: { id, ownerToken, name, colors }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, color } = body;

    const swatch = await prisma.swatch.create({
      data: {
        name: name ?? null,
        ...(color
          ? {
              colors: {
                create: {
                  sortOrder: 0,
                  hex: color.hex,
                  r: color.r,
                  g: color.g,
                  b: color.b,
                  name: color.name ?? null,
                },
              },
            }
          : {}),
      },
      include: { colors: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json({
      id: swatch.id,
      ownerToken: swatch.ownerToken,
      name: swatch.name,
      colors: swatch.colors,
    });
  } catch (err) {
    console.error("Failed to create swatch:", err);
    return NextResponse.json(
      { error: "Failed to create swatch" },
      { status: 500 }
    );
  }
}
