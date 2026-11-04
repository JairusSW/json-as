import { JSON } from "../..";
type Item = JSON.Lazy<i32>;

@json class Row<Item> {
  value!: Item;
}
function kind<T>(value: T): string {
  return isFloat<T>() ? "float" : "integer";
}
export function run(): string {
  const row = JSON.parse<Row<f32>>('{"value":1.5}');
  return kind(row.value) + ":" + row.value.toString();
}
