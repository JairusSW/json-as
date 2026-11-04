import { JSON } from "../..";
import { RemoteSelf } from "./return-alias.fixture";
type Self = RemoteSelf;

@json export class Token {
  value: i32 = 7;

  @deserializer("number") decode(_source: string): Self {
    return new Token();
  }
}
export function run(): string {
  return JSON.stringify(JSON.parse<Token>("7"));
}
