/**
 * Seed the database with sample dress data for development.
 * These are pre-enriched (simulating what Claude would output).
 *
 * Usage: npm run db:seed
 */

import { PrismaClient } from "@prisma/client";
import { sRGBtoLab, rgbToHex } from "../lib/color-math/src/index";

const prisma = new PrismaClient();

interface SeedDress {
  name: string;
  brand: string;
  price: number;
  color: [number, number, number];
  colorName: string;
  pattern: string;
  category: string;
  occasion: string;
  season: string;
  fabric: string;
}

const SEED_DRESSES: SeedDress[] = [
  { name: "Silk Midi Wrap", brand: "Reformation", price: 278, color: [178, 34, 52], colorName: "Crimson", pattern: "solid", category: "wrap", occasion: "cocktail", season: "all", fabric: "silk" },
  { name: "Linen A-Line", brand: "& Other Stories", price: 149, color: [210, 180, 140], colorName: "Tan", pattern: "solid", category: "a-line", occasion: "casual", season: "summer", fabric: "linen" },
  { name: "Velvet Slip Dress", brand: "Realisation Par", price: 195, color: [25, 25, 80], colorName: "Midnight Navy", pattern: "solid", category: "slip", occasion: "cocktail", season: "winter", fabric: "velvet" },
  { name: "Cotton Maxi", brand: "Faithfull", price: 189, color: [255, 228, 196], colorName: "Bisque", pattern: "solid", category: "maxi", occasion: "beach", season: "summer", fabric: "cotton" },
  { name: "Satin Cowl Neck", brand: "Rat & Boa", price: 220, color: [139, 90, 43], colorName: "Saddle Brown", pattern: "solid", category: "midi", occasion: "cocktail", season: "fall", fabric: "satin" },
  { name: "Organza Babydoll", brand: "Selkie", price: 249, color: [255, 182, 193], colorName: "Light Pink", pattern: "solid", category: "mini", occasion: "cocktail", season: "spring", fabric: "chiffon" },
  { name: "Crepe Blazer Dress", brand: "Reiss", price: 345, color: [40, 40, 40], colorName: "Charcoal", pattern: "solid", category: "shift", occasion: "work", season: "all", fabric: "polyester" },
  { name: "Floral Tiered Midi", brand: "Dôen", price: 298, color: [188, 143, 143], colorName: "Rosy Brown", pattern: "floral", category: "midi", occasion: "casual", season: "spring", fabric: "cotton" },
  { name: "Knit Bodycon", brand: "Totême", price: 310, color: [245, 245, 220], colorName: "Beige", pattern: "solid", category: "bodycon", occasion: "work", season: "fall", fabric: "knit" },
  { name: "Tulle Party Dress", brand: "Needle & Thread", price: 425, color: [186, 135, 189], colorName: "Lavender", pattern: "solid", category: "midi", occasion: "formal", season: "spring", fabric: "chiffon" },
  { name: "Denim Shirt Dress", brand: "Citizens of Humanity", price: 268, color: [100, 130, 180], colorName: "Washed Denim", pattern: "solid", category: "shirt-dress", occasion: "casual", season: "all", fabric: "denim" },
  { name: "Sequin Mini", brand: "Rotate Birger", price: 380, color: [212, 175, 55], colorName: "Gold", pattern: "solid", category: "mini", occasion: "cocktail", season: "winter", fabric: "other" },
  { name: "Poplin Shirt Dress", brand: "COS", price: 135, color: [255, 255, 255], colorName: "White", pattern: "solid", category: "shirt-dress", occasion: "work", season: "summer", fabric: "cotton" },
  { name: "Leather Mini", brand: "Stand Studio", price: 450, color: [60, 20, 20], colorName: "Oxblood", pattern: "solid", category: "mini", occasion: "cocktail", season: "fall", fabric: "leather" },
  { name: "Cashmere Sweater Dress", brand: "Khaite", price: 580, color: [169, 169, 169], colorName: "Silver Grey", pattern: "solid", category: "midi", occasion: "work", season: "winter", fabric: "knit" },
  { name: "Broderie Anglaise Mini", brand: "Sea New York", price: 325, color: [255, 250, 240], colorName: "Floral White", pattern: "other", category: "mini", occasion: "casual", season: "summer", fabric: "cotton" },
  { name: "Ruched Mesh Dress", brand: "Ganni", price: 245, color: [50, 120, 50], colorName: "Forest Green", pattern: "solid", category: "midi", occasion: "casual", season: "all", fabric: "other" },
  { name: "Pleated Maxi", brand: "ME+EM", price: 275, color: [100, 149, 237], colorName: "Cornflower Blue", pattern: "solid", category: "maxi", occasion: "formal", season: "spring", fabric: "chiffon" },
  { name: "Asymmetric Cutout", brand: "Cult Gaia", price: 398, color: [255, 165, 0], colorName: "Tangerine", pattern: "solid", category: "midi", occasion: "cocktail", season: "summer", fabric: "other" },
  { name: "Ribbed Knit Midi", brand: "Vince", price: 295, color: [128, 0, 0], colorName: "Maroon", pattern: "solid", category: "midi", occasion: "work", season: "fall", fabric: "knit" },
  { name: "Puff Sleeve Mini", brand: "Aje", price: 355, color: [255, 105, 180], colorName: "Hot Pink", pattern: "solid", category: "mini", occasion: "cocktail", season: "spring", fabric: "cotton" },
  { name: "Crochet Cover-Up", brand: "Zimmermann", price: 490, color: [240, 230, 210], colorName: "Ecru", pattern: "other", category: "maxi", occasion: "beach", season: "summer", fabric: "other" },
  { name: "Taffeta Bow Dress", brand: "Simone Rocha", price: 695, color: [220, 20, 60], colorName: "Crimson Rose", pattern: "solid", category: "midi", occasion: "formal", season: "all", fabric: "other" },
  { name: "Column Maxi", brand: "St. Agni", price: 320, color: [194, 178, 128], colorName: "Sand", pattern: "solid", category: "maxi", occasion: "casual", season: "summer", fabric: "linen" },
  { name: "Tweed Mini Dress", brand: "Self-Portrait", price: 410, color: [255, 228, 225], colorName: "Misty Rose", pattern: "other", category: "mini", occasion: "work", season: "fall", fabric: "other" },
  { name: "Draped Jersey", brand: "Norma Kamali", price: 165, color: [0, 100, 100], colorName: "Teal", pattern: "solid", category: "midi", occasion: "casual", season: "all", fabric: "knit" },
  { name: "Boucle Shift", brand: "Sandro", price: 370, color: [255, 218, 185], colorName: "Peach Puff", pattern: "solid", category: "shift", occasion: "work", season: "spring", fabric: "other" },
  { name: "Flowy Chiffon Maxi", brand: "Zimmermann", price: 595, color: [176, 224, 230], colorName: "Powder Blue", pattern: "solid", category: "maxi", occasion: "formal", season: "summer", fabric: "chiffon" },
  { name: "Bandage Mini", brand: "Hervé Léger", price: 890, color: [0, 0, 0], colorName: "Black", pattern: "solid", category: "bodycon", occasion: "cocktail", season: "all", fabric: "knit" },
  { name: "Embroidered Midi", brand: "Ulla Johnson", price: 445, color: [160, 82, 45], colorName: "Sienna", pattern: "other", category: "midi", occasion: "casual", season: "fall", fabric: "cotton" },
];

