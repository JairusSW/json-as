interface GeneratedInterface {
  __SERIALIZE(ptr: usize): string;
}

export function serializeStruct<T extends GeneratedInterface>(data: T): void {
  changetype<nonnull<T>>(data).__SERIALIZE(changetype<usize>(data));
}
