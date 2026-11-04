import { JSON } from "../..";
let calls: i32 = 0;
class Raw extends JSON.Raw {
  marker: i32 = 9;
  constructor(value: string) {
    super(value);
    calls++;
  }
}
function check(value: Raw): void {
  assert(load<u32>(changetype<usize>(value) - 8) == idof<Raw>());
  assert(value.marker == 9);
}
export function run(): string {
  calls = 0;
  const out = JSON.parse<Raw>("[1,2]");
  check(out);
  assert(calls == 1);
  JSON.parse<Raw>("[1,2]", out);
  check(out);
  assert(calls == 1);
  const array = JSON.parse<Raw[]>("[[1,2]]");
  check(array[0]);
  assert(calls == 2);
  const map = JSON.parse<Map<string, Raw>>('{"x":[1,2]}');
  check(map.get("x"));
  assert(calls == 3);
  return JSON.stringify(out);
}
