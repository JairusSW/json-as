import { JSON } from "..";


@json class HiddenAliasModel {
  value: i32 = 0;
}
export type PublicAlias = HiddenAliasModel;
export function makePublicAlias(): PublicAlias {
  return new HiddenAliasModel();
}
