import { JSON } from "../../index";
import { expect } from "../../__tests__/lib";
import { bench, blackbox } from "../lib/bench";

// Head-to-head: tier-1 (exact, minified) vs tier-2 (whitespace-tolerant) on the
// SAME medium struct. Three inputs of identical data:
//   1. min     - minified              -> tier 1
//   2. tier2   - one space after `{`   -> tier 2 with an otherwise minified
//                                          body, isolating the path overhead
//   3. pretty  - fully indented        -> tier 2 doing real whitespace skipping
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

// Worst case for tier-2: many fields, all trivial primitive values - almost no
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

// Mixed fields exercise the capped collection-bearing tier-3 path. Reordered
// and unknown-key variants keep its benefit directly comparable with the
// generic fallback used before collection schemas became eligible.
@json
class FallbackChild {
  label: string = "";
  value: i32 = 0;
}


@json
class MixedFallbackProbe {
  id: i32 = 0;
  name: string = "";
  active: boolean = false;
  score: f64 = 0.0;
  tags: string[] = [];
  child: FallbackChild = new FallbackChild();
  children: FallbackChild[] = [];
  count: i32 = 0;
}


@json
class MidScalarChild {
  a: string = "";
  b: i32 = 0;
  c: boolean = false;
  d: f64 = 0.0;
  e: string = "";
  f: i32 = 0;
}


@json
class MidScalarParent {
  id: i32 = 0;
  items: MidScalarChild[] = [];
  tail: string = "";
}

// Eight scalar fields deliberately miss the <=6 keyed-fallback cap. The
// reordered child therefore isolates the nested fast-miss -> slow-parser path.
@json
class DirectSlowChild {
  a: string = "";
  b: i32 = 0;
  c: boolean = false;
  d: f64 = 0.0;
  e: string = "";
  f: i32 = 0;
  g: string = "";
  h: i32 = 0;
}


@json
class DirectSlowParent {
  id: i32 = 0;
  child: DirectSlowChild = new DirectSlowChild();
  tail: string = "";
}

const v = new MediumAPIResponse();
const min: string = JSON.stringify<MediumAPIResponse>(v);
const tier2: string = "{ " + min.substring(1);
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
const dtier2: string = "{ " + dmin.substring(1);
const dpretty: string = prettyPrint(dmin);

expect(JSON.stringify(JSON.parse<FieldDense>(dmin))).toBe(dmin);
expect(JSON.stringify(JSON.parse<FieldDense>(dtier2))).toBe(dmin);
expect(JSON.stringify(JSON.parse<FieldDense>(dpretty))).toBe(dmin);

// All three must parse to the same data (and confirm the fast path actually
// produces correct output for tier 2, not just tier 1).
expect(JSON.stringify(JSON.parse<MediumAPIResponse>(min))).toBe(min);
expect(JSON.stringify(JSON.parse<MediumAPIResponse>(tier2))).toBe(min);
expect(JSON.stringify(JSON.parse<MediumAPIResponse>(pretty))).toBe(min);

const mixedCanonical =
  '{"id":42,"name":"probe","active":true,"score":12.5,"tags":["fast","typed"],"child":{"label":"one","value":1},"children":[{"label":"two","value":2},{"label":"three","value":3}],"count":2}';
const mixedReordered =
  '{"count":2,"children":[{"value":2,"label":"two"},{"value":3,"label":"three"}],"child":{"value":1,"label":"one"},"tags":["fast","typed"],"score":12.5,"active":true,"name":"probe","id":42}';
const mixedUnknown =
  '{"unknown":{"nested":[1,{"label":"skip"},true]},"id":42,"name":"probe","active":true,"score":12.5,"tags":["fast","typed"],"child":{"label":"one","value":1},"children":[{"label":"two","value":2},{"label":"three","value":3}],"count":2}';
const mixedLateSwap =
  '{"id":42,"name":"probe","active":true,"score":12.5,"tags":["fast","typed"],"child":{"label":"one","value":1},"count":2,"children":[{"label":"two","value":2},{"label":"three","value":3}]}';
