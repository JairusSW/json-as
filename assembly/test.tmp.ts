import {
  bs
} from "../lib/as-bs";
const SIMD_7 = i16x8(105, 99, 97, 116, 105, 111, 110, 71);
const SIMD_6 = i16x8(123, 34, 99, 101, 114, 116, 105, 102);
const SIMD_5 = i16x8(105, 99, 97, 116, 105, 111, 110, 115);
const SIMD_4 = i16x8(44, 34, 99, 101, 114, 116, 105, 102);
const SIMD_3 = i16x8(123, 34, 99, 101, 114, 116, 71, 114);
const SIMD_2 = i16x8(44, 34, 97, 98, 98, 114, 34, 58);
const SIMD_1 = i16x8(44, 34, 116, 105, 116, 108, 101, 34);
const SIMD_0 = i16x8(123, 34, 99, 101, 114, 116, 73, 68);
import {
  JSON
} from ".";
import {
  expect,
  it
} from "./__tests__/lib";
it("should deserialize a default empty array", () => {
  const data = "{\"certificationGroups\":[{\"certGroupID\":\"0x653aae\",\"title\":\"Food Safety\"}]}";
  const obj = JSON.parse<CertificationGroupResponse>(data);
  expect(obj.certificationGroups.length).toBe(1);
  expect(obj.certificationGroups[0].certGroupID).toBe("0x653aae");
  expect(obj.certificationGroups[0].title).toBe("Food Safety");
  expect(obj.certificationGroups[0].certifications.length).toBe(0);
});
@json
class Certification {
  certID: string = "";
  title: string = "";
  abbr: string = "";
  __SERIALIZE(ptr: usize): void {
    bs.proposeSize(56);
    store<v128>(bs.offset, SIMD_0, 0);
    store<u32>(bs.offset, 3801122, 16);
    bs.offset += 20;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("certID")));
    store<v128>(bs.offset, SIMD_1, 0);
    store<u16>(bs.offset, 58, 16);
    bs.offset += 18;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("title")));
    store<v128>(bs.offset, SIMD_2, 0);
    bs.offset += 16;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("abbr")));
    store<u16>(bs.offset, 125, 0);
    bs.offset += 2;
  }
  @inline
  __INITIALIZE(): this {
    store<string>(changetype<usize>(this), "", offsetof<this>("certID"));
    store<string>(changetype<usize>(this), "", offsetof<this>("title"));
    store<string>(changetype<usize>(this), "", offsetof<this>("abbr"));
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
                case 12:
                  {
                    const codeS8 = load<u64>(keyStart, 0);
                    const codeS12 = load<u32>(keyStart, 8);
                    if (codeS8 == 32651586931327075 && codeS12 == 4456521) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("certID"));
                      srcStart += 4;
                      keyStart = 0;
                      break;
                    } else {
                      srcStart += 4;
                      keyStart = 0;
                      break;
                    }
                  }

                case 10:
                  {
                    const codeS8 = load<u64>(keyStart, 0);
                    if (codeS8 == 30399795707838580) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("title"));
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
                    if (code64 == 32088568258232417) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("abbr"));
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
                  case 12:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      const codeS12 = load<u32>(keyStart, 8);
                      if (codeS8 == 32651586931327075 && codeS12 == 4456521) {
                        store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("certID"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 10:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      if (codeS8 == 30399795707838580) {
                        store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("title"));
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
                      if (code64 == 32088568258232417) {
                        store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("abbr"));
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
@json
class CertificationGroup {
  certGroupID!: string;
  title!: string;
  certifications!: Array<Certification>;
  __SERIALIZE(ptr: usize): void {
    bs.proposeSize(86);
    store<v128>(bs.offset, SIMD_3, 0);
    store<u64>(bs.offset, 20548154343882863, 16);
    store<u32>(bs.offset, 2228292, 24);
    store<u16>(bs.offset, 58, 28);
    bs.offset += 30;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("certGroupID")));
    store<v128>(bs.offset, SIMD_1, 0);
    store<u16>(bs.offset, 58, 16);
    bs.offset += 18;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("title")));
    store<v128>(bs.offset, SIMD_4, 0);
    store<v128>(bs.offset, SIMD_5, 16);
    store<u32>(bs.offset, 3801122, 32);
    bs.offset += 36;
    JSON.__serialize<Array<Certification>>(load<Array<Certification>>(ptr, offsetof<this>("certifications")));
    store<u16>(bs.offset, 125, 0);
    bs.offset += 2;
  }
  @inline
  __INITIALIZE(): this {
    store<string>(changetype<usize>(this), "", offsetof<this>("certGroupID"));
    store<string>(changetype<usize>(this), "", offsetof<this>("title"));
    store<Array<Certification>>(changetype<usize>(this), [], offsetof<this>("certifications"));
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
                case 22:
                  {
                    const codeS8 = load<u64>(keyStart, 0);
                    const codeS16 = load<u64>(keyStart, 8);
                    const codeS20 = load<u32>(keyStart, 16);
                    if (codeS8 == 32651586931327075 && codeS16 == 32933049023987783 && codeS20 == 4784240) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("certGroupID"));
                      srcStart += 4;
                      keyStart = 0;
                      break;
                    } else {
                      srcStart += 4;
                      keyStart = 0;
                      break;
                    }
                  }

                case 10:
                  {
                    const codeS8 = load<u64>(keyStart, 0);
                    if (codeS8 == 30399795707838580) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("title"));
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
                  case 22:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      const codeS16 = load<u64>(keyStart, 8);
                      const codeS20 = load<u32>(keyStart, 16);
                      if (codeS8 == 32651586931327075 && codeS16 == 32933049023987783 && codeS20 == 4784240) {
                        store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("certGroupID"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 10:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      if (codeS8 == 30399795707838580) {
                        store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("title"));
                        keyStart = 0;
                        break;
                      } else {
                        keyStart = 0;
                        break;
                      }
                    }

                  case 28:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      const codeS16 = load<u64>(keyStart, 8);
                      const codeS24 = load<u64>(keyStart, 16);
                      const codeS28 = load<u32>(keyStart, 24);
                      if (codeS8 == 32651586931327075 && codeS16 == 27866473672605801 && codeS24 == 31244173394051169 && codeS28 == 7536750) {
                        store<Array<Certification>>(changetype<usize>(out), JSON.__deserialize<Array<Certification>>(lastIndex, srcStart), offsetof<this>("certifications"));
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
                switch (<u32>keyEnd - <u32>keyStart) {
                  case 28:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      const codeS16 = load<u64>(keyStart, 8);
                      const codeS24 = load<u64>(keyStart, 16);
                      const codeS28 = load<u32>(keyStart, 24);
                      if (codeS8 == 32651586931327075 && codeS16 == 27866473672605801 && codeS24 == 31244173394051169 && codeS28 == 7536750) {
                        store<Array<Certification>>(changetype<usize>(out), JSON.__deserialize<Array<Certification>>(lastIndex, srcStart), offsetof<this>("certifications"));
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
@json
class CertificationGroupResponse {
  certificationGroups!: Array<CertificationGroup>;
  __SERIALIZE(ptr: usize): void {
    bs.proposeSize(48);
    store<v128>(bs.offset, SIMD_6, 0);
    store<v128>(bs.offset, SIMD_7, 16);
    store<u64>(bs.offset, 31525699910041714, 32);
    store<u32>(bs.offset, 2228339, 40);
    store<u16>(bs.offset, 58, 44);
    bs.offset += 46;
    JSON.__serialize<Array<CertificationGroup>>(load<Array<CertificationGroup>>(ptr, offsetof<this>("certificationGroups")));
    store<u16>(bs.offset, 125, 0);
    bs.offset += 2;
  }
  @inline
  __INITIALIZE(): this {
    store<Array<CertificationGroup>>(changetype<usize>(this), [], offsetof<this>("certificationGroups"));
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
              srcStart += 4;
              keyStart = 0;
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
                  case 38:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      const codeS16 = load<u64>(keyStart, 8);
                      const codeS24 = load<u64>(keyStart, 16);
                      const codeS32 = load<u64>(keyStart, 24);
                      const codeS36 = load<u32>(keyStart, 32);
                      if (codeS8 == 32651586931327075 && codeS16 == 27866473672605801 && codeS24 == 31244173394051169 && codeS32 == 31244212045807726 && codeS36 == 7340149) {
                        store<Array<CertificationGroup>>(changetype<usize>(out), JSON.__deserialize<Array<CertificationGroup>>(lastIndex, srcStart), offsetof<this>("certificationGroups"));
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
                switch (<u32>keyEnd - <u32>keyStart) {
                  case 38:
                    {
                      const codeS8 = load<u64>(keyStart, 0);
                      const codeS16 = load<u64>(keyStart, 8);
                      const codeS24 = load<u64>(keyStart, 16);
                      const codeS32 = load<u64>(keyStart, 24);
                      const codeS36 = load<u32>(keyStart, 32);
                      if (codeS8 == 32651586931327075 && codeS16 == 27866473672605801 && codeS24 == 31244173394051169 && codeS32 == 31244212045807726 && codeS36 == 7340149) {
                        store<Array<CertificationGroup>>(changetype<usize>(out), JSON.__deserialize<Array<CertificationGroup>>(lastIndex, srcStart), offsetof<this>("certificationGroups"));
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
