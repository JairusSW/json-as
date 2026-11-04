import { JSON } from "../..";
type Identity<T> = T;
let calls: i32 = 0;

@json class Token {
  value: i32 = 0;

  @deserializer("number") decode(data: string): Token {
    calls++;
    const out = new Token();
    out.value = <i32>parseInt(data);
    return out;
  }
}
namespace Model {
  type Deferred = JSON.Lazy<Token>;

  @json export class Row {
    value!: Identity<Deferred>;
  }
}
export function run(): string {
  const row = JSON.parse<Model.Row>('{"value":7}');
  const before = calls;
  const value = row.value.value;
  return before.toString() + ":" + value.toString() + ":" + calls.toString();
}
