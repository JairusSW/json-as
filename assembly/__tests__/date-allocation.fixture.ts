import { JSON } from "..";
let source = '"2000-02-29T12:34:56.789Z"';
let value = new Date(0);
export function run(reuse: bool): void {
  value = JSON.parse<Date>(source, reuse ? value : changetype<Date>(0));
}
export function time(): i64 {
  return value.getTime();
}
