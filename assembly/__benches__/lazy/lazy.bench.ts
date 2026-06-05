import { JSON } from "../..";
import { bench, blackbox, dumpToFile, utf8ByteLength } from "../lib/bench";

// Lazy-fields benchmark: eager vs `@json({ lazy: "auto" })` across payload sizes
// for serialize / deserialize / round-trip, plus a read-pattern sweep. Run with:
//   bun run bench:as lazy/ --mode simd
// then build the charts with scripts/build-chart15.ts.
//
// Each size is declared twice with identical fields — once eager, once lazy —
// so the only difference measured is the deferral. `large` is kept moderate
// (~18 fields); lazy "auto" on very wide structs (100+ fields) can blow up the
// Binaryen optimizer.
const ITER: u32 = 1_000_000;


@json
class Addr {
  street: string = "742 Evergreen Terrace";
  city: string = "Springfield";
  region: string = "OR";
  zip: string = "97477";
  country: string = "United States";
}

// ----------------------------- small (~90 B) -----------------------------
@json
class SmallE {
  id: i32 = 8472;
  name: string = "jairus";
  active: bool = true;
  email: string = "me@jairus.dev";
}

@json({ lazy: "auto" })
class SmallL {
  id: i32 = 8472;
  name: string = "jairus";
  active: bool = true;
  email: string = "me@jairus.dev";
}

// ----------------------------- medium (~600 B) ---------------------------
@json
class MediumE {
  id: i32 = 8472;
  name: string = "Jairus Tanaka";
  email: string = "me@jairus.dev";
  bio: string =
    "Systems and compiler engineer working on AssemblyScript tooling.";
  addr: Addr = new Addr();
  tags: string[] = ["assemblyscript", "json", "simd", "wasm", "performance"];
  scores: i32[] = [98, 72, 64, 51, 89, 77];
  active: bool = true;
  created: string = "2025-01-02T03:04:05Z";
  updated: string = "2025-12-23T04:30:00Z";
}

@json({ lazy: "auto" })
class MediumL {
  id: i32 = 8472;
  name: string = "Jairus Tanaka";
  email: string = "me@jairus.dev";
  bio: string =
    "Systems and compiler engineer working on AssemblyScript tooling.";
  addr: Addr = new Addr();
  tags: string[] = ["assemblyscript", "json", "simd", "wasm", "performance"];
  scores: i32[] = [98, 72, 64, 51, 89, 77];
  active: bool = true;
  created: string = "2025-01-02T03:04:05Z";
  updated: string = "2025-12-23T04:30:00Z";
}

