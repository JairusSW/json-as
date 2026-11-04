import { JSON } from "../..";
import { Forward } from "./forward-model.fixture";

@json class Token {
  value: i32 = 7;

  @serializer("number") encode(self: Forward<Token>): string {
    return self.value.toString();
  }

  @deserializer("number") decode(_s: string): Forward<Token> {
    return new Token();
  }
}
export function run(): string {
  return JSON.stringify(JSON.parse<Token>("7"));
}