const mixedLateUnknown =
  '{"id":42,"name":"probe","active":true,"score":12.5,"tags":["fast","typed"],"child":{"label":"one","value":1},"children":[{"label":"two","value":2},{"label":"three","value":3}],"unknown":{"nested":[1,true]},"count":2}';
const mixedLateWhitespace =
  '{"id":42,"name":"probe","active":true,"score":12.5,"tags":["fast","typed"],"child":{"label":"one","value":1},"children":[{"label":"two","value":2},{"label":"three","value":3}],"count" :2}';
const midCanonical =
  '{"id":7,"items":[{"a":"one","b":2,"c":true,"d":4.5,"e":"five","f":6},{"a":"seven","b":8,"c":false,"d":10.5,"e":"eleven","f":12}],"tail":"done"}';
const midReordered =
  '{"tail":"done","items":[{"f":6,"e":"five","d":4.5,"c":true,"b":2,"a":"one"},{"f":12,"e":"eleven","d":10.5,"c":false,"b":8,"a":"seven"}],"id":7}';
const directSlowCanonical =
  '{"id":7,"child":{"a":"one","b":2,"c":true,"d":4.5,"e":"five","f":6,"g":"seven","h":8},"tail":"done"}';
const directSlowReordered =
  '{"id":7,"child":{"h":8,"g":"seven","f":6,"e":"five","d":4.5,"c":true,"b":2,"a":"one"},"tail":"done"}';

expect(JSON.stringify(JSON.parse<MixedFallbackProbe>(mixedCanonical))).toBe(
  mixedCanonical,
);
expect(JSON.stringify(JSON.parse<MixedFallbackProbe>(mixedReordered))).toBe(
  mixedCanonical,
);
expect(JSON.stringify(JSON.parse<MixedFallbackProbe>(mixedUnknown))).toBe(
  mixedCanonical,
);
expect(JSON.stringify(JSON.parse<MixedFallbackProbe>(mixedLateSwap))).toBe(
  mixedCanonical,
);
expect(JSON.stringify(JSON.parse<MixedFallbackProbe>(mixedLateUnknown))).toBe(
  mixedCanonical,
);
expect(
  JSON.stringify(JSON.parse<MixedFallbackProbe>(mixedLateWhitespace)),
).toBe(mixedCanonical);
const mixedReuse = JSON.parse<MixedFallbackProbe>(mixedCanonical);
expect(
  JSON.stringify(JSON.parse<MixedFallbackProbe>(mixedLateSwap, mixedReuse)),
).toBe(mixedCanonical);
expect(JSON.stringify(JSON.parse<MidScalarParent>(midCanonical))).toBe(
  midCanonical,
);
expect(JSON.stringify(JSON.parse<MidScalarParent>(midReordered))).toBe(
  midCanonical,
);
expect(JSON.stringify(JSON.parse<DirectSlowParent>(directSlowCanonical))).toBe(
  directSlowCanonical,
);
expect(JSON.stringify(JSON.parse<DirectSlowParent>(directSlowReordered))).toBe(
  directSlowCanonical,
);

const N = 300_000;

bench(
  "Deserialize medium - min (tier 1, exact)",
  () => {
    blackbox(inline.always(JSON.parse<MediumAPIResponse>(min)));
  },
  N,
  String.UTF8.byteLength(min),
);

bench(
  "Deserialize medium - internal space (tier 2 overhead)",
  () => {
    blackbox(inline.always(JSON.parse<MediumAPIResponse>(tier2)));
  },
  N,
  String.UTF8.byteLength(tier2),
);

bench(
  "Deserialize medium - pretty (tier 2, real whitespace)",
  () => {
    blackbox(inline.always(JSON.parse<MediumAPIResponse>(pretty)));
  },
  N,
  String.UTF8.byteLength(pretty),
);

bench(
  "Deserialize field-dense - min (tier 1, exact)",
  () => {
    blackbox(inline.always(JSON.parse<FieldDense>(dmin)));
  },
  N,
  String.UTF8.byteLength(dmin),
);

