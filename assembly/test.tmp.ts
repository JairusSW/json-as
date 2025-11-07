import {
  bs
} from "../lib/as-bs";
import {
  JSON
} from ".";
@json
class Example {
  constructor(public a: string, public b: string, public c: string, public d: string, public e: boolean) {}
  __SERIALIZE(ptr: usize): void {
    bs.proposeSize(62);
    store<u64>(bs.offset, 9570565822218363, 0);
    store<u16>(bs.offset, 58, 8);
    bs.offset += 10;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("a")));
    store<u64>(bs.offset, 9570570117185580, 0);
    store<u16>(bs.offset, 58, 8);
    bs.offset += 10;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("b")));
    store<u64>(bs.offset, 9570574412152876, 0);
    store<u16>(bs.offset, 58, 8);
    bs.offset += 10;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("c")));
    store<u64>(bs.offset, 9570578707120172, 0);
    store<u16>(bs.offset, 58, 8);
    bs.offset += 10;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("d")));
    store<u64>(bs.offset, 9570583002087468, 0);
    store<u16>(bs.offset, 58, 8);
    bs.offset += 10;
    JSON.__serialize<boolean>(load<boolean>(ptr, offsetof<this>("e")));
    store<u16>(bs.offset, 125, 0);
    bs.offset += 2;
  }
  @inline
  __INITIALIZE(): this {
    store<string>(changetype<usize>(this), "", offsetof<this>("a"));
    store<string>(changetype<usize>(this), "", offsetof<this>("b"));
    store<string>(changetype<usize>(this), "", offsetof<this>("c"));
    store<string>(changetype<usize>(this), "", offsetof<this>("d"));
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
            console.log("Key: " + JSON.Util.ptrToStr(keyStart, keyEnd));
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
              console.log("Value (string, 1): " + JSON.Util.ptrToStr(lastIndex, srcStart + 2));
              switch (<u32>keyEnd - <u32>keyStart) {
                case 2:
                  {
                    const code16 = load<u16>(keyStart);
                    if (code16 == 97) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("a"));
                      srcStart += 4;
                      keyStart = 0;
                      break;
                    } else if (code16 == 98) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("b"));
                      srcStart += 4;
                      keyStart = 0;
                      break;
                    } else if (code16 == 99) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("c"));
                      srcStart += 4;
                      keyStart = 0;
                      break;
                    } else if (code16 == 100) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("d"));
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
              console.log("Value (number, 2): " + JSON.Util.ptrToStr(lastIndex, srcStart));
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
                console.log("Value (object, 3): " + JSON.Util.ptrToStr(lastIndex, srcStart));
                switch (<u32>keyEnd - <u32>keyStart) {
                  case 2:
                    {
                      const code16 = load<u16>(keyStart);
                      if (code16 == 97) {
                        store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("a"));
                        keyStart = 0;
                        break;
                      } else if (code16 == 98) {
                        store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("b"));
                        keyStart = 0;
                        break;
                      } else if (code16 == 99) {
                        store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("c"));
                        keyStart = 0;
                        break;
                      } else if (code16 == 100) {
                        store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("d"));
                        keyStart = 0;
                        break;
                      } else if (code16 == 101) {
                        store<boolean>(changetype<usize>(out), JSON.__deserialize<boolean>(lastIndex, srcStart), offsetof<this>("e"));
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
                console.log("Value (object, 4): " + JSON.Util.ptrToStr(lastIndex, srcStart));
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
            console.log("Value (bool, 5): " + JSON.Util.ptrToStr(lastIndex, srcStart - 8));
            switch (<u32>keyEnd - <u32>keyStart) {
              case 2:
                {
                  const code16 = load<u16>(keyStart);
                  if (code16 == 101) {
                    store<boolean>(changetype<usize>(out), true, offsetof<this>("e"));
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  } else {
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  }
                }

              default:
                {
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
            console.log("Value (bool, 6): " + JSON.Util.ptrToStr(lastIndex, srcStart - 10));
            switch (<u32>keyEnd - <u32>keyStart) {
              case 2:
                {
                  const code16 = load<u16>(keyStart);
                  if (code16 == 101) {
                    store<boolean>(changetype<usize>(out), false, offsetof<this>("e"));
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  } else {
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  }
                }

              default:
                {
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
            console.log("Value (null, 7): " + JSON.Util.ptrToStr(lastIndex, srcStart - 8));
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
const good = `{"a":"a","b":"b","e":true,"c":"c","d":"d"}`;
const good2 = `{"a":"a","b":"b","c":"c","d":"d","e":false}`;
const bad = `{"a":"a","b":"b","e":false,"c":"c","d":"d"}`;
const parsedGood = JSON.parse<Example>(good);
console.log("a: " + JSON.stringify(parsedGood));
const parsedGood2 = JSON.parse<Example>(good2);
console.log("b: " + JSON.stringify(parsedGood2));
const parsedBad = JSON.parse<Example>(bad);
console.log("c: " + JSON.stringify(parsedBad));
console.log(load<u64>(changetype<usize>("alse")).toString());
