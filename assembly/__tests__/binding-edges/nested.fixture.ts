import { JSON } from "../..";
type Identity<T> = T;

@json class Token {
  value: i32 = 7;

  @serializer("number") encode(self: Identity<Identity<Token>>): string {
    return self.value.toString();
  }

  @deserializer("number") decode(_s: string): Identity<Identity<Token>> {
    return new Token();
  }
}
export function run(): string {
  return JSON.stringify(JSON.parse<Token>("7"));
}
