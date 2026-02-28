# Chromé — Dress Color Search

## What This Is
A web application that lets people search for dresses by selecting a color, then shows dresses from various retailers sorted by how closely they match that color as perceived by the human eye. Think "Shazam for dress colors."

## Architecture

### Stack
- **Framework**: Next.js 14 (App Router) with TypeScript
- **Styling**: Tailwind CSS 3.4 with custom design tokens
- **Database**: PostgreSQL via Prisma ORM
- **AI**: Anthropic Claude API (Sonnet) for image-based color enrichment
- **Color Science**: Custom CIEDE2000 implementation in `packages/color-math/`

### Key Design Decisions
1. **Claude is used offline, not in the search path.** The enrichment pipeline processes dress images in batch to extract color data. The real-time search uses pure math (ΔE2000) against pre-computed Lab\* values in Postgres.
2. **CIELAB + CIEDE2000** is the color distance metric. RGB/hex distance is perceptually wrong. Lab\* space models human vision; CIEDE2000 is the gold standard distance formula.
3. **Two-stage search**: Postgres indexes filter a Lab\* bounding box (fast), then the app computes exact ΔE and sorts (precise).
4. **Pinterest-style masonry** uses CSS `column-count`, not JS layout libraries. Simpler, faster, responsive.

### Directory Structure
```
chrome/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with fonts
│   │   ├── page.tsx            # Main page (server component)
│   │   └── api/
│   │       ├── search/route.ts # Color search endpoint (ΔE sorting)
│   │       └── enrich/route.ts # Single-dress Claude enrichment
│   ├── components/
│   │   ├── SearchPage.tsx      # Main client component (state management)
│   │   ├── ColorPicker/        # Color preset grid + custom picker
│   │   ├── MasonryGrid/        # CSS column masonry layout
│   │   ├── DressCard/          # Individual product card
│   │   └── DetailModal/        # Dress detail overlay
│   ├── lib/
│   │   └── color-presets.ts    # Fashion color palette definitions
│   └── styles/
│       └── globals.css         # Tailwind + custom animations
├── packages/
│   ├── color-math/src/         # sRGB↔Lab, CIEDE2000, match quality
│   └── db/                     # Prisma client singleton + schema
├── scripts/
│   ├── seed-catalog.ts         # Mock data seeder
│   └── enrich-catalog.ts       # Batch Claude enrichment pipeline
└── CLAUDE.md                   # (this file)
```

## Getting Started
```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and ANTHROPIC_API_KEY

# 3. Set up database
npm run db:generate
npm run db:push

# 4. Seed with mock data
npm run db:seed

# 5. Run dev server
npm run dev
```

## Module Resolution
Path aliases are configured in tsconfig.json:
- `@/*` → `./src/*`
- `@color-math/*` → `./packages/color-math/src/*`
- `@db/*` → `./packages/db/*`

## Color Science Reference
- **Lab\* color space**: L = lightness (0-100), a = green-red (-128 to 127), b = blue-yellow (-128 to 127)
- **ΔE2000 thresholds**: < 1 imperceptible, < 2.3 JND (just noticeable difference), < 5 clear difference, > 10 obviously different colors
- **Match quality labels**: exact (<1), near-exact (<2.3), very-close (<5), close (<10), similar (<20), distant (>20)

## Claude Enrichment Pipeline
The enrichment prompt in `scripts/enrich-catalog.ts` and `src/app/api/enrich/route.ts` asks Claude to:
1. Identify the dominant garment color as RGB/hex/human name
2. Detect the pattern (solid, floral, striped, etc.)
3. Extract secondary colors with approximate weights
4. Assess confidence (accounting for studio lighting, etc.)
5. Categorize the dress (type, occasion, season, fabric)

The prompt specifies JSON-only output with no markdown wrapping. Parse with `JSON.parse()` directly.

## Development Notes
- The search API at `/api/search` does NOT require authentication (public read)
- The enrich API at `/api/enrich` should be protected in production (admin only)
- Product images should ideally be studio shots on neutral backgrounds for best color extraction
- The `colorConfidence` field (0-1) from Claude can be used to flag items needing manual review
- Seed data uses empty `imageUrl` strings; DressCard falls back to color gradient blocks

## Future Work (Planned)
- Retailer API integrations (affiliate feeds from Nordstrom, ASOS, Shopbop, etc.)
- "Upload a photo" color extraction (user uploads reference image → Claude extracts target color)
- Filter facets (brand, price range, occasion, pattern)
- Infinite scroll pagination
- Image upload for reference color matching
- Multi-color search (find dresses that contain BOTH navy and gold)
- pgvector for semantic color similarity as an alternative ranking
