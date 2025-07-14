import { JSON } from "../assembly/index";
import { bs } from "../lib/as-bs";


@json
class Vec3 {
  x: f32 = 0;
  y: f32 = 0;
  z: f32 = 0;
  __SERIALIZE(ptr: usize): void {
    bs.proposeSize(32);
    store<u64>(bs.offset, 9570664606466171, 0);
    store<u16>(bs.offset, 58, 8);
    bs.offset += 10;
    JSON.__serialize<f32>(load<f32>(ptr, offsetof<this>("x")));
    store<u64>(bs.offset, 9570668901433388, 0);
    store<u16>(bs.offset, 58, 8);
    bs.offset += 10;
    JSON.__serialize<f32>(load<f32>(ptr, offsetof<this>("y")));
    store<u64>(bs.offset, 9570673196400684, 0);
    store<u16>(bs.offset, 58, 8);
    bs.offset += 10;
    JSON.__serialize<f32>(load<f32>(ptr, offsetof<this>("z")));
    store<u16>(bs.offset, 125, 0);
    bs.offset += 2;
  }


  @inline
  __INITIALIZE(): this {
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
              switch (<u32>keyEnd - <u32>keyStart) {
                case 2: {
                  const code16 = load<u16>(keyStart);
                  if (code16 == 120) {
                    store<f32>(changetype<usize>(out), JSON.__deserialize<f32>(lastIndex, srcStart), offsetof<this>("x"));
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  } else if (code16 == 121) {
                    store<f32>(changetype<usize>(out), JSON.__deserialize<f32>(lastIndex, srcStart), offsetof<this>("y"));
                    srcStart += 2;
                    keyStart = 0;
                    break;
                  } else if (code16 == 122) {
                    store<f32>(changetype<usize>(out), JSON.__deserialize<f32>(lastIndex, srcStart), offsetof<this>("z"));
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
                switch (<u32>keyEnd - <u32>keyStart) {
                  case 2: {
                    const code16 = load<u16>(keyStart);
                    if (code16 == 120) {
                      store<f32>(changetype<usize>(out), JSON.__deserialize<f32>(lastIndex, srcStart), offsetof<this>("x"));
                      keyStart = 0;
                      break;
                    } else if (code16 == 121) {
                      store<f32>(changetype<usize>(out), JSON.__deserialize<f32>(lastIndex, srcStart), offsetof<this>("y"));
                      keyStart = 0;
                      break;
                    } else if (code16 == 122) {
                      store<f32>(changetype<usize>(out), JSON.__deserialize<f32>(lastIndex, srcStart), offsetof<this>("z"));
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
                keyStart = 0;
                break;
              }
            } else if (code == 91) depth++;
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
class Player {

  @alias("first name")
  firstName!: string | null;
  lastName!: string;
  lastActive!: Array<i32>;


  @omitif((self: this): boolean => self.age < 18)
  age!: i32;
  pos!: Vec3 | null;
  isVerified!: boolean;
  __SERIALIZE(ptr: usize): void {
    bs.proposeSize(158);
    store<u16>(bs.offset, 123, 0);
    bs.offset += 2;
    if (!((self: this): boolean => self.age < 18)(this)) {
      store<u64>(bs.offset, 28429415035764770, 0);
      store<u32>(bs.offset, 3801122, 8);
      bs.offset += 12;
      JSON.__serialize<i32>(load<i32>(ptr, offsetof<this>("age")));
      store<u16>(bs.offset, 44, 0);
      bs.offset += 2;
    }
    store<u64>(bs.offset, 32088598323265570, 0);
    store<u64>(bs.offset, 30962384884727923, 8);
    store<u64>(bs.offset, 9570583007002721, 16);
    store<u16>(bs.offset, 58, 24);
    bs.offset += 26;
    JSON.__serialize<string | null>(load<string | null>(ptr, offsetof<this>("firstName")));
    store<u64>(bs.offset, 27303536599629868, 0);
    store<u64>(bs.offset, 27303407755985011, 8);
    store<u64>(bs.offset, 16325694684725357, 16);
    bs.offset += 24;
    JSON.__serialize<string>(load<string>(ptr, offsetof<this>("lastName")));
    store<u64>(bs.offset, 27303536599629868, 0);
    store<u64>(bs.offset, 27866301874831475, 8);
    store<u64>(bs.offset, 28429479460798580, 16);
    store<u32>(bs.offset, 3801122, 24);
    bs.offset += 28;
    JSON.__serialize<Array<i32>>(load<Array<i32>>(ptr, offsetof<this>("lastActive")));
    store<u64>(bs.offset, 31244203453448236, 0);
    store<u32>(bs.offset, 2228339, 8);
    store<u16>(bs.offset, 58, 12);
    bs.offset += 14;
    JSON.__serialize<Vec3 | null>(load<Vec3 | null>(ptr, offsetof<this>("pos")));
    store<u64>(bs.offset, 32370073295519788, 0);
    store<u64>(bs.offset, 29555362187509846, 8);
    store<u64>(bs.offset, 28147931469643878, 16);
    store<u32>(bs.offset, 3801122, 24);
    bs.offset += 28;
    JSON.__serialize<boolean>(load<boolean>(ptr, offsetof<this>("isVerified")));
    store<u16>(bs.offset, 125, 0);
    bs.offset += 2;
  }


  @inline
  __INITIALIZE(): this {
    store<string>(changetype<usize>(this), "", offsetof<this>("lastName"));
    store<Array<i32>>(changetype<usize>(this), [], offsetof<this>("lastActive"));
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
              switch (<u32>keyEnd - <u32>keyStart) {
                case 20: {
                  const codeS8 = load<u64>(keyStart, 0);
                  const codeS16 = load<u64>(keyStart, 8);
                  const codeS20 = load<u32>(keyStart, 16);
                  if (codeS8 == 32370111954878566 && codeS16 == 27303545189433460 && codeS20 == 6619245) {
                    store<string | null>(changetype<usize>(out), JSON.__deserialize<string | null>(lastIndex, srcStart + 2), offsetof<this>("firstName"));
                    srcStart += 4;
                    keyStart = 0;
                    break;
                  } else {
                    srcStart += 4;
                    keyStart = 0;
                    break;
                  }
                }

                case 16: {
                  const codeS8 = load<u64>(keyStart, 0);
                  const codeS16 = load<u64>(keyStart, 8);
                  if (codeS8 == 32651591226032236 && codeS16 == 28429440805568590) {
                    store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart + 2), offsetof<this>("lastName"));
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
              switch (<u32>keyEnd - <u32>keyStart) {
                case 6: {
                  const code48 = load<u64>(keyStart) & 281474976710655;
                  if (code48 == 433798447201) {
                    store<i32>(changetype<usize>(out), JSON.__deserialize<i32>(lastIndex, srcStart), offsetof<this>("age"));
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
                switch (<u32>keyEnd - <u32>keyStart) {
                  case 20: {
                    const codeS8 = load<u64>(keyStart, 0);
                    const codeS16 = load<u64>(keyStart, 8);
                    const codeS20 = load<u32>(keyStart, 16);
                    if (codeS8 == 32370111954878566 && codeS16 == 27303545189433460 && codeS20 == 6619245) {
                      store<string | null>(changetype<usize>(out), JSON.__deserialize<string | null>(lastIndex, srcStart), offsetof<this>("firstName"));
                      keyStart = 0;
                      break;
                    } else if (codeS8 == 32651591226032236 && codeS16 == 29555370777313345 && codeS20 == 6619254) {
                      store<Array<i32>>(changetype<usize>(out), JSON.__deserialize<Array<i32>>(lastIndex, srcStart), offsetof<this>("lastActive"));
                      keyStart = 0;
                      break;
                    } else if (codeS8 == 28429342022500457 && codeS16 == 29555310648164466 && codeS20 == 6553701) {
                      store<boolean>(changetype<usize>(out), JSON.__deserialize<boolean>(lastIndex, srcStart), offsetof<this>("isVerified"));
                      keyStart = 0;
                      break;
                    } else {
                      keyStart = 0;
                      break;
                    }
                  }

                  case 6: {
                    const code48 = load<u64>(keyStart) & 281474976710655;
                    if (code48 == 433798447201) {
                      store<i32>(changetype<usize>(out), JSON.__deserialize<i32>(lastIndex, srcStart), offsetof<this>("age"));
                      keyStart = 0;
                      break;
                    } else if (code48 == 493928513648) {
                      store<Vec3 | null>(changetype<usize>(out), JSON.__deserialize<Vec3 | null>(lastIndex, srcStart), offsetof<this>("pos"));
                      keyStart = 0;
                      break;
                    } else {
                      keyStart = 0;
                      break;
                    }
                  }

                  case 16: {
                    const codeS8 = load<u64>(keyStart, 0);
                    const codeS16 = load<u64>(keyStart, 8);
                    if (codeS8 == 32651591226032236 && codeS16 == 28429440805568590) {
                      store<string>(changetype<usize>(out), JSON.__deserialize<string>(lastIndex, srcStart), offsetof<this>("lastName"));
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
                switch (<u32>keyEnd - <u32>keyStart) {
                  case 20: {
                    const codeS8 = load<u64>(keyStart, 0);
                    const codeS16 = load<u64>(keyStart, 8);
                    const codeS20 = load<u32>(keyStart, 16);
                    if (codeS8 == 32651591226032236 && codeS16 == 29555370777313345 && codeS20 == 6619254) {
                      store<Array<i32>>(changetype<usize>(out), JSON.__deserialize<Array<i32>>(lastIndex, srcStart), offsetof<this>("lastActive"));
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
            switch (<u32>keyEnd - <u32>keyStart) {
              case 20: {
                const codeS8 = load<u64>(keyStart, 0);
                const codeS16 = load<u64>(keyStart, 8);
                const codeS20 = load<u32>(keyStart, 16);
                if (codeS8 == 28429342022500457 && codeS16 == 29555310648164466 && codeS20 == 6553701) {
                  store<boolean>(changetype<usize>(out), true, offsetof<this>("isVerified"));
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
            switch (<u32>keyEnd - <u32>keyStart) {
              case 20: {
                const codeS8 = load<u64>(keyStart, 0);
                const codeS16 = load<u64>(keyStart, 8);
                const codeS20 = load<u32>(keyStart, 16);
                if (codeS8 == 28429342022500457 && codeS16 == 29555310648164466 && codeS20 == 6553701) {
                  store<boolean>(changetype<usize>(out), false, offsetof<this>("isVerified"));
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
            switch (<u32>keyEnd - <u32>keyStart) {
              case 20: {
                const codeS8 = load<u64>(keyStart, 0);
                const codeS16 = load<u64>(keyStart, 8);
                const codeS20 = load<u32>(keyStart, 16);
                if (codeS8 == 32370111954878566 && codeS16 == 27303545189433460 && codeS20 == 6619245) {
                  store<usize>(changetype<usize>(out), 0, offsetof<this>("firstName"));
                  srcStart += 2;
                  keyStart = 0;
                  break;
                } else {
                  srcStart += 2;
                  keyStart = 0;
                  break;
                }
              }

              case 6: {
                const code48 = load<u64>(keyStart) & 281474976710655;
                if (code48 == 493928513648) {
                  store<usize>(changetype<usize>(out), 0, offsetof<this>("pos"));
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
const player: Player = {
  firstName: "Jairus",
  lastName: "Tanaka",
  lastActive: [3, 9, 2025],
  age: 18,
  pos: {
    x: 3.4,
    y: 1.2,
    z: 8.3,
  },
  isVerified: true,
};
const serialized = JSON.stringify<Player>(player);
const deserialized = JSON.parse<Player>(serialized);
console.log("Serialized    " + serialized);
console.log("Deserialized  " + JSON.stringify(deserialized));
