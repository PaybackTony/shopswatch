import { prisma } from "@db/index";
import { notFound } from "next/navigation";
import { SwatchPage } from "@/components/SwatchPage";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const swatch = await prisma.swatch.findUnique({ where: { id } });
  return {
    title: swatch?.name
      ? `${swatch.name} — Color Swatch`
      : "Shared Color Swatch — Shop by Color",
    description:
      "Browse bridesmaid dresses matching this color swatch. Find the perfect dress for the wedding palette.",
  };
}

export default async function SwatchRoute({ params, searchParams }: Props) {
  const { id } = await params;
  const { edit } = await searchParams;

  const swatch = await prisma.swatch.findUnique({
    where: { id },
    include: { colors: { orderBy: { sortOrder: "asc" } } },
  });

  if (!swatch) notFound();

  const isOwner = edit === swatch.ownerToken;

  return (
    <SwatchPage
      swatch={{
        id: swatch.id,
        name: swatch.name,
        colors: swatch.colors.map((c) => ({
          id: c.id,
          hex: c.hex,
          r: c.r,
          g: c.g,
          b: c.b,
          name: c.name,
          sortOrder: c.sortOrder,
        })),
        createdAt: swatch.createdAt.toISOString(),
      }}
      isOwner={isOwner}
      ownerToken={isOwner ? swatch.ownerToken : undefined}
    />
  );
}
