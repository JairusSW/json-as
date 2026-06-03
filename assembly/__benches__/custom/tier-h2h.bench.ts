import { JSON } from "../../index";
import { expect } from "../../__tests__/lib";
import { bench, blackbox } from "../lib/bench";

// Head-to-head: tier-1 (exact, minified) vs tier-2 (whitespace-tolerant) on the
// SAME medium struct. Three inputs of identical data:
//   1. min     — minified              -> tier 1
//   2. lead    — one leading space     -> tier 2, but minified body (≈same byte
//                                          count) so this isolates the PURE path
//                                          overhead: extra no-op skipWhitespace
//                                          calls + per-token matching, no real ws
//   3. pretty  — fully indented        -> tier 2 doing real whitespace skipping
// Allocation cost is identical across all three (same object shape), so the
// per-op delta is purely the parse path.

@json
class UserPreferences {
  theme: string = "dark";
  notifications: boolean = true;
  language: string = "en-US";
  timezone: string = "America/Los_Angeles";
  privacy_level: string = "friends_only";
  two_factor_enabled: boolean = false;
}


@json
class RecentActivity {
  action: string = "starred";
  timestamp: string = "2025-12-22T10:15:00Z";
  target: string = "JairusSW/json-as";
}


@json
class MediumAPIResponse {
  id: i32 = 42;
  username: string = "jairus";
  full_name: string = "Jairus Tanaka";
  email: string = "me@jairus.dev";
  avatar_url: string = "https://avatars.githubusercontent.com/u/123456?v=4";
  bio: string =
    "I like compilers, elegant algorithms, bare metal, simd, and wasm.";
  website: string = "https://jairus.dev/";
  location: string = "Seattle, WA";
  joined_at: string = "2020-01-15T08:30:00Z";
  is_verified: boolean = true;
  is_premium: boolean = true;
  follower_count: i32 = 61;
  following_count: i32 = 39;
  preferences: UserPreferences = new UserPreferences();
  tags: string[] = [
    "typescript",
    "webassembly",
    "performance",
    "rust",
    "assemblyscript",
    "json",
  ];
  recent_activity: RecentActivity[] = [
    new RecentActivity(),
    new RecentActivity(),
    new RecentActivity(),
    new RecentActivity(),
    new RecentActivity(),
  ];
}

// Quote/escape-aware pretty printer (setup-time only; not in the hot loop).
function prettyPrint(src: string): string {
  let out = "";
  let depth = 0;
  let inStr = false;
  const n = src.length;
  for (let i = 0; i < n; i++) {
    const c = src.charCodeAt(i);
    if (inStr) {
      out += String.fromCharCode(c);
      if (c == 0x5c) {
        // backslash: copy the escaped char verbatim
        i++;
        if (i < n) out += String.fromCharCode(src.charCodeAt(i));
        continue;
      }
      if (c == 0x22) inStr = false;
      continue;
    }
    if (c == 0x22) {
      inStr = true;
      out += '"';
    } else if (c == 0x7b || c == 0x5b) {
      depth++;
      out += String.fromCharCode(c) + "\n" + "  ".repeat(depth);
    } else if (c == 0x7d || c == 0x5d) {
      depth--;
      out += "\n" + "  ".repeat(depth) + String.fromCharCode(c);
    } else if (c == 0x2c) {
      out += ",\n" + "  ".repeat(depth);
    } else if (c == 0x3a) {
      out += ": ";
    } else {
      out += String.fromCharCode(c);
    }
  }
  return out;
}

// Worst case for tier-2: many fields, all trivial primitive values — almost no
// value work to hide the per-field skipWhitespace + token-match overhead behind.
@json
class FieldDense {
  a: i32 = 1;
  b: i32 = 2;
  c: i32 = 3;
  d: i32 = 4;
  e: i32 = 5;
  f: i32 = 6;
  g: i32 = 7;
  h: i32 = 8;
  i: i32 = 9;
  j: i32 = 10;
  k: i32 = 11;
  l: i32 = 12;
  m: i32 = 13;
  n: i32 = 14;
  o: i32 = 15;
  p: i32 = 16;
}

// Optional-field struct (all fields present). Exercises the probe-based tier-2.
// If pretty ≈ min speed, tier-2 is engaged; if ~5× slower, it fell to slow.
@json
class OptMedium {
  id: i32 = 0;
  username: string = "";


  @omitnull email: string | null = null;


  @omitnull bio: string | null = null;
  follower_count: i32 = 0;


  @omitnull website: string | null = null;
  is_verified: boolean = false;
}

