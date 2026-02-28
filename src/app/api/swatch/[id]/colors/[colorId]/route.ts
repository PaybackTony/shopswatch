import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@db/index";

/**
 * DELETE /api/swatch/[id]/colors/[colorId]
 *
 * Remove a color from a swatch. Requires ownerToken.
 *
 * Body: { ownerToken: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; colorId: string }> }
) {
  const { id, colorId } = await params;

  try {
    const body = await request.json();
    const { ownerToken } = body;

    if (!ownerToken) {
      return NextResponse.json({ error: "Missing ownerToken" }, { status: 401 });
    }

    const swatch = await prisma.swatch.findUnique({ where: { id } });

    if (!swatch) {
      return NextResponse.json({ error: "Swatch not found" }, { status: 404 });
    }

    if (swatch.ownerToken !== ownerToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Verify the color belongs to this swatch
    const color = await prisma.swatchColor.findFirst({
      where: { id: colorId, swatchId: id },
    });

    if (!color) {
      return NextResponse.json({ error: "Color not found" }, { status: 404 });
    }

    await prisma.swatchColor.delete({ where: { id: colorId } });

    // Return updated colors list
    const colors = await prisma.swatchColor.findMany({
      where: { swatchId: id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ colors });
  } catch (err) {
    console.error("Failed to remove color:", err);
    return NextResponse.json(
      { error: "Failed to remove color" },
      { status: 500 }
    );
  }
}
