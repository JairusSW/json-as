import { JSON } from "./";


@json
class Token {
  uid: u32 = 256;
  token: string = "dewf32df@#G43g3Gs!@3sdfDS#2";
}

const tok = new Token();
const serialized = JSON.stringify(tok);
console.log("Serialized:   " + serialized);
const deserialized = JSON.parse<Token>(serialized);
console.log("Deserialized: " + JSON.stringify(deserialized));
