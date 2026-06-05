import { JSON } from "../..";
import { bench, blackbox, dumpToFile, utf8ByteLength } from "../lib/bench";

const ITER: u32 = 1_000_000;


@json
class Addr {
  street: string = "742 Evergreen Terrace";
  city: string = "Springfield";
  region: string = "OR";
  zip: string = "97477";
  country: string = "United States";
}


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

const smallJson = JSON.stringify(new SmallE());
const mediumJson = JSON.stringify(new MediumE());
const largeJson = JSON.stringify(new LargeE());
const smallBytes = utf8ByteLength(smallJson);
const mediumBytes = utf8ByteLength(mediumJson);
const largeBytes = utf8ByteLength(largeJson);

const smallE = new SmallE();
const smallL = JSON.parse<SmallL>(smallJson);
const mediumE = new MediumE();
const mediumL = JSON.parse<MediumL>(mediumJson);
const largeE = new LargeE();
const largeL = JSON.parse<LargeL>(largeJson);

bench(
  "Serialize Small Eager",
  () => {
    blackbox(JSON.stringify(smallE));
  },
  ITER,
  smallBytes,
);
dumpToFile("lz-small-eager", "serialize");

bench(
  "Serialize Small Lazy",
  () => {
    blackbox(JSON.stringify(smallL));
  },
  ITER,
  smallBytes,
);
dumpToFile("lz-small-lazy", "serialize");

bench(
  "Serialize Medium Eager",
  () => {
    blackbox(JSON.stringify(mediumE));
  },
  ITER,
  mediumBytes,
);
dumpToFile("lz-medium-eager", "serialize");

bench(
  "Serialize Medium Lazy",
  () => {
    blackbox(JSON.stringify(mediumL));
  },
  ITER,
  mediumBytes,
);
dumpToFile("lz-medium-lazy", "serialize");

bench(
  "Serialize Large Eager",
  () => {
    blackbox(JSON.stringify(largeE));
  },
  ITER,
  largeBytes,
);
dumpToFile("lz-large-eager", "serialize");

bench(
  "Serialize Large Lazy",
  () => {
    blackbox(JSON.stringify(largeL));
  },
  ITER,
  largeBytes,
);
dumpToFile("lz-large-lazy", "serialize");