async function main() {
  console.log("🌱 Seeding Chromé database...\n");

  // Clear existing data
  await prisma.enrichmentJob.deleteMany();
  await prisma.dress.deleteMany();

  let count = 0;

  for (const d of SEED_DRESSES) {
    const [r, g, b] = d.color;
    const lab = sRGBtoLab(r, g, b);
    const hex = rgbToHex(r, g, b);

    await prisma.dress.create({
      data: {
        name: d.name,
        brand: d.brand,
        price: d.price,
        currency: "USD",
        url: `https://example.com/dresses/${d.name.toLowerCase().replace(/\s+/g, "-")}`,
        imageUrl: "", // No real images in seed data; cards show color blocks
        retailer: "seed",
        externalId: `seed-${count}`,
        available: true,
        colorRgbR: r,
        colorRgbG: g,
        colorRgbB: b,
        colorLabL: lab[0],
        colorLabA: lab[1],
        colorLabB: lab[2],
        colorName: d.colorName,
        colorHex: hex,
        pattern: d.pattern,
        hasMultiColor: false,
        colorConfidence: 1.0,
        category: d.category,
        occasion: d.occasion,
        season: d.season,
        fabric: d.fabric,
        enrichedAt: new Date(),
      },
    });

    count++;
  }

  console.log(`✅ Seeded ${count} dresses`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
