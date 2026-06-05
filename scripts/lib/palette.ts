// Single source of truth for every benchmark chart's colours. Adjust here and
// all charts (bar, line, lazy, multi-library) move together.
//
// Base palette (cohesive muted set):
//   blue #4281A4 · teal #48A9A6 · cream #E4DFDA · sand #D4B483 · rose #C1666B

export const BASE = {
  blue: "#4281A4",
  teal: "#48A9A6",
  cream: "#E4DFDA",
  sand: "#D4B483",
  rose: "#C1666B",
} as const;

// RGB triples, for rgba() interpolation in the line charts.
const RGB = {
  blue: "66,129,164",
  teal: "72,169,166",
  cream: "228,223,218",
  sand: "212,180,131",
  rose: "193,102,107",
} as const;

export const rgba = (name: keyof typeof RGB, alpha = 1): string =>
  `rgba(${RGB[name]},${alpha})`;

// Engine/mode palette — one distinct hue per mode for the per-payload bar +
// line charts (chart01–12). Fastest mode (SIMD) gets the strongest colour.
//   JS → rose · NAIVE → sand · SWAR → teal · SIMD → blue
export const MODE_RGB: Record<string, string> = {
  js: RGB.rose,
  naive: RGB.sand,
  swar: RGB.teal,
  simd: RGB.blue,
};

// The same four as createBarChart {bg, border} entries (JS, NAIVE, SWAR, SIMD).
export const MODE_BARS = [
  { bg: rgba("rose", 0.85), border: BASE.rose },
  { bg: rgba("sand", 0.85), border: BASE.sand },
  { bg: rgba("teal", 0.85), border: BASE.teal },
  { bg: rgba("blue", 0.9), border: BASE.blue },
];

// Eager vs lazy (chart15). Lazy shares the multi-library lazy hue (teal).
export const EAGER = { bg: rgba("sand", 0.85), border: BASE.sand };
export const LAZY = { bg: rgba("teal", 0.85), border: BASE.teal };

// Multi-library comparison (chart13/14): grouped by family hue, NAIVE→SIMD as a
// light→dark opacity ramp within each family. JS baselines recede in neutral
// (cream, darkened so the bars read on a white background); rose marks the
// non-json-as competitor.
export const MULTILIB_COLORS: Record<string, string> = {
  "native JSON (JS)": "#A9A5A1", // cream, darkened
  "fast-json-parse (JS)": "#C5C0BA", // cream, mid
  "fast-json-stringify (JS)": "#C5C0BA", // cream, mid
  "assemblyscript-json": BASE.rose,
  "json-as struct (NAIVE)": rgba("blue", 0.45),
  "json-as struct (SWAR)": rgba("blue", 0.7),
  "json-as struct (SIMD)": rgba("blue", 1),
  "json-as struct lazy (NAIVE)": rgba("teal", 0.45),
  "json-as struct lazy (SWAR)": rgba("teal", 0.7),
  "json-as struct lazy (SIMD)": rgba("teal", 1),
  "json-as JSON.Obj (NAIVE)": rgba("sand", 0.5),
  "json-as JSON.Obj (SWAR)": rgba("sand", 0.75),
  "json-as JSON.Obj (SIMD)": rgba("sand", 1),
};

// Shared neutral inks (axis ticks, subtitle, value labels, gridlines).
export const INK = {
  subtitle: "#6b7280",
  label: "#374151",
  grid: "rgba(0,0,0,0.08)",
};
