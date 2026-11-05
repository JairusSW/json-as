import { JSON } from "../..";


@json
class Item {
  n: i32 = 0;
}


@json
class Holder {
  items: (Item | null)[] = [];
}

function show(value: Holder): string {
  return JSON.stringify(value);
}

export function run(pretty: bool): string {
  const onlyNull = pretty ? '{ "items": [ null ] }' : '{"items":[null]}';
  const mixed = pretty
    ? '{ "items": [ null, { "n": 2 }, null ] }'
    : '{"items":[null,{"n":2},null]}';
  const fresh = JSON.parse<Holder>(onlyNull);
  assert(fresh.items[0] === null);
  const out = JSON.parse<Holder>('{"items":[{"n":1},null,{"n":3}]}');
  JSON.parse<Holder>(mixed, out);
  assert(
    out.items[0] === null && out.items[1]!.n == 2 && out.items[2] === null,
  );
  JSON.parse<Holder>('{"items":[{"n":4},null,{"n":5}]}', out);
  assert(out.items[0]!.n == 4 && out.items[1] === null && out.items[2]!.n == 5);
  JSON.parse<Holder>(onlyNull, out);
  const direct = JSON.parse<(Item | null)[]>("[null]");
  assert(direct[0] === null);
  return show(fresh) + "|" + show(out);
}
