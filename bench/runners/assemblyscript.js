const bytes = readbuffer("./build/" + arguments[0]);
const module = new WebAssembly.Module(bytes);
let memory = null;
const { exports } = new WebAssembly.Instance(module, {
  env: {
    abort: (msg, file, line) => {
      console.log("abort: " + __liftString(msg) + " in " + __liftString(file) + ":" + __liftString(line));
    },
    "console.log": (ptr) => {
      console.log(__liftString(ptr));
    },
    "Date.now": () => Date.now(),
    "performance.now": () => performance.now(),
    "writeFile": (fileName, data) => {
      fileName = __liftString(fileName)
      data = __liftString(data);
      writeFile(fileName, data);
    }
  },
});

memory = exports.memory;

function __liftString(pointer) {
  if (!pointer) return null;
  const end = (pointer + new Uint32Array(memory.buffer)[(pointer - 4) >>> 2]) >>> 1,
    memoryU16 = new Uint16Array(memory.buffer);
  let start = pointer >>> 1,
    string = "";
  while (end - start > 1024) string += String.fromCharCode(...memoryU16.subarray(start, (start += 1024)));
  return string + String.fromCharCode(...memoryU16.subarray(start, end));
}

exports.start();