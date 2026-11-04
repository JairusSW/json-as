import { JSON } from "../..";
type Inner = JSON.Lazy<i32>;
type Identity<T> = T;
namespace Model {
  type Inner = JSON.Lazy<f32>;

  @json export class Row {
    value: Identity<Inner> = 0;
  }
}
function kind<T>(value: T): string {
  return isFloat<T>() ? "float" : "integer";
}
export function run(): string {
  const type = kind(new Model.Row().value);
  return type + ":" + JSON.parse<Model.Row>('{"value":1.5}').value.toString();
}
