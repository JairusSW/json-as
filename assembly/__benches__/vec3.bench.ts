import { JSON } from "..";
import { bench } from "../custom/bench";


@json
class Vec3 {
  public x!: i32;
  public y!: i32;
  public z!: i32;
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
    JSON.parse<Vec3>(v2);
  },
  16_000_00,
);
