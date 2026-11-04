import { JSON } from "../..";
type Text = string;


@json class Token {
  value: i32 = 7;


  @deserializer("number") decode(source: Text): Token {
    return new Token();
  }
}
export function run(): string {
  return JSON.parse<Token>("7").value.toString();
}
