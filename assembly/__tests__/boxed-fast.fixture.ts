import { JSON } from "../index";


@json
class Row {

  @optional value: JSON.Box<i64> | null = null;
  tail: i32 = 0;
}

export function fastEnabled(): bool {
  return new Row().__DESERIALIZE_FAST_ENABLED();
}

export function verify(): i32 {
  const row = JSON.parse<Row>('{"value":9007199254740993,"tail":2}');
  if (
    row.value === null ||
    row.value!.value != 9007199254740993 ||
    row.tail != 2
  )
    return 1;
  JSON.parse<Row>('{"tail":3}', row);
  if (row.value !== null || row.tail != 3) return 2;
  JSON.parse<Row>('{"value":null,"tail":4}', row);
  if (row.value !== null || row.tail != 4) return 3;
  JSON.parse<Row>('{"tail":5,"value":7}', row);
  if (row.value === null || row.value!.value != 7 || row.tail != 5) return 4;
  return 0;
}


@json
class Defaults {

  @optional value: i32 = 7;


  @optional text: string = "default";
  tail: i32 = 0;
}


@json
class Owner {
  child: Defaults | null = null;
  rows: Defaults[] = [];
}

export function verifyDefaults(): i32 {
  const out = JSON.parse<Owner>('{"child":{"tail":1},"rows":[{"tail":2}]}');
  if (
    out.child === null ||
    out.child!.value != 7 ||
    out.child!.text != "default"
  )
    return 1;
  if (
    out.rows.length != 1 ||
    out.rows[0].value != 7 ||
    out.rows[0].text != "default"
  )
    return 2;
  out.child!.value = 99;
  out.rows[0].value = 99;
  JSON.parse<Owner>('{"child":{"tail":3},"rows":[{"tail":4}]}', out);
  if (out.child!.value != 7 || out.rows[0].value != 7) return 3;
  JSON.parse<Owner>(
    '{"rows":[{"text":"new","value":9,"tail":6}],"child":null}',
    out,
  );
  if (out.child !== null || out.rows[0].value != 9 || out.rows[0].text != "new")
    return 4;
  const spaces = [" ", "  ", "\t", "\n\t "];
  for (let i = 0; i < spaces.length; i++) {
    const gap = spaces[i];
    const next = JSON.parse<Defaults>(
      '{"value":' + gap + '9,"text":' + gap + '"new","tail":' + gap + "6}",
    );
    if (next.value != 9 || next.text != "new" || next.tail != 6) return 5 + i;
  }

  return 0;
}


@json
class Storage {

  @optional value: i32 = 7;


  @optional items: i32[] = [];


  @optional tail: i32 = 8;
}

const seededItems: i32[] = [1, 2];


@json
class Seeded {
  items: i32[] = seededItems;
}


@json
class SeededParent {
  child: Seeded | null = null;
}

export function verifyStorage(): i32 {
  const inputs = [
    '{ "items": [4,5], "tail": 2 }',
    '{"items":[4,5], "tail":2}',
    '{"value":9, "items":[4,5],"tail":2}',
  ];
  for (let i = 0; i < inputs.length; i++) {
    const out = JSON.parse<Storage>('{"value":99,"items":[1,2],"tail":88}');
    const items = out.items;
    JSON.parse<Storage>(inputs[i], out);
    if (out.items !== items || out.items[0] != 4 || out.tail != 2) return 1 + i;
    if (out.value != (i == 2 ? 9 : 7)) return 4 + i;
  }
  const seeded = JSON.parse<SeededParent>(
    '{"child":{"items":[7,8]}}',
    new SeededParent(),
  );
  if (seeded.child!.items !== seededItems || seededItems[0] != 7) return 7;
  return 0;
}


@json
class WideDefaults {

  @optional f0: i32 = 0;


  @optional f1: i32 = 1;


  @optional f2: i32 = 2;


  @optional f3: i32 = 3;


  @optional f4: i32 = 4;


  @optional f5: i32 = 5;


  @optional f6: i32 = 6;


  @optional f7: i32 = 7;


  @optional f8: i32 = 8;


  @optional f9: i32 = 9;


  @optional f10: i32 = 10;


  @optional f11: i32 = 11;


  @optional f12: i32 = 12;


  @optional f13: i32 = 13;


  @optional f14: i32 = 14;


  @optional f15: i32 = 15;


  @optional f16: i32 = 16;


  @optional f17: i32 = 17;


  @optional f18: i32 = 18;


  @optional f19: i32 = 19;


  @optional f20: i32 = 20;


  @optional f21: i32 = 21;


  @optional f22: i32 = 22;


  @optional f23: i32 = 23;


  @optional f24: i32 = 24;


  @optional f25: i32 = 25;


  @optional f26: i32 = 26;


  @optional f27: i32 = 27;


  @optional f28: i32 = 28;


  @optional f29: i32 = 29;


  @optional f30: i32 = 30;


  @optional f31: i32 = 31;


  @optional f32: i32 = 32;


  @optional f33: i32 = 33;


  @optional f34: i32 = 34;


  @optional f35: i32 = 35;


  @optional f36: i32 = 36;


  @optional f37: i32 = 37;


  @optional f38: i32 = 38;


  @optional f39: i32 = 39;


  @optional f40: i32 = 40;


  @optional f41: i32 = 41;


  @optional f42: i32 = 42;


  @optional f43: i32 = 43;


  @optional f44: i32 = 44;


  @optional f45: i32 = 45;


  @optional f46: i32 = 46;


  @optional f47: i32 = 47;


  @optional f48: i32 = 48;


  @optional f49: i32 = 49;


  @optional f50: i32 = 50;


  @optional f51: i32 = 51;


  @optional f52: i32 = 52;


  @optional f53: i32 = 53;


  @optional f54: i32 = 54;


  @optional f55: i32 = 55;


  @optional f56: i32 = 56;


  @optional f57: i32 = 57;


  @optional f58: i32 = 58;


  @optional f59: i32 = 59;


  @optional f60: i32 = 60;


  @optional f61: i32 = 61;


  @optional f62: i32 = 62;


  @optional f63: i32 = 63;


  @optional f64: i32 = 64;
}

export function verifyWideDefaults(): i32 {
  const out = JSON.parse<WideDefaults>('{"f63":99,"f64":999}');
  JSON.parse<WideDefaults>('{ "f0": 7 }', out);
  if (out.f0 != 7 || out.f63 != 63 || out.f64 != 64) return 1;
  JSON.parse<WideDefaults>('{"f64":128}', out);
  return out.f0 == 0 && out.f63 == 63 && out.f64 == 128 ? 0 : 2;
}

export function verifyRetained(): i32 {
  const owners: Owner[] = [];
  for (let i = 0; i < 64; i++) {
    owners.push(
      JSON.parse<Owner>(
        '{"child":{"value":' +
          i.toString() +
          ',"text":"owned","tail":1},"rows":[{"value":' +
          i.toString() +
          ',"text":"row","tail":2}]}',
      ),
    );
  }
  __collect();
  for (let i = 0; i < owners.length; i++) {
    if (
      owners[i].child === null ||
      owners[i].child!.value != i ||
      owners[i].child!.text != "owned"
    )
      return 1;
    if (
      owners[i].rows.length != 1 ||
      owners[i].rows[0].value != i ||
      owners[i].rows[0].text != "row"
    )
      return 2;
  }
  return 0;
}
