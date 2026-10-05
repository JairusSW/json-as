import { JSON } from "../../assembly";


@json
class CustomPart {
  value: i32 = 17;


  @serializer("string")
  serialize(self: CustomPart): string {
    return JSON.stringify<string>("custom-" + self.value.toString());
  }
}

let values = new JSON.Arr();
let separator = ",";
let result = "";

export function setup(length: i32, kind: i32, emptySeparator: bool): void {
  values = new JSON.Arr();
  separator = emptySeparator ? "" : "::";
  for (let i = 0; i < length; i++) {
    if (kind == 2 || (kind == 1 && i % 5 == 0)) values.push<usize>(0);
    else if (kind == 1 && i % 5 == 1) values.push<i32>(42);
    else if (kind == 1 && i % 5 == 2) values.push<bool>(true);
    else if (kind == 4 || (kind == 1 && i % 5 == 3))
      values.push<JSON.Arr>(JSON.parse<JSON.Arr>('[1,{"x":"nested"}]'));
    else if (kind == 5) values.push<CustomPart>(new CustomPart());
    else values.push<string>(kind == 3 ? "café中文😀" : "abcdefgh");
  }
  // Warm lazy slots and serializer capacity before either measurement.
  result = values.join(separator);
  __collect();
}

function elemStr(i: i32): string {
  const v = values.at(i);
  const t = v.type;
  if (t == JSON.Types.String) return v.get<string>();
  if (t == JSON.Types.Null) return "";
  return JSON.stringify(v);
}

// The pre-change JSON.Arr.join loop, retained only for A/B measurements.
function baseline(): string {
  const n = values.length;
  if (n == 0) return "";
  let out = elemStr(0);
  for (let i = 1; i < n; i++) out += separator + elemStr(i);
  return out;
}

export function run(old: bool, iterations: i32): i32 {
  let checksum = 0;
  for (let i = 0; i < iterations; i++) {
    result = old ? baseline() : values.join(separator);
    checksum ^= result.length;
  }
  return checksum;
}

export function output(): string {
  return result;
}
