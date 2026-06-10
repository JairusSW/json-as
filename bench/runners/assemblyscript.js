// @ts-expect-error: readbuffer is defined in d8
// @eslint-disable-next-line
const bytes = readbuffer("./build/" + arguments[0]);

// Extract the `heapAnalyzerInfo` custom section the as-heap-analyzer transform
// emits - `{heapBase, classInfo: {<id>: <name>}}`. When --memory is on, every
// "heap:" line printed by bench.ts is rewritten to substitute names for IDs so
// the user doesn't have to invoke `npx as-heap-analyzer` afterward.
const HEAP_CLASS_NAMES = extractHeapAnalyzerClassInfo(new Uint8Array(bytes));

const module = new WebAssembly.Module(bytes);
let memory = null;
const ARRAYBUFFER_ID = 1;
const { exports } = new WebAssembly.Instance(module, {
  env: {
    abort: (msg, file, line) => {
      console.log(
        "abort: " +
          __liftString(msg) +
          " in " +
          __liftString(file) +
          ":" +
          __liftString(line),
      );
    },
    "console.log": (ptr) => {
      console.log(rewriteHeapLine(__liftString(ptr)));
    },
    "Date.now": () => Date.now(),
    "performance.now": () => performance.now(),
    writeFile: (fileName, data) => {
      fileName = __liftString(fileName);
      data = __liftString(data);
      writeFile(fileName, data);
    },
    readFile: (filePath) => {
      filePath = __liftString(filePath);
      const data = readbuffer(filePath);
      return __lowerBuffer(data);
    },
  },
});

memory = exports.memory;

function __liftString(pointer) {
  if (!pointer) return null;
  const end =
      (pointer + new Uint32Array(memory.buffer)[(pointer - 4) >>> 2]) >>> 1,
    memoryU16 = new Uint16Array(memory.buffer);
  let start = pointer >>> 1,
    string = "";
  while (end - start > 1024)
    string += String.fromCharCode(
      ...memoryU16.subarray(start, (start += 1024)),
    );
  return string + String.fromCharCode(...memoryU16.subarray(start, end));
}

function __lowerBuffer(value) {
  if (value == null) return 0;
  const pointer = exports.__new(value.byteLength, ARRAYBUFFER_ID) >>> 0;
  new Uint8Array(memory.buffer).set(new Uint8Array(value), pointer);
  return pointer;
}

exports.start();

// --- heap-analyzer custom-section parsing ---

// Returns {<runtimeId: number>: <className: string>} when the wasm was built
// with the `addHeapAnalyzerInfo` transform; returns null otherwise.
function extractHeapAnalyzerClassInfo(buf) {
  // Magic (\0asm) + version
  if (
    buf.length < 8 ||
    buf[0] !== 0x00 ||
    buf[1] !== 0x61 ||
    buf[2] !== 0x73 ||
    buf[3] !== 0x6d
  ) {
    return null;
  }
  let p = 8;
  while (p < buf.length) {
    const id = buf[p++];
    const [size, after] = readVarUint32(buf, p);
    p = after;
    const sectionEnd = p + size;
    if (id === 0) {
      // Custom section: name length (varuint32) + name + payload
      const [nameLen, afterNameLen] = readVarUint32(buf, p);
      const nameStart = afterNameLen;
      const nameEnd = nameStart + nameLen;
      const name = bytesToUtf8(buf, nameStart, nameEnd);
      if (name === "heapAnalyzerInfo") {
        const payload = bytesToUtf8(buf, nameEnd, sectionEnd);
        try {
          const parsed = JSON.parse(payload);
          return parsed && parsed.classInfo ? parsed.classInfo : null;
        } catch {
          return null;
        }
      }
    }
    p = sectionEnd;
  }
  return null;
}

function readVarUint32(buf, p) {
  let result = 0;
  let shift = 0;
  for (;;) {
    const b = buf[p++];
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) return [result >>> 0, p];
    shift += 7;
  }
}

// AS class identifiers (module paths + names) are guaranteed ASCII, so a
// per-byte fromCharCode loop suffices - no TextDecoder needed.
function bytesToUtf8(buf, start, end) {
  let s = "";
  for (let i = start; i < end; i++) s += String.fromCharCode(buf[i]);
  return s;
}

// Rewrites '   heap: {...,"classDelta":{"3":1024,"7":-512}}' so numeric IDs
// become the names from the custom section. Leaves all other lines alone.
function rewriteHeapLine(line) {
  if (!HEAP_CLASS_NAMES || !line) return line;
  if (line.indexOf('"classDelta":{') === -1) return line;
  return line.replace(/"(\d+)":(-?\d+)/g, (m, id, val) => {
    const name = HEAP_CLASS_NAMES[id];
    return name ? `"${name}":${val}` : m;
  });
}
