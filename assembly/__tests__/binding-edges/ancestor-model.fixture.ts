import { JSON } from "../..";
function text(): string {
  return "seed";
}
function omitted(_self: Base): bool {
  return true;
}

@json export class Base {

  @alias("wire") value: JSON.Lazy<string> = text();

  @omitif(omitted) ignored: i32 = 7;
}
export class Middle extends Base {
  middle: i32 = 3;
}
