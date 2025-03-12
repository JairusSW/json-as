import { bench } from "./lib/bench";

class SmallJSON {
  public id!: number;
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
    JSON.parse(v2);
  },
  16_000_00,
);
