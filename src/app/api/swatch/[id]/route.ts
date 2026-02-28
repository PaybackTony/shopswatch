import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@db/index";

/**
 * GET /api/swatch/[id]
 *
 * Fetch a swatch by ID (public, read-only — ownerToken is NOT returned).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const swatch = await prisma.swatch.findUnique({
    where: { id },
    include: { colors: { orderBy: { sortOrder: "asc" } } },
  });

  if (!swatch) {
    return NextResponse.json({ error: "Swatch not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: swatch.id,
    name: swatch.name,
    colors: swatch.colors,
    createdAt: swatch.createdAt,
    updatedAt: swatch.updatedAt,
  });
}

/**
 * PATCH /api/swatch/[id]
 *
 * Update swatch metadata (name). Requires ownerToken.
 *
 * Body: { ownerToken: string, name: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { ownerToken, name } = body;

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

    const updated = await prisma.swatch.update({
      where: { id },
      data: { name },
      include: { colors: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      colors: updated.colors,
    });
  } catch (err) {
    console.error("Failed to update swatch:", err);
    return NextResponse.json(
      { error: "Failed to update swatch" },
      { status: 500 }
    );
  }
}
