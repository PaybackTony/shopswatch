/**
 * Color math utilities for perceptual color matching.
 *
 * Uses CIELAB color space and CIEDE2000 distance formula, which is
 * the industry standard for measuring color difference as perceived
 * by the human eye. A ΔE of ~2.3 is the "just noticeable difference."
 */

export type RGB = [number, number, number]; // 0-255
export type Lab = [number, number, number]; // L*a*b*

// ---------- Conversions ----------

/** Convert sRGB (0-255) to CIELAB (D65 illuminant). */
export function sRGBtoLab(r: number, g: number, b: number): Lab {
  // sRGB → linear RGB
  let rl = r / 255,
    gl = g / 255,
    bl = b / 255;

  rl = rl > 0.04045 ? Math.pow((rl + 0.055) / 1.055, 2.4) : rl / 12.92;
  gl = gl > 0.04045 ? Math.pow((gl + 0.055) / 1.055, 2.4) : gl / 12.92;
  bl = bl > 0.04045 ? Math.pow((bl + 0.055) / 1.055, 2.4) : bl / 12.92;

  // Linear RGB → XYZ (D65 reference white)
  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  let z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) / 1.08883;

  // XYZ → Lab
  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;

  x = f(x);
  y = f(y);
  z = f(z);

  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** Convert hex string (#RRGGBB) to RGB tuple. */
export function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/** Convert RGB tuple to hex string. */
export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")
  );
}

// ---------- CIEDE2000 ----------

/**
 * Compute CIEDE2000 color difference between two Lab colors.
 *
 * Reference: Sharma, Wu, Dalal (2005)
 * "The CIEDE2000 Color-Difference Formula"
 *
 * Returns a non-negative number where:
 *   0      = identical colors
 *   < 1    = imperceptible difference
 *   1-2    = perceptible through close observation
 *   2-3.5  = perceptible at a glance (JND ≈ 2.3)
 *   3.5-5  = clear difference
 *   > 5    = colors are noticeably different
 */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  // Step 1: Calculate C'ab and h'ab
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const mC = (C1 + C2) / 2;

  const G =
    0.5 *
    (1 - Math.sqrt(Math.pow(mC, 7) / (Math.pow(mC, 7) + Math.pow(25, 7))));

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  let h1p = Math.atan2(b1, a1p) * deg;
  if (h1p < 0) h1p += 360;

  let h2p = Math.atan2(b2, a2p) * deg;
  if (h2p < 0) h2p += 360;

  // Step 2: Calculate ΔL', ΔC', ΔH'
  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);

  // Step 3: Calculate CIEDE2000
  const mLp = (L1 + L2) / 2;
  const mCp = (C1p + C2p) / 2;

  let mhp: number;
  if (C1p * C2p === 0) {
    mhp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    mhp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    mhp = (h1p + h2p + 360) / 2;
  } else {
    mhp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos((mhp - 30) * rad) +
    0.24 * Math.cos(2 * mhp * rad) +
    0.32 * Math.cos((3 * mhp + 6) * rad) -
    0.2 * Math.cos((4 * mhp - 63) * rad);

  const SL =
    1 +
    (0.015 * Math.pow(mLp - 50, 2)) /
      Math.sqrt(20 + Math.pow(mLp - 50, 2));

  const SC = 1 + 0.045 * mCp;
  const SH = 1 + 0.015 * mCp * T;

  const RT =
    -2 *
    Math.sqrt(Math.pow(mCp, 7) / (Math.pow(mCp, 7) + Math.pow(25, 7))) *
    Math.sin(60 * Math.exp(-Math.pow((mhp - 275) / 25, 2)) * rad);

  return Math.sqrt(
    Math.pow(dLp / SL, 2) +
      Math.pow(dCp / SC, 2) +
      Math.pow(dHp / SH, 2) +
      RT * (dCp / SC) * (dHp / SH)
  );
}

// ---------- Match quality labels ----------

export type MatchQuality =
  | "exact"
  | "near-exact"
  | "very-close"
  | "close"
  | "similar"
  | "distant";

export function getMatchQuality(de: number): MatchQuality {
  if (de < 1) return "exact";
  if (de < 2.3) return "near-exact";
  if (de < 5) return "very-close";
  if (de < 10) return "close";
  if (de < 20) return "similar";
  return "distant";
}

/** Relative luminance for contrast decisions. */
export function relativeLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
