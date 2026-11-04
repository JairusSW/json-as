import { JSON } from "../..";
import { PublicToken as Token, make } from "./codec-model.fixture";

@json class Owner {
  value: Token = make();
}
export function run(reuse: bool): string {
  assert(JSON.stringify(JSON.parse<Token>("7")) == "7");
  return JSON.stringify(
    JSON.parse<Owner>(
      '{"value":7}',
      reuse ? new Owner() : changetype<Owner>(0),
    ),
  );
}
