import { bs } from "../lib/as-bs";
import { JSON } from ".";

@json
class GenericEnum<T> {
  private tag: string = "";
  private value: T | null = null;
  constructor() {
    this.tag = "";
    this.value = null;
  }
  static create<T>(tag: string, value: T): GenericEnum<T> {
    const item = new GenericEnum<T>();
    item.tag = tag;
    item.value = value;
    return item;
  }
  getTag(): string {
    return this.tag;
  }
  getValue(): T | null {
    return this.value;
  }

  @serializer
  @inline
  serialize<T>(self: GenericEnum<T>): string {
    const tagJson = JSON.internal.stringify(self.tag);
    const valueJson = JSON.internal.stringify(self.value);
    return `{${tagJson}:${valueJson}}`;
  }

  @deserializer
  @inline
  deserialize(data: string): GenericEnum<T> {
    const parsed = JSON.parse<Map<string, JSON.Raw>>(data);
    const result = new GenericEnum<T>();
    const keys = parsed.keys();
    const values = parsed.values();
    result.tag = keys[0];
    result.value = JSON.parse<T>(values[0].data);
    return result;
  }
  __SERIALIZE(ptr: usize): void {
    const data = this.serialize(this);
    bs.resetState();
    const dataSize = data.length << 1;
    memory.copy(bs.offset, changetype<usize>(data), dataSize);
    bs.offset += dataSize;
  }

  @inline
  __INITIALIZE(): this {
    this.tag = "";
    this.value = null;
    return this;
  }
  __DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): __JSON_T {
    return inline.always(this.deserialize(JSON.Util.ptrToStr(srcStart, srcEnd)));
  }
}

