import { bench, blackbox, dumpToFile, utf8ByteLength } from "./lib/bench.js";

class Vec3 {
  public x!: number;
  public y!: number;
  public z!: number;
}

const v2 = '{"x":1,"y":2,"z":3}';
const v1 = JSON.parse(v2) as Vec3;

bench(
  "Serialize Vec3",
  () => {
    blackbox(JSON.stringify(v1));
  },
  12_800_000,
  utf8ByteLength(v2),
);
dumpToFile("vec3", "serialize");

bench(
  "Deserialize Vec3",
  () => {
    blackbox(JSON.parse(v2));
  },
  12_800_000,
  utf8ByteLength(v2),
);
dumpToFile("vec3", "deserialize");
