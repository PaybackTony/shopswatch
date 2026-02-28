export interface ColorPreset {
  name: string;
  rgb: [number, number, number];
}

export const COLOR_PRESETS: ColorPreset[] = [
  { name: "Ivory", rgb: [255, 255, 240] },
  { name: "Blush", rgb: [255, 192, 203] },
  { name: "Dusty Rose", rgb: [194, 134, 134] },
  { name: "Coral", rgb: [255, 127, 80] },
  { name: "Crimson", rgb: [200, 30, 50] },
  { name: "Burgundy", rgb: [128, 0, 32] },
  { name: "Tangerine", rgb: [255, 165, 0] },
  { name: "Gold", rgb: [212, 175, 55] },
  { name: "Champagne", rgb: [247, 231, 206] },
  { name: "Sage", rgb: [138, 154, 91] },
  { name: "Forest", rgb: [34, 100, 34] },
  { name: "Teal", rgb: [0, 128, 128] },
  { name: "Sky Blue", rgb: [135, 206, 235] },
  { name: "Navy", rgb: [20, 20, 80] },
  { name: "Cobalt", rgb: [0, 71, 171] },
  { name: "Lavender", rgb: [180, 130, 190] },
  { name: "Lilac", rgb: [200, 162, 200] },
  { name: "Sand", rgb: [194, 178, 128] },
  { name: "Camel", rgb: [193, 154, 107] },
  { name: "Chocolate", rgb: [92, 51, 23] },
  { name: "Black", rgb: [15, 15, 15] },
  { name: "Charcoal", rgb: [54, 54, 54] },
  { name: "Silver", rgb: [180, 180, 180] },
  { name: "White", rgb: [255, 255, 255] },
];
