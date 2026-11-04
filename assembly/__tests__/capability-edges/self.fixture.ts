import { JSON } from "../..";
type Identity<T> = T;

@json class Token {
  value: i32 = 0;

  @deserializer("number") decode(data: string): Identity<this> {
    this.value = <i32>parseInt(data);
    return this;
  }
}
export function run(): string {
  return JSON.parse<Token>("7").value.toString();
}
