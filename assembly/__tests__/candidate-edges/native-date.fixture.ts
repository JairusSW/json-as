import { JSON } from "../../index";
import { Date as ModelDate } from "./date.fixture";

@json
class Both {
  native: Date = new Date(0);
  model: ModelDate = new ModelDate();
}
export function run(): string {
  const out = JSON.parse<Both>(
    '{"native":"1970-01-02T00:00:00.000Z","model":{"value":7}}',
  );
  return out.native.getTime().toString() + ":" + out.model.value.toString();
}
