import { JSON } from "../..";
namespace Model {
  const bs: i32 = 7;
  function atoi(value: string): i32 {
    return value.length;
  }


  @json export class Row {
    value: i32 = bs + atoi("x");
  }
}
export function run(): string {
  return JSON.stringify(JSON.parse<Model.Row>("{}"));
}
