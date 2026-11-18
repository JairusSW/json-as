import { JSON } from "../../assembly";
import { bs } from "../../lib/as-bs";
let strings = new Set<string>();
let nullable = new Set<string | null>();
let useNullable = false;
let retained = "";

export function setup(size: i32, kind: i32, deleted: bool): void {
  strings = new Set<string>();
  nullable = new Set<string | null>();
  useNullable = kind == 3;
  for (let i = 0; i < size; i++) {
    let value = "s" + i.toString();
    if (kind == 1) value = '"\\\n\u0000' + value;
    if (kind == 2) value = '"\\\n'.repeat(128) + value;
    strings.add(value);
    nullable.add(i == 0 ? null : value);
  }
  if (deleted) {
    const a = strings.values();
    const b = nullable.values();
    for (let i = 1; i < size; i += 4) {
      strings.delete(a[i]);
      nullable.delete(b[i]);
    }
  }
  retained = "";
  bs.reset();
}

export function run(iterations: i32): i32 {
  let sum = 0;
  for (let i = 0; i < iterations; i++) {
    retained = useNullable ? JSON.stringify(nullable) : JSON.stringify(strings);
    sum += retained.length;
  }
  return sum;
}

export function output(): string {
  return retained;
}
