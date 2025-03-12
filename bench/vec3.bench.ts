import { bench } from "./lib/bench";

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
    JSON.stringify(v1);
  },
  16_000_00,
);

bench(
  "Deserialize Vec3",
  () => {
    JSON.parse(v2);
  },
  16_000_00,
);
