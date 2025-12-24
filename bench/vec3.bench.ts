import { bench, blackbox, dumpToFile } from "./lib/bench.js";

class Vec3 {
  public x!: number;
  public y!: number;
  public z!: number;
}

const v1: Vec3 = { x: 1, y: 2, z: 3 };
const v2 = '{"x":1,"y":2,"z":3}';

bench(
  "Serialize Vec3",
  () => {
    blackbox(JSON.stringify(v1));
  },
  16_000_00,
  v2.length << 1
);
dumpToFile("vec3", "serialize")

bench(
  "Deserialize Vec3",
  () => {
    blackbox(JSON.parse(v2));
  },
  16_000_00,
  v2.length << 1
);
dumpToFile("vec3", "deserialize")