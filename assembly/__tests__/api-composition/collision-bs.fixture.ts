import { JSON } from "../..";
const bs: i32 = 7;
const __json_bs_0: i32 = 2;


@json class Row {
  value: i32 = bs + __json_bs_0;
}
export function run(): string {
  return JSON.stringify(JSON.parse<Row>("{}"));
}
