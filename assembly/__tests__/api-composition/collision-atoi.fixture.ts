import { JSON } from "../..";
function atoi(value: string): i32 {
  return value.length;
}


@json class Row {
  value: i32 = atoi("seven77");
}
export function run(): string {
  return JSON.stringify(JSON.parse<Row>("{}"));
}
