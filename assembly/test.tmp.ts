import {
  bs
} from "../lib/as-bs";
const SIMD_13 = i16x8(44, 34, 97, 114, 103, 119, 34, 58);
const SIMD_12 = i16x8(44, 34, 97, 108, 105, 113, 117, 97);
const SIMD_11 = i16x8(44, 34, 109, 97, 103, 110, 97, 34);
const SIMD_10 = i16x8(44, 34, 100, 111, 108, 111, 114, 101);
const SIMD_9 = i16x8(44, 34, 108, 97, 98, 111, 114, 101);
const SIMD_8 = i16x8(44, 34, 105, 110, 99, 105, 100, 105);
const SIMD_7 = i16x8(44, 34, 116, 101, 109, 112, 111, 114);
const SIMD_6 = i16x8(44, 34, 101, 105, 117, 115, 109, 111);
const SIMD_5 = i16x8(44, 34, 101, 108, 105, 116, 34, 58);
const SIMD_4 = i16x8(44, 34, 97, 100, 105, 112, 105, 115);
const SIMD_3 = i16x8(44, 34, 99, 111, 110, 115, 101, 99);
const SIMD_2 = i16x8(44, 34, 100, 111, 108, 111, 114, 34);
const SIMD_1 = i16x8(44, 34, 105, 112, 115, 117, 109, 34);
const SIMD_0 = i16x8(123, 34, 108, 111, 114, 117, 109, 34);
import {
  JSON
} from ".";
@json
class ObjSmall {
  lorum: i32 = I32.MAX_VALUE;
  ipsum: boolean = true;
  dolor: Array<i32> = [1];
  sit: string = "abcdefghijklmnopdasfqrstfuvwYZ1234567890`~!@#$%^&*()_+=-{}][\b|;\":'<>,./?";
  __SERIALIZE(ptr: usize): void {
    bs.proposeSize(102);
    store<v128>(bs.offset, SIMD_0, 0);
    store<u16>(bs.offset, 58, 16);
    bs.offset += 18;
    JSON.__serialize<i32>(load<i32>(ptr, offsetof<this>("lorum")));
    store<v128>(bs.offset, SIMD_1, 0);
    store<u16>(bs.offset, 58, 16);
    bs.offset += 18;
    JSON.__serialize<boolean>(load<boolean>(ptr, offsetof<this>("ipsum")));
    store<v128>(bs.offset, SIMD_2, 0);
    store<u16>(bs.offset, 58, 16);
    bs.offset += 18;
    JSON.__serialize<Array<i32>>(load<Array<i32>>(ptr, offsetof<this>("dolor")));
    store<u64>(bs.offset, 29555366478086188, 0);
    store<u32>(bs.offset, 2228340, 8);
    store<u16>(bs.offset, 58, 12);
    bs.offset += 14;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("sit")));
    store<u16>(bs.offset, 125, 0);
    bs.offset += 2;
  }
  @inline
  __INITIALIZE(): this {
    store<i32>(changetype<usize>(this), I32.MAX_VALUE, offsetof<this>("lorum"));
    store<boolean>(changetype<usize>(this), true, offsetof<this>("ipsum"));
    store<Array<i32>>(changetype<usize>(this), [1], offsetof<this>("dolor"));
    store<string>(changetype<usize>(this), "abcdefghijklmnopdasfqrstfuvwYZ1234567890`~!@#$%^&*()_+=-{}][|;\":'<>,./?", offsetof<this>("sit"));
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
                case 6:
                  {
                    const code48 = load<u64>(keyStart) & 281474976710655;
                    if (code48 == 498223087731) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("sit"));
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
              switch (<u32>keyEnd - <u32>keyStart) {
                case 10:
                  {
                    const codeS8 = load<u64>(keyStart, 0);
                    if (codeS8 == 32933061908693100) {
                      store<i32>(changetype<usize>(out), JSON.__deserialize<i32>(lastIndex, srcStart), offsetof<this>("lorum"));
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
                console.log("Value (object, 3): " + JSON.Util.ptrToStr(lastIndex, srcStart));
                switch (<u32>keyEnd - <u32>keyStart) {
                  case 10:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      if (codeS8 == 32933061908693100) {
                        store<i32>(changetype<usize>(out), JSON.__deserialize<i32>(lastIndex, srcStart), offsetof<this>("lorum"));
                        keyStart = 0;
                        break;
                      } else if (codeS8 == 32933066203725929) {
                        store<boolean>(changetype<usize>(out), JSON.__deserialize<boolean>(lastIndex, srcStart), offsetof<this>("ipsum"));
                        keyStart = 0;
                        break;
                      } else if (codeS8 == 31244186278625380) {
                        store<Array<i32>>(changetype<usize>(out), JSON.__deserialize<Array<i32>>(lastIndex, srcStart), offsetof<this>("dolor"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 6:
                    {
                      const code48 = load<u64>(keyStart) & 281474976710655;
                      if (code48 == 498223087731) {
                        store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("sit"));
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
                switch (<u32>keyEnd - <u32>keyStart) {
                  case 10:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      if (codeS8 == 31244186278625380) {
                        store<Array<i32>>(changetype<usize>(out), JSON.__deserialize<Array<i32>>(lastIndex, srcStart), offsetof<this>("dolor"));
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
            } else if (code == 91) depth++;
;
            srcStart += 2;
          }
        } else if (code == 116) {
          if (load<u64>(srcStart) == 28429475166421108) {
            srcStart += 8;
            console.log("Value (bool, 5): " + JSON.Util.ptrToStr(lastIndex, srcStart - 8));
            switch (<u32>keyEnd - <u32>keyStart) {
              case 10:
                {
                  const codeS8 = load<u64>(keyStart, 0);
                  if (codeS8 == 32933066203725929) {
                    store<boolean>(changetype<usize>(out), true, offsetof<this>("ipsum"));
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
              case 10:
                {
                  const codeS8 = load<u64>(keyStart, 0);
                  if (codeS8 == 32933066203725929) {
                    store<boolean>(changetype<usize>(out), false, offsetof<this>("ipsum"));
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
@json
class ObjMedium {
  lorum: u32 = U32.MAX_VALUE;
  ipsum: boolean = true;
  dolor: Array<i32> = [1, 2, 3, 4, 5];
  sit: string = "abcdefghijklmnopdasfqrstfuvwYZ1234567890`~!@#$%^&*()_+=-{}][\b|;\":'<>,./?";
  consectetur: i32 = 123456;
  adipiscing: boolean = false;
  elit: Array<i32> = [6, 7, 8, 9, 10];
  sed: f64 = F64.MAX_VALUE;
  eiusmod: string = "abcdYZ12345890./?";
  __SERIALIZE(ptr: usize): void {
    bs.proposeSize(242);
    store<v128>(bs.offset, SIMD_0, 0);
    store<u16>(bs.offset, 58, 16);
    bs.offset += 18;
    JSON.__serialize<u32>(load<u32>(ptr, offsetof<this>("lorum")));
    store<v128>(bs.offset, SIMD_1, 0);
    store<u16>(bs.offset, 58, 16);
    bs.offset += 18;
    JSON.__serialize<boolean>(load<boolean>(ptr, offsetof<this>("ipsum")));
    store<v128>(bs.offset, SIMD_2, 0);
    store<u16>(bs.offset, 58, 16);
    bs.offset += 18;
    JSON.__serialize<Array<i32>>(load<Array<i32>>(ptr, offsetof<this>("dolor")));
    store<u64>(bs.offset, 29555366478086188, 0);
    store<u32>(bs.offset, 2228340, 8);
    store<u16>(bs.offset, 58, 12);
    bs.offset += 14;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("sit")));
    store<v128>(bs.offset, SIMD_3, 0);
    store<u64>(bs.offset, 32933070497972340, 16);
    store<u32>(bs.offset, 2228338, 24);
    store<u16>(bs.offset, 58, 28);
    bs.offset += 30;
    JSON.__serialize<i32>(load<i32>(ptr, offsetof<this>("consectetur")));
    store<v128>(bs.offset, SIMD_4, 0);
    store<u64>(bs.offset, 28992395054481507, 16);
    store<u32>(bs.offset, 3801122, 24);
    bs.offset += 28;
    JSON.__serialize<boolean>(load<boolean>(ptr, offsetof<this>("adipiscing")));
    store<v128>(bs.offset, SIMD_5, 0);
    bs.offset += 16;
    JSON.__serialize<Array<i32>>(load<Array<i32>>(ptr, offsetof<this>("elit")));
    store<u64>(bs.offset, 28429466571243564, 0);
    store<u32>(bs.offset, 2228324, 8);
    store<u16>(bs.offset, 58, 12);
    bs.offset += 14;
    JSON.__serialize<f64>(load<f64>(ptr, offsetof<this>("sed")));
    store<v128>(bs.offset, SIMD_6, 0);
    store<u32>(bs.offset, 2228324, 16);
    store<u16>(bs.offset, 58, 20);
    bs.offset += 22;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("eiusmod")));
    store<u16>(bs.offset, 125, 0);
    bs.offset += 2;
  }
  @inline
  __INITIALIZE(): this {
    store<u32>(changetype<usize>(this), U32.MAX_VALUE, offsetof<this>("lorum"));
    store<boolean>(changetype<usize>(this), true, offsetof<this>("ipsum"));
    store<Array<i32>>(changetype<usize>(this), [1, 2, 3, 4, 5], offsetof<this>("dolor"));
    store<string>(changetype<usize>(this), "abcdefghijklmnopdasfqrstfuvwYZ1234567890`~!@#$%^&*()_+=-{}][|;\":'<>,./?", offsetof<this>("sit"));
    store<i32>(changetype<usize>(this), 123456, offsetof<this>("consectetur"));
    store<Array<i32>>(changetype<usize>(this), [6, 7, 8, 9, 10], offsetof<this>("elit"));
    store<f64>(changetype<usize>(this), F64.MAX_VALUE, offsetof<this>("sed"));
    store<string>(changetype<usize>(this), "abcdYZ12345890./?", offsetof<this>("eiusmod"));
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
              console.log("Value (string, 8): " + JSON.Util.ptrToStr(lastIndex, srcStart + 2));
              switch (<u32>keyEnd - <u32>keyStart) {
                case 6:
                  {
                    const code48 = load<u64>(keyStart) & 281474976710655;
                    if (code48 == 498223087731) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("sit"));
                      srcStart += 4;
                      keyStart = 0;
                      break;
                    } else {
                      srcStart += 4;
                      keyStart = 0;
                      break;
                    }
                  }

                case 14:
                  {
                    const codeS8 = load<u64>(keyStart, 0);
                    const codeS12 = load<u32>(keyStart, 8);
                    if (codeS8 == 32370124839780453 && codeS12 == 7274605) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("eiusmod"));
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
              console.log("Value (number, 9): " + JSON.Util.ptrToStr(lastIndex, srcStart));
              switch (<u32>keyEnd - <u32>keyStart) {
                case 10:
                  {
                    const codeS8 = load<u64>(keyStart, 0);
                    if (codeS8 == 32933061908693100) {
                      store<u32>(changetype<usize>(out), JSON.__deserialize<u32>(lastIndex, srcStart), offsetof<this>("lorum"));
                      srcStart += 2;
                      keyStart = 0;
                      break;
                    } else {
                      srcStart += 2;
                      keyStart = 0;
                      break;
                    }
                  }

                case 22:
                  {
                    const codeS8 = load<u64>(keyStart, 0);
                    const codeS16 = load<u64>(keyStart, 8);
                    const codeS20 = load<u32>(keyStart, 16);
                    if (codeS8 == 32370094775402595 && codeS16 == 28429470870470757 && codeS20 == 7667828) {
                      store<i32>(changetype<usize>(out), JSON.__deserialize<i32>(lastIndex, srcStart), offsetof<this>("consectetur"));
                      srcStart += 2;
                      keyStart = 0;
                      break;
                    } else {
                      srcStart += 2;
                      keyStart = 0;
                      break;
                    }
                  }

                case 6:
                  {
                    const code48 = load<u64>(keyStart) & 281474976710655;
                    if (code48 == 429503348851) {
                      store<f64>(changetype<usize>(out), JSON.__deserialize<f64>(lastIndex, srcStart), offsetof<this>("sed"));
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
                  case 10:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      if (codeS8 == 32933061908693100) {
                        store<u32>(changetype<usize>(out), JSON.__deserialize<u32>(lastIndex, srcStart), offsetof<this>("lorum"));
                        keyStart = 0;
                        break;
                      } else if (codeS8 == 32933066203725929) {
                        store<boolean>(changetype<usize>(out), JSON.__deserialize<boolean>(lastIndex, srcStart), offsetof<this>("ipsum"));
                        keyStart = 0;
                        break;
                      } else if (codeS8 == 31244186278625380) {
                        store<Array<i32>>(changetype<usize>(out), JSON.__deserialize<Array<i32>>(lastIndex, srcStart), offsetof<this>("dolor"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 6:
                    {
                      const code48 = load<u64>(keyStart) & 281474976710655;
                      if (code48 == 498223087731) {
                        store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("sit"));
                        keyStart = 0;
                        break;
                      } else if (code48 == 429503348851) {
                        store<f64>(changetype<usize>(out), JSON.__deserialize<f64>(lastIndex, srcStart), offsetof<this>("sed"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 22:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      const codeS16 = load<u64>(keyStart, 8);
                      const codeS20 = load<u32>(keyStart, 16);
                      if (codeS8 == 32370094775402595 && codeS16 == 28429470870470757 && codeS20 == 7667828) {
                        store<i32>(changetype<usize>(out), JSON.__deserialize<i32>(lastIndex, srcStart), offsetof<this>("consectetur"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 20:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      const codeS16 = load<u64>(keyStart, 8);
                      const codeS20 = load<u32>(keyStart, 16);
                      if (codeS8 == 31525648369713249 && codeS16 == 29555297763917929 && codeS20 == 6750318) {
                        store<boolean>(changetype<usize>(out), JSON.__deserialize<boolean>(lastIndex, srcStart), offsetof<this>("adipiscing"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 8:
                    {
                      const code64 = load<u64>(keyStart);
                      if (code64 == 32651548277080165) {
                        store<Array<i32>>(changetype<usize>(out), JSON.__deserialize<Array<i32>>(lastIndex, srcStart), offsetof<this>("elit"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 14:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      const codeS12 = load<u32>(keyStart, 8);
                      if (codeS8 == 32370124839780453 && codeS12 == 7274605) {
                        store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("eiusmod"));
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
                console.log("Value (object, 11): " + JSON.Util.ptrToStr(lastIndex, srcStart));
                switch (<u32>keyEnd - <u32>keyStart) {
                  case 10:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      if (codeS8 == 31244186278625380) {
                        store<Array<i32>>(changetype<usize>(out), JSON.__deserialize<Array<i32>>(lastIndex, srcStart), offsetof<this>("dolor"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 8:
                    {
                      const code64 = load<u64>(keyStart);
                      if (code64 == 32651548277080165) {
                        store<Array<i32>>(changetype<usize>(out), JSON.__deserialize<Array<i32>>(lastIndex, srcStart), offsetof<this>("elit"));
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
            } else if (code == 91) depth++;
;
            srcStart += 2;
          }
        } else if (code == 116) {
          if (load<u64>(srcStart) == 28429475166421108) {
            srcStart += 8;
            console.log("Value (bool, 12): " + JSON.Util.ptrToStr(lastIndex, srcStart - 8));
            switch (<u32>keyEnd - <u32>keyStart) {
              case 10:
                {
                  const codeS8 = load<u64>(keyStart, 0);
                  if (codeS8 == 32933066203725929) {
                    store<boolean>(changetype<usize>(out), true, offsetof<this>("ipsum"));
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  } else {
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  }
                }

              case 20:
                {
                  const codeS8 = load<u64>(keyStart, 0);
                  const codeS16 = load<u64>(keyStart, 8);
                  const codeS20 = load<u32>(keyStart, 16);
                  if (codeS8 == 31525648369713249 && codeS16 == 29555297763917929 && codeS20 == 6750318) {
                    store<boolean>(changetype<usize>(out), true, offsetof<this>("adipiscing"));
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
            console.log("Value (bool, 13): " + JSON.Util.ptrToStr(lastIndex, srcStart - 10));
            switch (<u32>keyEnd - <u32>keyStart) {
              case 10:
                {
                  const codeS8 = load<u64>(keyStart, 0);
                  if (codeS8 == 32933066203725929) {
                    store<boolean>(changetype<usize>(out), false, offsetof<this>("ipsum"));
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  } else {
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  }
                }

              case 20:
                {
                  const codeS8 = load<u64>(keyStart, 0);
                  const codeS16 = load<u64>(keyStart, 8);
                  const codeS20 = load<u32>(keyStart, 16);
                  if (codeS8 == 31525648369713249 && codeS16 == 29555297763917929 && codeS20 == 6750318) {
                    store<boolean>(changetype<usize>(out), false, offsetof<this>("adipiscing"));
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
            console.log("Value (null, 14): " + JSON.Util.ptrToStr(lastIndex, srcStart - 8));
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
@json
class ObjLarge {
  lorum: u32 = U32.MAX_VALUE;
  ipsum: boolean = true;
  dolor: Array<i32> = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  sit: string = "abcdefghijklmnopdasfqrstfuvwYZ1234567890`~!@#$%^&*()_+=-{}][\b|;\":'<>,./?";
  consectetur: i32 = 123456;
  adipiscing: boolean = false;
  elit: Array<i32> = [11, 12, 13, 14, 15];
  sed: f64 = F64.MAX_VALUE;
  eiusmod: string = "abcdYZ12345890sdfw\"12i9i12dsf./?";
  tempor: i32 = 999999;
  incididunt: boolean = true;
  ut: Array<i32> = [16, 17, 18, 19, 20];
  labore: f64 = 3.1415926535;
  et: string = "xyzXYZ09876!@#";
  dolore: i32 = -123456;
  magna: boolean = false;
  aliqua: Array<i32> = [21, 22, 23, 24, 25];
  argw: string = "abcdYZ12345890sdfw\"vie91kfESDFOK12i9i12dsf./?";
  __SERIALIZE(ptr: usize): void {
    bs.proposeSize(472);
    store<v128>(bs.offset, SIMD_0, 0);
    store<u16>(bs.offset, 58, 16);
    bs.offset += 18;
    JSON.__serialize<u32>(load<u32>(ptr, offsetof<this>("lorum")));
    store<v128>(bs.offset, SIMD_1, 0);
    store<u16>(bs.offset, 58, 16);
    bs.offset += 18;
    JSON.__serialize<boolean>(load<boolean>(ptr, offsetof<this>("ipsum")));
    store<v128>(bs.offset, SIMD_2, 0);
    store<u16>(bs.offset, 58, 16);
    bs.offset += 18;
    JSON.__serialize<Array<i32>>(load<Array<i32>>(ptr, offsetof<this>("dolor")));
    store<u64>(bs.offset, 29555366478086188, 0);
    store<u32>(bs.offset, 2228340, 8);
    store<u16>(bs.offset, 58, 12);
    bs.offset += 14;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("sit")));
    store<v128>(bs.offset, SIMD_3, 0);
    store<u64>(bs.offset, 32933070497972340, 16);
    store<u32>(bs.offset, 2228338, 24);
    store<u16>(bs.offset, 58, 28);
    bs.offset += 30;
    JSON.__serialize<i32>(load<i32>(ptr, offsetof<this>("consectetur")));
    store<v128>(bs.offset, SIMD_4, 0);
    store<u64>(bs.offset, 28992395054481507, 16);
    store<u32>(bs.offset, 3801122, 24);
    bs.offset += 28;
    JSON.__serialize<boolean>(load<boolean>(ptr, offsetof<this>("adipiscing")));
    store<v128>(bs.offset, SIMD_5, 0);
    bs.offset += 16;
    JSON.__serialize<Array<i32>>(load<Array<i32>>(ptr, offsetof<this>("elit")));
    store<u64>(bs.offset, 28429466571243564, 0);
    store<u32>(bs.offset, 2228324, 8);
    store<u16>(bs.offset, 58, 12);
    bs.offset += 14;
    JSON.__serialize<f64>(load<f64>(ptr, offsetof<this>("sed")));
    store<v128>(bs.offset, SIMD_6, 0);
    store<u32>(bs.offset, 2228324, 16);
    store<u16>(bs.offset, 58, 20);
    bs.offset += 22;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("eiusmod")));
    store<v128>(bs.offset, SIMD_7, 0);
    store<u32>(bs.offset, 3801122, 16);
    bs.offset += 20;
    JSON.__serialize<i32>(load<i32>(ptr, offsetof<this>("tempor")));
    store<v128>(bs.offset, SIMD_8, 0);
    store<u64>(bs.offset, 32651569752506468, 16);
    store<u32>(bs.offset, 3801122, 24);
    bs.offset += 28;
    JSON.__serialize<boolean>(load<boolean>(ptr, offsetof<this>("incididunt")));
    store<u64>(bs.offset, 32651599811837996, 0);
    store<u32>(bs.offset, 3801122, 8);
    bs.offset += 12;
    JSON.__serialize<Array<i32>>(load<Array<i32>>(ptr, offsetof<this>("ut")));
    store<v128>(bs.offset, SIMD_9, 0);
    store<u32>(bs.offset, 3801122, 16);
    bs.offset += 20;
    JSON.__serialize<f64>(load<f64>(ptr, offsetof<this>("labore")));
    store<u64>(bs.offset, 32651531092361260, 0);
    store<u32>(bs.offset, 3801122, 8);
    bs.offset += 12;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("et")));
    store<v128>(bs.offset, SIMD_10, 0);
    store<u32>(bs.offset, 3801122, 16);
    bs.offset += 20;
    JSON.__serialize<i32>(load<i32>(ptr, offsetof<this>("dolore")));
    store<v128>(bs.offset, SIMD_11, 0);
    store<u16>(bs.offset, 58, 16);
    bs.offset += 18;
    JSON.__serialize<boolean>(load<boolean>(ptr, offsetof<this>("magna")));
    store<v128>(bs.offset, SIMD_12, 0);
    store<u32>(bs.offset, 3801122, 16);
    bs.offset += 20;
    JSON.__serialize<Array<i32>>(load<Array<i32>>(ptr, offsetof<this>("aliqua")));
    store<v128>(bs.offset, SIMD_13, 0);
    bs.offset += 16;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("argw")));
    store<u16>(bs.offset, 125, 0);
    bs.offset += 2;
  }
  @inline
  __INITIALIZE(): this {
    store<u32>(changetype<usize>(this), U32.MAX_VALUE, offsetof<this>("lorum"));
    store<boolean>(changetype<usize>(this), true, offsetof<this>("ipsum"));
    store<Array<i32>>(changetype<usize>(this), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], offsetof<this>("dolor"));
    store<string>(changetype<usize>(this), "abcdefghijklmnopdasfqrstfuvwYZ1234567890`~!@#$%^&*()_+=-{}][|;\":'<>,./?", offsetof<this>("sit"));
    store<i32>(changetype<usize>(this), 123456, offsetof<this>("consectetur"));
    store<Array<i32>>(changetype<usize>(this), [11, 12, 13, 14, 15], offsetof<this>("elit"));
    store<f64>(changetype<usize>(this), F64.MAX_VALUE, offsetof<this>("sed"));
    store<string>(changetype<usize>(this), "abcdYZ12345890sdfw\"12i9i12dsf./?", offsetof<this>("eiusmod"));
    store<i32>(changetype<usize>(this), 999999, offsetof<this>("tempor"));
    store<boolean>(changetype<usize>(this), true, offsetof<this>("incididunt"));
    store<Array<i32>>(changetype<usize>(this), [16, 17, 18, 19, 20], offsetof<this>("ut"));
    store<f64>(changetype<usize>(this), 3.1415926535, offsetof<this>("labore"));
    store<string>(changetype<usize>(this), "xyzXYZ09876!@#", offsetof<this>("et"));
    store<i32>(changetype<usize>(this), -123456, offsetof<this>("dolore"));
    store<Array<i32>>(changetype<usize>(this), [21, 22, 23, 24, 25], offsetof<this>("aliqua"));
    store<string>(changetype<usize>(this), "abcdYZ12345890sdfw\"vie91kfESDFOK12i9i12dsf./?", offsetof<this>("argw"));
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
              console.log("Value (string, 15): " + JSON.Util.ptrToStr(lastIndex, srcStart + 2));
              switch (<u32>keyEnd - <u32>keyStart) {
                case 6:
                  {
                    const code48 = load<u64>(keyStart) & 281474976710655;
                    if (code48 == 498223087731) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("sit"));
                      srcStart += 4;
                      keyStart = 0;
                      break;
                    } else {
                      srcStart += 4;
                      keyStart = 0;
                      break;
                    }
                  }

                case 14:
                  {
                    const codeS8 = load<u64>(keyStart, 0);
                    const codeS12 = load<u32>(keyStart, 8);
                    if (codeS8 == 32370124839780453 && codeS12 == 7274605) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("eiusmod"));
                      srcStart += 4;
                      keyStart = 0;
                      break;
                    } else {
                      srcStart += 4;
                      keyStart = 0;
                      break;
                    }
                  }

                case 4:
                  {
                    const code32 = load<u32>(keyStart);
                    if (code32 == 7602277) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("et"));
                      srcStart += 4;
                      keyStart = 0;
                      break;
                    } else {
                      srcStart += 4;
                      keyStart = 0;
                      break;
                    }
                  }

                case 8:
                  {
                    const code64 = load<u64>(keyStart);
                    if (code64 == 33495964617670753) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("argw"));
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
              console.log("Value (number, 16): " + JSON.Util.ptrToStr(lastIndex, srcStart));
              switch (<u32>keyEnd - <u32>keyStart) {
                case 12:
                  {
                    const codeS8 = load<u64>(keyStart, 0);
                    const codeS12 = load<u32>(keyStart, 8);
                    if (codeS8 == 31525665549647988 && codeS12 == 7471215) {
                      store<i32>(changetype<usize>(out), JSON.__deserialize<i32>(lastIndex, srcStart), offsetof<this>("tempor"));
                      srcStart += 2;
                      keyStart = 0;
                      break;
                    } else if (codeS8 == 31244143328034924 && codeS12 == 6619250) {
                      store<f64>(changetype<usize>(out), JSON.__deserialize<f64>(lastIndex, srcStart), offsetof<this>("labore"));
                      srcStart += 2;
                      keyStart = 0;
                      break;
                    } else if (codeS8 == 31244186278625380 && codeS12 == 6619250) {
                      store<i32>(changetype<usize>(out), JSON.__deserialize<i32>(lastIndex, srcStart), offsetof<this>("dolore"));
                      srcStart += 2;
                      keyStart = 0;
                      break;
                    } else {
                      srcStart += 2;
                      keyStart = 0;
                      break;
                    }
                  }

                case 10:
                  {
                    const codeS8 = load<u64>(keyStart, 0);
                    if (codeS8 == 32933061908693100) {
                      store<u32>(changetype<usize>(out), JSON.__deserialize<u32>(lastIndex, srcStart), offsetof<this>("lorum"));
                      srcStart += 2;
                      keyStart = 0;
                      break;
                    } else {
                      srcStart += 2;
                      keyStart = 0;
                      break;
                    }
                  }

                case 22:
                  {
                    const codeS8 = load<u64>(keyStart, 0);
                    const codeS16 = load<u64>(keyStart, 8);
                    const codeS20 = load<u32>(keyStart, 16);
                    if (codeS8 == 32370094775402595 && codeS16 == 28429470870470757 && codeS20 == 7667828) {
                      store<i32>(changetype<usize>(out), JSON.__deserialize<i32>(lastIndex, srcStart), offsetof<this>("consectetur"));
                      srcStart += 2;
                      keyStart = 0;
                      break;
                    } else {
                      srcStart += 2;
                      keyStart = 0;
                      break;
                    }
                  }

                case 6:
                  {
                    const code48 = load<u64>(keyStart) & 281474976710655;
                    if (code48 == 429503348851) {
                      store<f64>(changetype<usize>(out), JSON.__deserialize<f64>(lastIndex, srcStart), offsetof<this>("sed"));
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
                console.log("Value (object, 17): " + JSON.Util.ptrToStr(lastIndex, srcStart));
                switch (<u32>keyEnd - <u32>keyStart) {
                  case 10:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      if (codeS8 == 32933061908693100) {
                        store<u32>(changetype<usize>(out), JSON.__deserialize<u32>(lastIndex, srcStart), offsetof<this>("lorum"));
                        keyStart = 0;
                        break;
                      } else if (codeS8 == 32933066203725929) {
                        store<boolean>(changetype<usize>(out), JSON.__deserialize<boolean>(lastIndex, srcStart), offsetof<this>("ipsum"));
                        keyStart = 0;
                        break;
                      } else if (codeS8 == 31244186278625380) {
                        store<Array<i32>>(changetype<usize>(out), JSON.__deserialize<Array<i32>>(lastIndex, srcStart), offsetof<this>("dolor"));
                        keyStart = 0;
                        break;
                      } else if (codeS8 == 30962689826160749) {
                        store<boolean>(changetype<usize>(out), JSON.__deserialize<boolean>(lastIndex, srcStart), offsetof<this>("magna"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 12:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      const codeS12 = load<u32>(keyStart, 8);
                      if (codeS8 == 31525665549647988 && codeS12 == 7471215) {
                        store<i32>(changetype<usize>(out), JSON.__deserialize<i32>(lastIndex, srcStart), offsetof<this>("tempor"));
                        keyStart = 0;
                        break;
                      } else if (codeS8 == 31244143328034924 && codeS12 == 6619250) {
                        store<f64>(changetype<usize>(out), JSON.__deserialize<f64>(lastIndex, srcStart), offsetof<this>("labore"));
                        keyStart = 0;
                        break;
                      } else if (codeS8 == 31244186278625380 && codeS12 == 6619250) {
                        store<i32>(changetype<usize>(out), JSON.__deserialize<i32>(lastIndex, srcStart), offsetof<this>("dolore"));
                        keyStart = 0;
                        break;
                      } else if (codeS8 == 31807123346948193 && codeS12 == 6357109) {
                        store<Array<i32>>(changetype<usize>(out), JSON.__deserialize<Array<i32>>(lastIndex, srcStart), offsetof<this>("aliqua"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 6:
                    {
                      const code48 = load<u64>(keyStart) & 281474976710655;
                      if (code48 == 498223087731) {
                        store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("sit"));
                        keyStart = 0;
                        break;
                      } else if (code48 == 429503348851) {
                        store<f64>(changetype<usize>(out), JSON.__deserialize<f64>(lastIndex, srcStart), offsetof<this>("sed"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 20:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      const codeS16 = load<u64>(keyStart, 8);
                      const codeS20 = load<u32>(keyStart, 16);
                      if (codeS8 == 31525648369713249 && codeS16 == 29555297763917929 && codeS20 == 6750318) {
                        store<boolean>(changetype<usize>(out), JSON.__deserialize<boolean>(lastIndex, srcStart), offsetof<this>("adipiscing"));
                        keyStart = 0;
                        break;
                      } else if (codeS8 == 29555297763590249 && codeS16 == 32933001778757732 && codeS20 == 7602286) {
                        store<boolean>(changetype<usize>(out), JSON.__deserialize<boolean>(lastIndex, srcStart), offsetof<this>("incididunt"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 8:
                    {
                      const code64 = load<u64>(keyStart);
                      if (code64 == 32651548277080165) {
                        store<Array<i32>>(changetype<usize>(out), JSON.__deserialize<Array<i32>>(lastIndex, srcStart), offsetof<this>("elit"));
                        keyStart = 0;
                        break;
                      } else if (code64 == 33495964617670753) {
                        store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("argw"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 4:
                    {
                      const code32 = load<u32>(keyStart);
                      if (code32 == 7602293) {
                        store<Array<i32>>(changetype<usize>(out), JSON.__deserialize<Array<i32>>(lastIndex, srcStart), offsetof<this>("ut"));
                        keyStart = 0;
                        break;
                      } else if (code32 == 7602277) {
                        store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("et"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 22:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      const codeS16 = load<u64>(keyStart, 8);
                      const codeS20 = load<u32>(keyStart, 16);
                      if (codeS8 == 32370094775402595 && codeS16 == 28429470870470757 && codeS20 == 7667828) {
                        store<i32>(changetype<usize>(out), JSON.__deserialize<i32>(lastIndex, srcStart), offsetof<this>("consectetur"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 14:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      const codeS12 = load<u32>(keyStart, 8);
                      if (codeS8 == 32370124839780453 && codeS12 == 7274605) {
                        store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("eiusmod"));
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
                console.log("Value (object, 18): " + JSON.Util.ptrToStr(lastIndex, srcStart));
                switch (<u32>keyEnd - <u32>keyStart) {
                  case 10:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      if (codeS8 == 31244186278625380) {
                        store<Array<i32>>(changetype<usize>(out), JSON.__deserialize<Array<i32>>(lastIndex, srcStart), offsetof<this>("dolor"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 8:
                    {
                      const code64 = load<u64>(keyStart);
                      if (code64 == 32651548277080165) {
                        store<Array<i32>>(changetype<usize>(out), JSON.__deserialize<Array<i32>>(lastIndex, srcStart), offsetof<this>("elit"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 4:
                    {
                      const code32 = load<u32>(keyStart);
                      if (code32 == 7602293) {
                        store<Array<i32>>(changetype<usize>(out), JSON.__deserialize<Array<i32>>(lastIndex, srcStart), offsetof<this>("ut"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 12:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      const codeS12 = load<u32>(keyStart, 8);
                      if (codeS8 == 31807123346948193 && codeS12 == 6357109) {
                        store<Array<i32>>(changetype<usize>(out), JSON.__deserialize<Array<i32>>(lastIndex, srcStart), offsetof<this>("aliqua"));
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
            } else if (code == 91) depth++;
;
            srcStart += 2;
          }
        } else if (code == 116) {
          if (load<u64>(srcStart) == 28429475166421108) {
            srcStart += 8;
            console.log("Value (bool, 19): " + JSON.Util.ptrToStr(lastIndex, srcStart - 8));
            switch (<u32>keyEnd - <u32>keyStart) {
              case 10:
                {
                  const codeS8 = load<u64>(keyStart, 0);
                  if (codeS8 == 32933066203725929) {
                    store<boolean>(changetype<usize>(out), true, offsetof<this>("ipsum"));
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  } else if (codeS8 == 30962689826160749) {
                    store<boolean>(changetype<usize>(out), true, offsetof<this>("magna"));
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  } else {
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  }
                }

              case 20:
                {
                  const codeS8 = load<u64>(keyStart, 0);
                  const codeS16 = load<u64>(keyStart, 8);
                  const codeS20 = load<u32>(keyStart, 16);
                  if (codeS8 == 31525648369713249 && codeS16 == 29555297763917929 && codeS20 == 6750318) {
                    store<boolean>(changetype<usize>(out), true, offsetof<this>("adipiscing"));
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  } else if (codeS8 == 29555297763590249 && codeS16 == 32933001778757732 && codeS20 == 7602286) {
                    store<boolean>(changetype<usize>(out), true, offsetof<this>("incididunt"));
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
            console.log("Value (bool, 20): " + JSON.Util.ptrToStr(lastIndex, srcStart - 10));
            switch (<u32>keyEnd - <u32>keyStart) {
              case 10:
                {
                  const codeS8 = load<u64>(keyStart, 0);
                  if (codeS8 == 32933066203725929) {
                    store<boolean>(changetype<usize>(out), false, offsetof<this>("ipsum"));
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  } else if (codeS8 == 30962689826160749) {
                    store<boolean>(changetype<usize>(out), false, offsetof<this>("magna"));
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  } else {
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  }
                }

              case 20:
                {
                  const codeS8 = load<u64>(keyStart, 0);
                  const codeS16 = load<u64>(keyStart, 8);
                  const codeS20 = load<u32>(keyStart, 16);
                  if (codeS8 == 31525648369713249 && codeS16 == 29555297763917929 && codeS20 == 6750318) {
                    store<boolean>(changetype<usize>(out), false, offsetof<this>("adipiscing"));
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  } else if (codeS8 == 29555297763590249 && codeS16 == 32933001778757732 && codeS20 == 7602286) {
                    store<boolean>(changetype<usize>(out), false, offsetof<this>("incididunt"));
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
            console.log("Value (null, 21): " + JSON.Util.ptrToStr(lastIndex, srcStart - 8));
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
console.log((JSON.stringify(new ObjLarge()).length << 1).toString());
