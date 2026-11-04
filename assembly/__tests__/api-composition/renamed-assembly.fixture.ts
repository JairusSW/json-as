import { JSON as Json } from "json-as/assembly";


@json class Row {
  value: i32 = 0;
}
export function run(): string {
  return Json.stringify(Json.parse<Row>('{"value":7}'));
}