bench(
  "Deserialize field-dense - internal space (tier 2 overhead)",
  () => {
    blackbox(inline.always(JSON.parse<FieldDense>(dtier2)));
  },
  N,
  String.UTF8.byteLength(dtier2),
);

bench(
  "Deserialize field-dense - pretty (tier 2, real whitespace)",
  () => {
    blackbox(inline.always(JSON.parse<FieldDense>(dpretty)));
  },
  N,
  String.UTF8.byteLength(dpretty),
);

bench(
  "Deserialize non-opt twin - min (flat tier 1)",
  () => {
    blackbox(inline.always(JSON.parse<NonOptMedium>(nomin)));
  },
  N,
  String.UTF8.byteLength(nomin),
);

bench(
  "Deserialize optional - min (seenAny tier 1)",
  () => {
    blackbox(inline.always(JSON.parse<OptMedium>(omin)));
  },
  N,
  String.UTF8.byteLength(omin),
);

bench(
  "Deserialize optional - pretty (tier 2 probe path)",
  () => {
    blackbox(inline.always(JSON.parse<OptMedium>(opretty)));
  },
  N,
  String.UTF8.byteLength(opretty),
);

bench(
  "Deserialize mixed - canonical",
  () => {
    blackbox(inline.always(JSON.parse<MixedFallbackProbe>(mixedCanonical)));
  },
  N,
  String.UTF8.byteLength(mixedCanonical),
);

bench(
  "Deserialize mixed - reordered fallback",
  () => {
    blackbox(inline.always(JSON.parse<MixedFallbackProbe>(mixedReordered)));
  },
  N,
  String.UTF8.byteLength(mixedReordered),
);

bench(
  "Deserialize mixed - unknown-key fallback",
  () => {
    blackbox(inline.always(JSON.parse<MixedFallbackProbe>(mixedUnknown)));
  },
  N,
  String.UTF8.byteLength(mixedUnknown),
);

bench(
  "Deserialize mixed - late-swap fallback",
  () => {
    blackbox(inline.always(JSON.parse<MixedFallbackProbe>(mixedLateSwap)));
  },
  N,
  String.UTF8.byteLength(mixedLateSwap),
);

bench(
  "Deserialize mixed - late-swap fallback (reused out)",
  () => {
    blackbox(
      inline.always(JSON.parse<MixedFallbackProbe>(mixedLateSwap, mixedReuse)),
    );
  },
  N,
  String.UTF8.byteLength(mixedLateSwap),
);

bench(
  "Deserialize mixed - late unknown-key fallback",
  () => {
    blackbox(inline.always(JSON.parse<MixedFallbackProbe>(mixedLateUnknown)));
  },
  N,
  String.UTF8.byteLength(mixedLateUnknown),
);

bench(
  "Deserialize mixed - late whitespace (tier 2)",
  () => {
    blackbox(
      inline.always(JSON.parse<MixedFallbackProbe>(mixedLateWhitespace)),
    );
  },
  N,
  String.UTF8.byteLength(mixedLateWhitespace),
);

bench(
  "Deserialize mid-scalar child - canonical",
  () => {
    blackbox(inline.always(JSON.parse<MidScalarParent>(midCanonical)));
  },
  N,
  String.UTF8.byteLength(midCanonical),
);

bench(
  "Deserialize mid-scalar child - reordered fallback",
  () => {
    blackbox(inline.always(JSON.parse<MidScalarParent>(midReordered)));
  },
  N,
  String.UTF8.byteLength(midReordered),
);

bench(
  "Deserialize nested direct-slow child - canonical",
  () => {
    blackbox(inline.always(JSON.parse<DirectSlowParent>(directSlowCanonical)));
  },
  N,
  String.UTF8.byteLength(directSlowCanonical),
);

bench(
  "Deserialize nested direct-slow child - reordered fallback",
  () => {
    blackbox(inline.always(JSON.parse<DirectSlowParent>(directSlowReordered)));
  },
  N,
  String.UTF8.byteLength(directSlowReordered),
);
