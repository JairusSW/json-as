class Test {
  a: string;
  b: string;
}

// @ts-expect-error: decorator
@inline function deserializeTest_NAIVE(
  srcStart: usize,
  srcEnd: usize,
  dst: Test,
): usize {
  // fast path
  do {
    if (
      load<u64>(srcStart) != load<u64>(changetype<usize>('{"a"')) ||
      load<u16>(srcStart, 8) != 0x3a
    )
      break;
    srcStart += 10;
    srcStart += deserializeString_NAIVE(srcStart, srcEnd); // this needs to somehow return an error (perhaps usize.MAX_VALUE) and also deserialize to the a field in dst.
    if (
      load<u64>(srcStart) != load<u64>(changetype<usize>(',"b"')) ||
      load<u16>(srcStart, 8) != 0x3a
    )
      break;
    srcStart += 10;
    srcStart += deserializeString_NAIVE(srcStart, srcEnd);
  } while (false);
  // have slow path here
}
