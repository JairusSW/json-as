function get_mask_chars(src: string, mask: u64): void {
  const srcPtr = changetype<usize>(src);
  while (mask != 0) {
    const laneIdx = usize(ctz(mask) >> 3);
    mask &= ~(0xffff << (laneIdx << 3));
    // mask &= mask - 1;
    console.log("Lane:  " + laneIdx.toString());
    const srcIdx = srcPtr + laneIdx;
    const chunk = load<u32>(srcIdx);
    const code = <u16>(chunk >> 16);

    console.log("Chunk: " + String.fromCharCode(chunk & 0xffff) + String.fromCharCode(chunk >> 16));
    console.log("Code:  " + String.fromCharCode(load<u16>(srcIdx)));
  }
}

function backslash_or_quote_mask(block: u64): u64 {
  const b = block ^ 0x005c_005c_005c_005c;
  const q = block ^ 0x0022_0022_0022_0022;
  return (((q - 0x0001_0001_0001_0001) & ~q) | ((b - 0x0001_0001_0001_0001) & ~b)) & 0x0080_0080_0080_0080;
}

const input = '\\"a"';
get_mask_chars(input, backslash_or_quote_mask(load<u64>(changetype<usize>(input))));
