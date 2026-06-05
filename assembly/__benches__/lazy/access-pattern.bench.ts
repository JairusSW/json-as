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

const mediumJson = JSON.stringify(new MediumE());
const mediumBytes = utf8ByteLength(mediumJson);

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