const v = new MediumAPIResponse();
const min: string = JSON.stringify<MediumAPIResponse>(v);
const lead: string = " " + min;
const pretty: string = prettyPrint(min);

// Structurally identical twin with NO optional fields -> flat tier-1. Benching
// this vs OptMedium (all present) isolates the seenAny tier-1 overhead.
@json
class NonOptMedium {
  id: i32 = 0;
  username: string = "";
  email: string = "";
  bio: string = "";
  follower_count: i32 = 0;
  website: string = "";
  is_verified: boolean = false;
}

const nov = new NonOptMedium();
nov.id = 61;
nov.username = "jairus";
nov.email = "me@jairus.dev";
nov.bio = "I like compilers, elegant algorithms, bare metal, simd, and wasm.";
nov.follower_count = 61;
nov.website = "https://jairus.dev/";
nov.is_verified = true;
const nomin: string = JSON.stringify<NonOptMedium>(nov);
expect(JSON.stringify(JSON.parse<NonOptMedium>(nomin))).toBe(nomin);

const ov = new OptMedium();
ov.id = 61;
ov.username = "jairus";
ov.email = "me@jairus.dev";
ov.bio = "I like compilers, elegant algorithms, bare metal, simd, and wasm.";
ov.follower_count = 61;
ov.website = "https://jairus.dev/";
ov.is_verified = true;
const omin: string = JSON.stringify<OptMedium>(ov);
const opretty: string = prettyPrint(omin);
expect(JSON.stringify(JSON.parse<OptMedium>(omin))).toBe(omin);
expect(JSON.stringify(JSON.parse<OptMedium>(opretty))).toBe(omin);

const dv = new FieldDense();
const dmin: string = JSON.stringify<FieldDense>(dv);
const dlead: string = " " + dmin;
const dpretty: string = prettyPrint(dmin);

expect(JSON.stringify(JSON.parse<FieldDense>(dmin))).toBe(dmin);
expect(JSON.stringify(JSON.parse<FieldDense>(dlead))).toBe(dmin);
expect(JSON.stringify(JSON.parse<FieldDense>(dpretty))).toBe(dmin);

// All three must parse to the same data (and confirm the fast path actually
// produces correct output for tier 2, not just tier 1).
expect(JSON.stringify(JSON.parse<MediumAPIResponse>(min))).toBe(min);
expect(JSON.stringify(JSON.parse<MediumAPIResponse>(lead))).toBe(min);
expect(JSON.stringify(JSON.parse<MediumAPIResponse>(pretty))).toBe(min);

const N = 300_000;

bench(
  "Deserialize medium — min (tier 1, exact)",
  () => {
    blackbox(inline.always(JSON.parse<MediumAPIResponse>(min)));
  },
  N,
  String.UTF8.byteLength(min),
);

bench(
  "Deserialize medium — lead space (tier 2, pure path overhead)",
  () => {
    blackbox(inline.always(JSON.parse<MediumAPIResponse>(lead)));
  },
  N,
  String.UTF8.byteLength(lead),
);

bench(
  "Deserialize medium — pretty (tier 2, real whitespace)",
  () => {
    blackbox(inline.always(JSON.parse<MediumAPIResponse>(pretty)));
  },
  N,
  String.UTF8.byteLength(pretty),
);

bench(
  "Deserialize field-dense — min (tier 1, exact)",
  () => {
    blackbox(inline.always(JSON.parse<FieldDense>(dmin)));
  },
  N,
  String.UTF8.byteLength(dmin),
);

bench(
  "Deserialize field-dense — lead space (tier 2, pure path overhead)",
  () => {
    blackbox(inline.always(JSON.parse<FieldDense>(dlead)));
  },
  N,
  String.UTF8.byteLength(dlead),
);

bench(
  "Deserialize field-dense — pretty (tier 2, real whitespace)",
  () => {
    blackbox(inline.always(JSON.parse<FieldDense>(dpretty)));
  },
  N,
  String.UTF8.byteLength(dpretty),
);

bench(
  "Deserialize non-opt twin — min (flat tier 1)",
  () => {
    blackbox(inline.always(JSON.parse<NonOptMedium>(nomin)));
  },
  N,
  String.UTF8.byteLength(nomin),
);

bench(
  "Deserialize optional — min (seenAny tier 1)",
  () => {
    blackbox(inline.always(JSON.parse<OptMedium>(omin)));
  },
  N,
  String.UTF8.byteLength(omin),
);

bench(
  "Deserialize optional — pretty (tier 2 probe path)",
  () => {
    blackbox(inline.always(JSON.parse<OptMedium>(opretty)));
  },
  N,
  String.UTF8.byteLength(opretty),
);
