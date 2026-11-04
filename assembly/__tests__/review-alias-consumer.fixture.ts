import { JSON } from "..";
import {
  PublicLazy,
  PublicAlias,
  make,
  makeGeneric,
} from "./review-alias-model.fixture";

@json class LazyOwner {
  child: PublicLazy = make();
}

@json class GenericOwner {
  child: PublicAlias = makeGeneric();
}
export function lazy(): string {
  return JSON.stringify(new LazyOwner());
}
export function generic(): string {
  return JSON.stringify(JSON.parse<GenericOwner>('{"child":{"value":11}}'));
}
export function parsedLazy(): string {
  return JSON.stringify(JSON.parse<LazyOwner>('{"child":{"value":13}}'));
}
export function accessedLazy(): i32 {
  return JSON.parse<LazyOwner>('{"child":{"value":13}}').child.value;
}
