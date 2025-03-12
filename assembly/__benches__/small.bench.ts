import { JSON } from "..";
import { bench } from "../custom/bench";


@json
class SmallJSON {
  public id!: i32;
  public name!: string;
  public active!: boolean;
}

const v1: SmallJSON = {
  id: 1,
  name: "Small Object",
  active: true,
};
const v2 = '{"id":1,"name":"Small Object","active":true}';

bench(
  "Serialize Small Object",
  () => {
    JSON.stringify(v1);
  },
  16_000_00,
);

bench(
  "Deserialize Small Object",
  () => {
    JSON.parse<SmallJSON>(v2);
  },
  16_000_00,
);
