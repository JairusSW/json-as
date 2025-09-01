import {
  bs
} from "../lib/as-bs";
import {
  JSON
} from ".";
import {
  Type2
} from "./foo";
@json
class TypeAlias {
  baz: Type2 = "b";
  __SERIALIZE(ptr: usize): void {
    bs.proposeSize(16);
    store<u64>(bs.offset, 27303493649956987, 0);
    store<u32>(bs.offset, 2228346, 8);
    store<u16>(bs.offset, 58, 12);
    bs.offset += 14;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("baz")));
    store<u16>(bs.offset, 125, 0);
    bs.offset += 2;
  }
  @inline
  __INITIALIZE(): this {
    store<string>(changetype<usize>(this), "b", offsetof<this>("baz"));
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
;
    if (load<u16>(srcStart) != 123) throw new Error("Expected '{' at start of object at position " + (srcEnd - srcStart).toString());
;
    if (load<u16>(srcEnd - 2) != 125) throw new Error("Expected '}' at end of object at position " + (srcEnd - srcStart).toString());
;
    srcStart += 2;
    while (srcStart < srcEnd) {
      let code = load<u16>(srcStart);
      while (JSON.Util.isSpace(code)) code = load<u16>(srcStart += 2);
      if (keyStart == 0) {
        if (code == 34 && load<u16>(srcStart - 2) !== 92) {
          if (isKey) {
            keyStart = lastIndex;
            keyEnd = srcStart;
            while (JSON.Util.isSpace((code = load<u16>((srcStart += 2))))) {}
            if (code !== 58) throw new Error("Expected ':' after key at position " + (srcEnd - srcStart).toString());
;
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
              switch (<u32>keyEnd - <u32>keyStart) {
                case 6:
                  {
                    const code48 = load<u64>(keyStart) & 281474976710655;
                    if (code48 == 523992367202) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("baz"));
                      srcStart += 4;
                      keyStart = 0;
                      break;
                    } else {
                      srcStart += 4;
                      keyStart = 0;
                      break;
                    }
                  }

                default:
                  {
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
              srcStart += 2;
              keyStart = 0;
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
                switch (<u32>keyEnd - <u32>keyStart) {
                  case 6:
                    {
                      const code48 = load<u64>(keyStart) & 281474976710655;
                      if (code48 == 523992367202) {
                        store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("baz"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  default:
                    {
                      keyStart = 0;
                      break;
                    }

}
                break;
              }
            } else if (code == 123) depth++;
;
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
                keyStart = 0;
                break;
              }
            } else if (code == 91) depth++;
;
            srcStart += 2;
          }
        } else if (code == 116) {
          if (load<u64>(srcStart) == 28429475166421108) {
            srcStart += 8;
            srcStart += 2;
            keyStart = 0;
          } else {
            throw new Error("Expected to find 'true' but found '" + JSON.Util.ptrToStr(lastIndex, srcStart) + "' instead at position " + (srcEnd - srcStart).toString());
          }
        } else if (code == 102) {
          if (load<u64>(srcStart, 2) == 28429466576093281) {
            srcStart += 10;
            srcStart += 2;
            keyStart = 0;
          } else {
            throw new Error("Expected to find 'false' but found '" + JSON.Util.ptrToStr(lastIndex, srcStart) + "' instead at position " + (srcEnd - srcStart).toString());
          }
        } else if (code == 110) {
          if (load<u64>(srcStart) == 30399761348886638) {
            srcStart += 8;
            srcStart += 2;
            keyStart = 0;
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
console.log(JSON.stringify(new TypeAlias()));
