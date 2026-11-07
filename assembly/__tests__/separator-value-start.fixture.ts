import { JSON } from "../index";

let shortcuts: i32 = 0;
let commas: i32 = 0;
let decodes: i32 = 0;

function recordSeparatorShortcut(): void {
  shortcuts++;
}

function recordCommaShortcut(): void {
  commas++;
}

export function commaCount(): i32 {
  return commas;
}

export function shortcutCount(): i32 {
  return shortcuts;
}

@json
class Row {
  value!: i64;
  values!: i64[];
}

namespace Model {
  @json
  export class Coordinates {
    ä!: i64;
    日本!: i64;
    z!: i64;
  }
}

@json
class Token {
  value!: i64;

  @deserializer("number")
  decode(source: string): Token {
    decodes++;
    const out = new Token();
    out.value = i64.parse(source);
    return out;
  }
}

@json
class Mixed {
  token!: Token;
  text!: string;
  raw!: JSON.Raw | null;
  flag!: bool;
}

export function verify(): i32 {
  const cases = [
    '{"value":7,"values":[]}',
    '{\n "value" \t : 7, "values" : [ ] }',
    '{ "values":[1,2], "value":7 }',
    '{ "value": 7, "values": [] }',
    '{ "value": \n\t 7, "values":  \n [1,2] }',
    '{ "value":7 \n\t , "values":[] }',
  ];
  for (let i = 0; i < cases.length; i++) {
    const expected = i == 2 || i == 4 ? 2 : 0;
    const fresh = JSON.parse<Row>(cases[i]);
    assert(fresh.value == 7 && fresh.values.length == expected);
    const out = JSON.parse<Row>('{"value":99,"values":[8]}');
    JSON.parse<Row>(cases[i], out);
    assert(out.value == 7 && out.values.length == expected);
  }

  const point = JSON.parse<Model.Coordinates>(
    '{ "ä": 9007199254740993, "日本": -7, "z": 9 }',
  );
  assert(point.ä == 9007199254740993 && point.日本 == -7 && point.z == 9);
  assert(
    JSON.stringify(point) == '{"ä":9007199254740993,"日本":-7,"z":9}',
  );

  const mixedCases = [
    '{ "token": 7, "text": "quoted\\\"text", "raw": null, "flag": true }',
    '{ "token": \n\t 7, "text":  "quoted\\\"text", "raw": \r\n null, "flag": \t true }',
  ];
  for (let i = 0; i < mixedCases.length; i++) {
    decodes = 0;
    const fresh = JSON.parse<Mixed>(mixedCases[i]);
    assert(decodes == 1 && fresh.token.value == 7);
    assert(fresh.text == 'quoted"text' && fresh.raw === null && fresh.flag);

    const out = JSON.parse<Mixed>(
      '{"token":9,"text":"old","raw":[1],"flag":false}',
    );
    decodes = 0;
    JSON.parse<Mixed>(mixedCases[i], out);
    assert(decodes == 1 && out.token.value == 7);
    assert(out.text == 'quoted"text' && out.raw === null && out.flag);
  }
  return 1;
}
