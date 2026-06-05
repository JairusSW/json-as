// Single source of truth for every benchmark chart's colours. Adjust here and
// all charts (bar, line, lazy, multi-library) move together.
//
// Base palette:
//   jungle green #44AF69 · faded copper #9E7153 · strawberry red #F8333C
//   atomic tangerine #FA6F26 · orange #FCAB10 · palm leaf #94A562
//   pacific blue #2B9EB3 · muted teal #83BAB4 · sand dune #DBD5B5

export const BASE = {
  jungleGreen: "#44AF69",
  fadedCopper: "#9E7153",
  strawberryRed: "#F8333C",
  atomicTangerine: "#FA6F26",
  orange: "#FCAB10",
  palmLeaf: "#94A562",
  pacificBlue: "#2B9EB3",
  mutedTeal: "#83BAB4",
  sandDune: "#DBD5B5",
} as const;

// RGB triples, for rgba() interpolation (line charts + opacity ramps).
const RGB = {
  jungleGreen: "68,175,105",
  fadedCopper: "158,113,83",
  strawberryRed: "248,51,60",
  atomicTangerine: "250,111,38",
  orange: "252,171,16",
  palmLeaf: "148,165,98",
  pacificBlue: "43,158,179",
  mutedTeal: "131,186,180",
  sandDune: "219,213,181",
} as const;

export const rgba = (name: keyof typeof RGB, alpha = 1): string =>
  `rgba(${RGB[name]},${alpha})`;

// Engine/mode palette — one distinct hue per mode for the per-payload bar +
// line charts (chart01–12). Fastest mode (SIMD) gets the blue.
//   JS → strawberry red · NAIVE → orange · SWAR → jungle green · SIMD → pacific blue
export const MODE_RGB: Record<string, string> = {
  js: RGB.strawberryRed,
  naive: RGB.orange,
  swar: RGB.jungleGreen,
  simd: RGB.pacificBlue,
};

// The same four as createBarChart {bg, border} entries (JS, NAIVE, SWAR, SIMD).
export const MODE_BARS = [
  { bg: rgba("strawberryRed", 0.85), border: BASE.strawberryRed },
  { bg: rgba("orange", 0.85), border: BASE.orange },
  { bg: rgba("jungleGreen", 0.85), border: BASE.jungleGreen },
  { bg: rgba("pacificBlue", 0.9), border: BASE.pacificBlue },
];

// Eager vs lazy (chart15). Lazy shares the multi-library lazy hue (jungle green).
export const EAGER = { bg: rgba("sandDune", 0.85), border: BASE.sandDune };
export const LAZY = { bg: rgba("jungleGreen", 0.85), border: BASE.jungleGreen };

// Multi-library comparison (chart13/14): grouped by family hue, NAIVE→SIMD as a
// light→dark opacity ramp within each family. JS baselines recede in neutral
// sand (darkened so the bars read on white); strawberry red marks the
// non-json-as competitor.
export const MULTILIB_COLORS: Record<string, string> = {
  "native JSON (JS)": "#ABA68D", // sand dune, darkened
  "fast-json-parse (JS)": "#C5C0A3", // sand dune, mid
  "fast-json-stringify (JS)": "#C5C0A3", // sand dune, mid
  "assemblyscript-json": BASE.strawberryRed,
  "json-as struct (NAIVE)": rgba("pacificBlue", 0.45),
  "json-as struct (SWAR)": rgba("pacificBlue", 0.7),
  "json-as struct (SIMD)": rgba("pacificBlue", 1),
  "json-as struct lazy (NAIVE)": rgba("jungleGreen", 0.45),
  "json-as struct lazy (SWAR)": rgba("jungleGreen", 0.7),
  "json-as struct lazy (SIMD)": rgba("jungleGreen", 1),
  "json-as JSON.Obj (NAIVE)": rgba("orange", 0.5),
  "json-as JSON.Obj (SWAR)": rgba("orange", 0.75),
  "json-as JSON.Obj (SIMD)": rgba("orange", 1),
};

// Shared neutral inks (axis ticks, subtitle, value labels, gridlines).
export const INK = {
  subtitle: "#6b7280",
  label: "#374151",
  grid: "rgba(0,0,0,0.08)",
};
