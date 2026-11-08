import { JSON } from "../index";
const counts: i32[] = [0, 1, 2, 3, 4, 7, 8, 9, 15, 16, 17, 64, 129];
function check<T extends number>(values: T[], n: i32): void {
  assert(values.length == n);
  for (let i = 0; i < n; i++) assert(values[i] == <T>(<f64>i * 0.25 - 0.5));
}
function exercise<T extends number>(): i32 {
  const retained = new Array<T[]>();
  __pin(changetype<usize>(retained));
  for (let c = 0; c < counts.length; c++) {
    const n = counts[c];
    let source = "[";
    for (let i = 0; i < n; i++) {
      if (i) source += ",";
      source += (<f64>i * 0.25 - 0.5).toString();
    }
    source += "]";
    __pin(changetype<usize>(source));
    const wrapper = "[" + source + "]";
    __pin(changetype<usize>(wrapper));
    const root = JSON.parse<Array<T[]>>(wrapper);
    __pin(changetype<usize>(root));
    check(root[0], n);
    const spaced = "[ \n " + source + " \t ]";
    const nested = JSON.parse<Array<Array<T[]>>>("[" + spaced + "]");
    __pin(changetype<usize>(nested));
    check(nested[0][0], n);
    if (n) root[0][0] = <T>99;
    JSON.parse<Array<T[]>>(wrapper, root);
    check(root[0], n);
    retained.push(root[0]);
    const shared = new Array<T>();
    shared.push(<T>99);
    const out: Array<T[]> = [shared, shared];
    JSON.parse<Array<T[]>>("[" + source + "," + source + "]", out);
    check(out[0], n);
    check(out[1], n);
    assert(out[0] !== out[1]);
    __collect();
    check(root[0], n);
    check(nested[0][0], n);
    __unpin(changetype<usize>(nested));
    __unpin(changetype<usize>(root));
    __unpin(changetype<usize>(wrapper));
    __unpin(changetype<usize>(source));
  }
  __collect();
  for (let c = 0; c < counts.length; c++) {
    const values = retained[c];
    check(values, counts[c]);
    values.push(<T>123);
    assert(values[values.length - 1] == <T>123);
  }
  __unpin(changetype<usize>(retained));
  return counts.length;
}
let constructions: i32 = 0;
class Floats extends Array<f64> {
  tag: i32 = 37;
  constructor() {
    super();
    constructions++;
  }
}
// eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- AssemblyScript native type
function subtype(value: Object): bool {
  return value instanceof Floats;
}
export function verify(): i32 {
  const result = exercise<f32>() + exercise<f64>();
  const out = JSON.parse<Floats[]>("[[1.25,2.5]]");
  __pin(changetype<usize>(out));
  assert(
    subtype(out[0]) &&
      out[0].tag == 37 &&
      out[0][0] == 1.25 &&
      out[0][1] == 2.5,
  );
  assert(constructions == 1);
  __collect();
  assert(out[0].tag == 37);
  __unpin(changetype<usize>(out));
  return result;
}
