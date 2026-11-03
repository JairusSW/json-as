import { JSON } from "..";


@json export class Token {
  text: string = "default";


  @deserializer("string") decode(source: string): Token {
    const v = new Token();
    v.text = JSON.parse<string>(source);
    return v;
  }
}
