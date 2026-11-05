import { JSON } from "../..";

@json class Base {
  anchor: i32 = 1;
}

@json class State extends Base {

  @optional value: i32 = 7;

  @optional other: i32 = 8;
}
export function run(pretty: bool): string {
  const source = pretty
    ? '{ "anchor": 1, "other": 2 }'
    : '{"anchor":1,"other":2}';
  const out = JSON.parse<State>('{"anchor":1,"value":99,"other":88}');
  const fresh = JSON.parse<State>(source);
  const reused = JSON.parse<State>(source, out);
  return (
    fresh.value.toString() +
    ":" +
    fresh.other.toString() +
    "|" +
    reused.value.toString() +
    ":" +
    reused.other.toString()
  );
}
