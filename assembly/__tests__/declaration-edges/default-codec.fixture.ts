import { JSON } from "../../index";
import Point from "./default-codec-model.fixture";
export function run(): string {
  return JSON.stringify(new Point());
}
