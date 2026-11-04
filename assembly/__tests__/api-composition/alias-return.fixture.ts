import { JSON } from "../..";
type Text = string;


@json class Token {
  value: i32 = 7;


  @serializer("number") encode(self: Token): Text {
    return self.value.toString();
  }
}
export function run(): string {
  return JSON.stringify(new Token());
}
