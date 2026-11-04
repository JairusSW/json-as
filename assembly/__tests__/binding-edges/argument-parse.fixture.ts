import { JSON } from "../..";
type Identity<T> = T;
namespace M {
  type Item = f32;

  @json export class Row {
    value: Identity<Item> = 1.5;
  }
}
export function run(): string {
  return JSON.stringify(JSON.parse<M.Row>('{"value":2.5}'));
}