// ----------------------------- large (~3 KB) -----------------------------
@json
class LargeE {
  id: i32 = 8472;
  uuid: string = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  name: string = "Jairus Tanaka";
  email: string = "me@jairus.dev";
  bio: string =
    "Systems and compiler engineer working on AssemblyScript tooling, JSON serialization, and SIMD-accelerated parsers for WebAssembly runtimes.";
  homepage: string = "https://jairus.dev";
  avatar: string = "https://avatars.githubusercontent.com/u/583231?v=4";
  addr: Addr = new Addr();
  billing: Addr = new Addr();
  tags: string[] = [
    "assemblyscript",
    "json",
    "simd",
    "swar",
    "wasm",
    "performance",
    "compilers",
    "serde",
  ];
  scores: i32[] = [98, 72, 64, 51, 89, 77, 33, 41, 95, 60];
  followers: i32[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  active: bool = true;
  verified: bool = true;
  plan: string = "enterprise";
  created: string = "2025-01-02T03:04:05Z";
  updated: string = "2025-12-23T04:30:00Z";
  note: string =
    "All systems nominal; payload intentionally padded to a few kilobytes for the large case.";
}

@json({ lazy: "auto" })
class LargeL {
  id: i32 = 8472;
  uuid: string = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  name: string = "Jairus Tanaka";
  email: string = "me@jairus.dev";
  bio: string =
    "Systems and compiler engineer working on AssemblyScript tooling, JSON serialization, and SIMD-accelerated parsers for WebAssembly runtimes.";
  homepage: string = "https://jairus.dev";
  avatar: string = "https://avatars.githubusercontent.com/u/583231?v=4";
  addr: Addr = new Addr();
  billing: Addr = new Addr();
  tags: string[] = [
    "assemblyscript",
    "json",
    "simd",
    "swar",
    "wasm",
    "performance",
    "compilers",
    "serde",
  ];
  scores: i32[] = [98, 72, 64, 51, 89, 77, 33, 41, 95, 60];
  followers: i32[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  active: bool = true;
  verified: bool = true;
  plan: string = "enterprise";
  created: string = "2025-01-02T03:04:05Z";
  updated: string = "2025-12-23T04:30:00Z";
  note: string =
    "All systems nominal; payload intentionally padded to a few kilobytes for the large case.";
}

// JSON strings (same bytes for eager + lazy of a size).
const smallJson = JSON.stringify(new SmallE());
const mediumJson = JSON.stringify(new MediumE());
const largeJson = JSON.stringify(new LargeE());
const smallBytes = utf8ByteLength(smallJson);
const mediumBytes = utf8ByteLength(mediumJson);
const largeBytes = utf8ByteLength(largeJson);

// Pre-built instances for the serialize benchmark (write path).
const smallE = new SmallE();
const smallL = JSON.parse<SmallL>(smallJson);
const mediumE = new MediumE();
const mediumL = JSON.parse<MediumL>(mediumJson);
const largeE = new LargeE();
const largeL = JSON.parse<LargeL>(largeJson);

// =============================== serialize ===============================
bench(
  "ser small eager",
  () => {
    blackbox(JSON.stringify(smallE));
  },
  ITER,
  smallBytes,
);
dumpToFile("lz-small-eager", "serialize");
bench(
  "ser small lazy",
  () => {
    blackbox(JSON.stringify(smallL));
  },
  ITER,
  smallBytes,
);
dumpToFile("lz-small-lazy", "serialize");
bench(
  "ser medium eager",
  () => {
    blackbox(JSON.stringify(mediumE));
  },
  ITER,
  mediumBytes,
);
dumpToFile("lz-medium-eager", "serialize");
bench(
  "ser medium lazy",
  () => {
    blackbox(JSON.stringify(mediumL));
  },
  ITER,
  mediumBytes,
);
dumpToFile("lz-medium-lazy", "serialize");
bench(
  "ser large eager",
  () => {
    blackbox(JSON.stringify(largeE));
  },
  ITER,
  largeBytes,
);
dumpToFile("lz-large-eager", "serialize");
bench(
  "ser large lazy",
  () => {
    blackbox(JSON.stringify(largeL));
  },
  ITER,
  largeBytes,
);
dumpToFile("lz-large-lazy", "serialize");

// ============================== deserialize ==============================
bench(
  "deser small eager",
  () => {
    blackbox(JSON.parse<SmallE>(smallJson));
  },
  ITER,
  smallBytes,
);
dumpToFile("lz-small-eager", "deserialize");
bench(
  "deser small lazy",
  () => {
    blackbox(JSON.parse<SmallL>(smallJson));
  },
  ITER,
  smallBytes,
);
dumpToFile("lz-small-lazy", "deserialize");
bench(
  "deser medium eager",
  () => {
    blackbox(JSON.parse<MediumE>(mediumJson));
  },
  ITER,
  mediumBytes,
);
dumpToFile("lz-medium-eager", "deserialize");
bench(
  "deser medium lazy",
  () => {
    blackbox(JSON.parse<MediumL>(mediumJson));
  },
  ITER,
  mediumBytes,
);
dumpToFile("lz-medium-lazy", "deserialize");
bench(
  "deser large eager",
  () => {
    blackbox(JSON.parse<LargeE>(largeJson));
  },
  ITER,
  largeBytes,
);
dumpToFile("lz-large-eager", "deserialize");
bench(
  "deser large lazy",
  () => {
    blackbox(JSON.parse<LargeL>(largeJson));
  },
  ITER,
  largeBytes,
);
dumpToFile("lz-large-lazy", "deserialize");

// =============================== round-trip ==============================
bench(
  "rt small eager",
  () => {
    blackbox(JSON.stringify(JSON.parse<SmallE>(smallJson)));
  },
  ITER,
  smallBytes,
);
dumpToFile("lz-small-eager", "roundtrip");
bench(
  "rt small lazy",
  () => {
    blackbox(JSON.stringify(JSON.parse<SmallL>(smallJson)));
  },
  ITER,
  smallBytes,
);
dumpToFile("lz-small-lazy", "roundtrip");
bench(
  "rt medium eager",
  () => {
    blackbox(JSON.stringify(JSON.parse<MediumE>(mediumJson)));
  },
  ITER,
  mediumBytes,
);
dumpToFile("lz-medium-eager", "roundtrip");
bench(
  "rt medium lazy",
  () => {
    blackbox(JSON.stringify(JSON.parse<MediumL>(mediumJson)));
  },
  ITER,
  mediumBytes,
);
dumpToFile("lz-medium-lazy", "roundtrip");
bench(
  "rt large eager",
  () => {
    blackbox(JSON.stringify(JSON.parse<LargeE>(largeJson)));
  },
  ITER,
  largeBytes,
);
dumpToFile("lz-large-eager", "roundtrip");
bench(
  "rt large lazy",
  () => {
    blackbox(JSON.stringify(JSON.parse<LargeL>(largeJson)));
  },
  ITER,
  largeBytes,
);
dumpToFile("lz-large-lazy", "roundtrip");

// ===================== access pattern (medium struct) ====================
// eager baseline: parse always materializes everything.
bench(
  "acc eager read-all",
  () => {
    const m = JSON.parse<MediumE>(mediumJson);
    blackbox(
      m.name.length +
        m.email.length +
        m.bio.length +
        m.addr.city.length +
        m.tags.length +
        m.scores.length,
    );
  },
  ITER,
  mediumBytes,
);
dumpToFile("lz-access", "eager");
// lazy: read none / one / all / passthrough.
bench(
  "acc lazy read-none",
  () => {
    blackbox(JSON.parse<MediumL>(mediumJson).id);
  },
  ITER,
  mediumBytes,
);
dumpToFile("lz-access", "none");
bench(
  "acc lazy read-one",
  () => {
    blackbox(JSON.parse<MediumL>(mediumJson).addr.city.length);
  },
  ITER,
  mediumBytes,
);
dumpToFile("lz-access", "one");
bench(
  "acc lazy read-all",
  () => {
    const m = JSON.parse<MediumL>(mediumJson);
    blackbox(
      m.name.length +
        m.email.length +
        m.bio.length +
        m.addr.city.length +
        m.tags.length +
        m.scores.length,
    );
  },
  ITER,
  mediumBytes,
);
dumpToFile("lz-access", "all");
bench(
  "acc lazy passthrough",
  () => {
    blackbox(JSON.stringify(JSON.parse<MediumL>(mediumJson)));
  },
  ITER,
  mediumBytes,
);
dumpToFile("lz-access", "pass");
