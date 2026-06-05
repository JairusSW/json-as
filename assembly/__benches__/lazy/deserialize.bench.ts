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

bench(
  "Deseriaize Small Eager",
  () => {
    blackbox(JSON.parse<SmallE>(smallJson));
  },
  ITER,
  smallBytes,
);
dumpToFile("lz-small-eager", "deserialize");

bench(
  "Deserialize Small Lazy",
  () => {
    blackbox(JSON.parse<SmallL>(smallJson));
  },
  ITER,
  smallBytes,
);
dumpToFile("lz-small-lazy", "deserialize");

bench(
  "Deserialize Medium Eager",
  () => {
    blackbox(JSON.parse<MediumE>(mediumJson));
  },
  ITER,
  mediumBytes,
);
dumpToFile("lz-medium-eager", "deserialize");

bench(
  "Deserialize Medium Lazy",
  () => {
    blackbox(JSON.parse<MediumL>(mediumJson));
  },
  ITER,
  mediumBytes,
);
dumpToFile("lz-medium-lazy", "deserialize");

bench(
  "Deserialize Large Eager",
  () => {
    blackbox(JSON.parse<LargeE>(largeJson));
  },
  ITER,
  largeBytes,
);
dumpToFile("lz-large-eager", "deserialize");

bench(
  "Deserialize Large Lazy",
  () => {
    blackbox(JSON.parse<LargeL>(largeJson));
  },
  ITER,
  largeBytes,
);
dumpToFile("lz-large-lazy", "deserialize");
