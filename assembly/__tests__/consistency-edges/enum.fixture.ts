import { JSON } from "../..";
import { PublicState as State, make } from "./enum-model.fixture";

@json class Owner {
  value: State = make();
}
export function run(reuse: bool): string {
  return JSON.stringify(
    JSON.parse<Owner>(
      '{"value":1}',
      reuse ? new Owner() : changetype<Owner>(0),
    ),
  );
}
