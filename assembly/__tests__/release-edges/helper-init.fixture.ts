import { JSON as Json } from "json-as";
const JSON: i32 = 3;

@json class Child {
  value: i32 = JSON;
}

@json class Row {
  child!: Child;
  other: i32 = JSON;
}
export function run(): string {
  return Json.stringify(Json.parse<Row>("{}"));
}
