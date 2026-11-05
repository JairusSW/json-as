import { JSON } from "../..";


@json
class State {

  @alias("return srcStart;")
  value: i32 = 7;

  @alias("return srcStart + 2;")
  other: i32 = 8;

  @alias("return srcStartX;")
  control: i32 = 0;
}

export function run(pretty: bool): string {
  const source = pretty
    ? '{ "return srcStart;": 9, "return srcStart + 2;": 10, "return srcStartX;": 11 }'
    : '{"return srcStart;":9,"return srcStart + 2;":10,"return srcStartX;":11}';
  const out = JSON.parse<State>(source);
  JSON.parse<State>(source, out);
  return (
    out.value.toString() +
    ":" +
    out.other.toString() +
    ":" +
    out.control.toString()
  );
}
