import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@db/index";

/**
 * POST /api/swatch/[id]/colors
 *
 * Add a color to a swatch. Requires ownerToken.
 *
 * Body: { ownerToken: string, color: { hex, r, g, b, name? } }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { ownerToken, color } = body;

    if (!ownerToken) {
      return NextResponse.json({ error: "Missing ownerToken" }, { status: 401 });
    }

    if (!color?.hex || color.r == null || color.g == null || color.b == null) {
      return NextResponse.json(
        { error: "Missing color data (hex, r, g, b required)" },
        { status: 400 }
      );
    }

    const swatch = await prisma.swatch.findUnique({ where: { id } });

    if (!swatch) {
      return NextResponse.json({ error: "Swatch not found" }, { status: 404 });
    }

    if (swatch.ownerToken !== ownerToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get the next sortOrder atomically
    const maxOrder = await prisma.swatchColor.aggregate({
      where: { swatchId: id },
      _max: { sortOrder: true },
    });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    await prisma.swatchColor.create({
      data: {
        swatchId: id,
        sortOrder: nextOrder,
        hex: color.hex,
        r: color.r,
        g: color.g,
        b: color.b,
        name: color.name ?? null,
      },
    });

    // Return updated colors list
    const colors = await prisma.swatchColor.findMany({
      where: { swatchId: id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ colors });
  } catch (err) {
    console.error("Failed to add color:", err);
    return NextResponse.json(
      { error: "Failed to add color" },
      { status: 500 }
    );
  }
}
