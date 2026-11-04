import { JSON as Json } from "json-as";
const JSON: i32 = 3;

@json class Row {

  @omitif("JSON == 4") value: i32 = 7;
}
export function run(): string {
  return Json.stringify(new Row());
}
