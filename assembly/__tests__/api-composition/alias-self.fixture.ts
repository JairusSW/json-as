import { JSON } from "../..";
type Self = Token;


@json class Token {
  value: i32 = 7;


  @serializer("number") encode(self: Self): string {
    return self.value.toString();
  }
}
export function run(): string {
  return JSON.stringify(new Token());
}