@json
class Node<T> {
  name: string;
  id: u32;
  data: T;
  constructor() {
    this.name = "";
    this.id = 0;
    this.data = changetype<T>(0);
  }
  __SERIALIZE(ptr: usize): void {
    bs.proposeSize(66);
    store<u64>(bs.offset, 27303545189564539, 0);
    store<u64>(bs.offset, 16325694684725357, 8);
    bs.offset += 16;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("name")));
    store<u64>(bs.offset, 28147948644859948, 0);
    store<u32>(bs.offset, 3801122, 8);
    bs.offset += 12;
    JSON.__serialize<u32>(load<u32>(ptr, offsetof<this>("id")));
    store<u64>(bs.offset, 27303502239891500, 0);
    store<u64>(bs.offset, 16325694684463220, 8);
    bs.offset += 16;
    JSON.__serialize<T>(load<T>(ptr, offsetof<this>("data")));
    store<u16>(bs.offset, 125, 0);
    bs.offset += 2;
  }

  @inline
  __INITIALIZE(): this {
    this.name = "";
    return this;
  }
  __DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): __JSON_T {
    let keyStart: usize = 0;
    let keyEnd: usize = 0;
    let isKey = false;
    let depth: i32 = 0;
    let lastIndex: usize = 0;
    while (srcStart < srcEnd && JSON.Util.isSpace(load<u16>(srcStart))) srcStart += 2;
    while (srcEnd > srcStart && JSON.Util.isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;
    if (srcStart - srcEnd == 0) throw new Error("Input string had zero length or was all whitespace");
    if (load<u16>(srcStart) != 123) throw new Error("Expected '{' at start of object at position " + (srcEnd - srcStart).toString());
    if (load<u16>(srcEnd - 2) != 125) throw new Error("Expected '}' at end of object at position " + (srcEnd - srcStart).toString());
    srcStart += 2;
    while (srcStart < srcEnd) {
      let code = load<u16>(srcStart);
      while (JSON.Util.isSpace(code)) code = load<u16>((srcStart += 2));
      if (keyStart == 0) {
        if (code == 34 && load<u16>(srcStart - 2) !== 92) {
          if (isKey) {
            keyStart = lastIndex;
            keyEnd = srcStart;
            console.log("Key: " + JSON.Util.ptrToStr(keyStart, keyEnd));
            while (JSON.Util.isSpace((code = load<u16>((srcStart += 2))))) {}
            if (code !== 58) throw new Error("Expected ':' after key at position " + (srcEnd - srcStart).toString());
            isKey = false;
          } else {
            isKey = true;
            lastIndex = srcStart + 2;
          }
        }
        srcStart += 2;
      } else {
        if (code == 34) {
          lastIndex = srcStart;
          srcStart += 2;
          while (srcStart < srcEnd) {
            const code = load<u16>(srcStart);
            if (code == 34 && load<u16>(srcStart - 2) !== 92) {
              console.log("Value (string, 8): " + JSON.Util.ptrToStr(lastIndex, srcStart + 2));
              switch (<u32>keyEnd - <u32>keyStart) {
                case 8: {
                  const code64 = load<u64>(keyStart);
                  if (code64 == 28429440805568622) {
                    store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("name"));
                    srcStart += 4;
                    keyStart = 0;
                    break;
                  } else if (isString<T>() && code64 == 27303570963497060) {
                    store<T>(changetype<usize>(out), JSON.__deserialize<T>(lastIndex, srcStart + 2), offsetof<this>("data"));
                    srcStart += 4;
                    keyStart = 0;
                    break;
                  } else {
                    srcStart += 4;
                    keyStart = 0;
                    break;
                  }
                }

                default: {
                  srcStart += 4;
                  keyStart = 0;
                  break;
                }
              }
              break;
            }
            srcStart += 2;
          }
        } else if (code - 48 <= 9 || code == 45) {
          lastIndex = srcStart;
          srcStart += 2;
          while (srcStart < srcEnd) {
            const code = load<u16>(srcStart);
            if (code == 44 || code == 125 || JSON.Util.isSpace(code)) {
              console.log("Value (number, 9): " + JSON.Util.ptrToStr(lastIndex, srcStart));
              switch (<u32>keyEnd - <u32>keyStart) {
                case 4: {
                  const code32 = load<u32>(keyStart);
                  if (code32 == 6553705) {
                    store<u32>(changetype<usize>(out), JSON.__deserialize<u32>(lastIndex, srcStart), offsetof<this>("id"));
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  } else {
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  }
                }

                case 8: {
                  const code64 = load<u64>(keyStart);
                  if ((isInteger<T>() || isFloat<T>()) && code64 == 27303570963497060) {
                    store<T>(changetype<usize>(out), JSON.__deserialize<T>(lastIndex, srcStart), offsetof<this>("data"));
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  } else {
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  }
                }

                default: {
                  srcStart += 2;
                  keyStart = 0;
                  break;
                }
              }
              break;
            }
            srcStart += 2;
          }
        } else if (code == 123) {
          lastIndex = srcStart;
          depth++;
          srcStart += 2;
          while (srcStart < srcEnd) {
            const code = load<u16>(srcStart);
            if (code == 34) {
              srcStart += 2;
              while (!(load<u16>(srcStart) == 34 && load<u16>(srcStart - 2) != 92)) srcStart += 2;
            } else if (code == 125) {
              if (--depth == 0) {
                srcStart += 2;
                console.log("Value (object, 10): " + JSON.Util.ptrToStr(lastIndex, srcStart));
                switch (<u32>keyEnd - <u32>keyStart) {
                  case 8: {
                    const code64 = load<u64>(keyStart);
                    if (isDefined(out.__DESERIALIZE) && code64 == 27303570963497060) {
                      store<T>(changetype<usize>(out), JSON.__deserialize<T>(lastIndex, srcStart), offsetof<this>("data"));
                      keyStart = 0;
                      break;
                    } else {
                      keyStart = 0;
                      break;
                    }
                  }

                  default: {
                    keyStart = 0;
                    break;
                  }
                }
                break;
              }
            } else if (code == 123) depth++;
            srcStart += 2;
          }
        } else if (code == 91) {
          lastIndex = srcStart;
          depth++;
          srcStart += 2;
          while (srcStart < srcEnd) {
            const code = load<u16>(srcStart);
            if (code == 34) {
              srcStart += 2;
              while (!(load<u16>(srcStart) == 34 && load<u16>(srcStart - 2) != 92)) srcStart += 2;
            } else if (code == 93) {
              if (--depth == 0) {
                srcStart += 2;
                console.log("Value (object, 11): " + JSON.Util.ptrToStr(lastIndex, srcStart));
                switch (<u32>keyEnd - <u32>keyStart) {
                  case 8: {
                    const code64 = load<u64>(keyStart);
                    if (isArray<T>() && code64 == 27303570963497060) {
                      store<T>(changetype<usize>(out), JSON.__deserialize<T>(lastIndex, srcStart), offsetof<this>("data"));
                      keyStart = 0;
                      break;
                    } else {
                      keyStart = 0;
                      break;
                    }
                  }

                  default: {
                    keyStart = 0;
                    break;
                  }
                }
                break;
              }
            } else if (code == 91) depth++;
            srcStart += 2;
          }
        } else if (code == 116) {
          if (load<u64>(srcStart) == 28429475166421108) {
            srcStart += 8;
            console.log("Value (bool, 12): " + JSON.Util.ptrToStr(lastIndex, srcStart - 8));
            switch (<u32>keyEnd - <u32>keyStart) {
              case 8: {
                const code64 = load<u64>(keyStart);
                if (isBoolean<T>() && code64 == 27303570963497060) {
                  store<boolean>(changetype<usize>(out), true, offsetof<this>("data"));
                  srcStart += 2;
                  keyStart = 0;
                  break;
                } else {
                  srcStart += 2;
                  keyStart = 0;
                  break;
                }
              }

              default: {
                srcStart += 2;
                keyStart = 0;
              }
            }
          } else {
            throw new Error("Expected to find 'true' but found '" + JSON.Util.ptrToStr(lastIndex, srcStart) + "' instead at position " + (srcEnd - srcStart).toString());
          }
        } else if (code == 102) {
          if (load<u64>(srcStart, 2) == 28429466576093281) {
            srcStart += 10;
            console.log("Value (bool, 13): " + JSON.Util.ptrToStr(lastIndex, srcStart - 10));
            switch (<u32>keyEnd - <u32>keyStart) {
              case 8: {
                const code64 = load<u64>(keyStart);
                if (isBoolean<T>() && code64 == 27303570963497060) {
                  store<boolean>(changetype<usize>(out), false, offsetof<this>("data"));
                  srcStart += 2;
                  keyStart = 0;
                  break;
                } else {
                  srcStart += 2;
                  keyStart = 0;
                  break;
                }
              }

              default: {
                srcStart += 2;
                keyStart = 0;
              }
            }
          } else {
            throw new Error("Expected to find 'false' but found '" + JSON.Util.ptrToStr(lastIndex, srcStart) + "' instead at position " + (srcEnd - srcStart).toString());
          }
        } else if (code == 110) {
          if (load<u64>(srcStart) == 30399761348886638) {
            srcStart += 8;
            console.log("Value (null, 14): " + JSON.Util.ptrToStr(lastIndex, srcStart - 8));
            switch (<u32>keyEnd - <u32>keyStart) {
              case 8: {
                const code64 = load<u64>(keyStart);
                if (isNullable<T>() && code64 == 27303570963497060) {
                  store<usize>(changetype<usize>(out), 0, offsetof<this>("data"));
                  srcStart += 2;
                  keyStart = 0;
                  break;
                } else {
                  srcStart += 2;
                  keyStart = 0;
                  break;
                }
              }

              default: {
                srcStart += 2;
                keyStart = 0;
              }
            }
          }
        } else {
          srcStart += 2;
          keyStart = 0;
        }
      }
    }
    return out;
  }
}
const enumValue = GenericEnum.create<string>("success", "Hello World");
const node = new Node<GenericEnum<string>>();
node.name = "test-node";
node.id = 42;
node.data = enumValue;
const serialized = JSON.stringify(node);
console.log("Serialized Node: " + serialized);
const deserialized = JSON.parse<Node<GenericEnum<string>>>(serialized);
console.log("Deserialized Node: " + JSON.stringify(deserialized));
