import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox } from "./lib/bench";


@json
class Vec3 {
  public x!: i32;
  public y!: i32;
  public z!: i32;
}

const v1: Vec3 = { x: 1, y: 2, z: 3 };
const v2 = '{"x":1,"y":2,"z":3}';

expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<Vec3>(v2))).toBe(v2);

bench(
  "Serialize Vec3",
  () => {
    blackbox(inline.always(JSON.stringify(v1)));
  },
  128_000_00,
  v2.length << 1
);

bench(
  "Deserialize Vec3",
  () => {
    blackbox(inline.always(JSON.parse<Vec3>(v2)));
  },
  128_000_00,
  v2.length << 1
);
