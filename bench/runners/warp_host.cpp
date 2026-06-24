// Custom WARP (wasm-ecosystem/wasm-compiler) host for the cross-runtime
// benchmark. Unlike WARP's stock `vb_bench` (which links no imports and times an
// export externally), this host links the `env` functions the json-as bench lib
// needs - performance.now / Date.now / console.log / writeFile / abort - so WARP
// runs the *real* bench() loop and self-measures exactly like every other
// runtime, emitting the same `__AS_BENCH_JSON__` result lines.
//
// WARP has no WASI and - by design ("no recursions", static execution context) -
// cannot re-enter the module from inside a host import, so readFile (which would
// have to call the wasm __new allocator) is impossible. The WARP bench build
// therefore embeds its payload instead of reading a file; the measured
// deserialize/serialize work is identical. WARP also destabilizes under one long
// single-shot allocation loop, so run-bench.runtimes.sh builds with BENCH_FRAMES
// (the bench lib splits the timed run into small GC-separated frames).
//
// Build (links the static libs from a WARP build tree, see run-bench.runtimes.sh):
//   g++ -std=gnu++14 -O2 -DJIT_TARGET_X86_64 -DINTERRUPTION_REQUEST=0 \
//     -DEAGER_ALLOCATION=1 -I"$WARP_SRC" warp_host.cpp \
//     -Wl,--start-group <libWasmModule|libcompiler|libruntime|libutils|lib_core_common>.a \
//     -Wl,--end-group -lpthread -o warp_host
//
// Usage: warp_host <module.wasm>
//   Prints whatever the bench writes (progress + __AS_BENCH_JSON__<path>\t<json>).
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

#include "src/WasmModule/WasmModule.hpp"
#include "src/core/common/NativeSymbol.hpp"
#include "src/core/common/function_traits.hpp"
#include "src/utils/STDCompilerLogger.hpp"

using namespace vb;
using Clock = std::chrono::high_resolution_clock;

namespace {
WasmModule *g_module = nullptr;
Clock::time_point g_epoch;

// Reads an AssemblyScript string (UTF-16LE, byte-length stored as the u32 at
// ptr-4) out of linear memory and returns it as UTF-8.
std::string liftString(uint32_t ptr) {
  if (ptr == 0U || g_module == nullptr) return std::string();
  uint8_t const *lenField = g_module->getLinearMemoryRegion(ptr - 4U, 4U);
  uint32_t byteLen = 0U;
  std::memcpy(&byteLen, lenField, 4U);
  if (byteLen == 0U) return std::string();
  uint8_t const *data = g_module->getLinearMemoryRegion(ptr, byteLen);
  std::string out;
  out.reserve(byteLen / 2U);
  for (uint32_t i = 0U; i + 1U < byteLen; i += 2U) {
    uint32_t cu = static_cast<uint32_t>(data[i]) | (static_cast<uint32_t>(data[i + 1U]) << 8);
    // Minimal UTF-16 -> UTF-8 (the bench's strings are ASCII JSON + log text;
    // surrogate pairs are passed through per-unit, which is fine for output).
    if (cu < 0x80U) {
      out.push_back(static_cast<char>(cu));
    } else if (cu < 0x800U) {
      out.push_back(static_cast<char>(0xC0U | (cu >> 6)));
      out.push_back(static_cast<char>(0x80U | (cu & 0x3FU)));
    } else {
      out.push_back(static_cast<char>(0xE0U | (cu >> 12)));
      out.push_back(static_cast<char>(0x80U | ((cu >> 6) & 0x3FU)));
      out.push_back(static_cast<char>(0x80U | (cu & 0x3FU)));
    }
  }
  return out;
}

// --- env imports the bench lib calls (none re-enter the module) -------------
double host_performance_now(void *) noexcept {
  return std::chrono::duration<double, std::milli>(Clock::now() - g_epoch).count();
}
double host_date_now(void *) noexcept {
  return std::chrono::duration<double, std::milli>(Clock::now().time_since_epoch()).count();
}
void host_console_log(uint32_t ptr, void *) noexcept { printf("%s\n", liftString(ptr).c_str()); }

// dumpToFile() calls writeFile(path, json). The env build's path is
// ./build/logs/as/<mode>/<suite>.<type>.as.json; re-emit it as an
// __AS_BENCH_JSON__ line so run-bench.runtimes.sh routes it to runtimes/warp/.
void host_write_file(uint32_t namePtr, uint32_t dataPtr, void *) noexcept {
  printf("__AS_BENCH_JSON__%s\t%s\n", liftString(namePtr).c_str(), liftString(dataPtr).c_str());
}
void host_abort(uint32_t msg, uint32_t file, uint32_t line, uint32_t col, void *) noexcept {
  printf("abort: %s in %s:%u:%u\n", liftString(msg).c_str(), liftString(file).c_str(), line, col);
  std::exit(1);
}

std::vector<uint8_t> loadFile(char const *path) {
  FILE *f = fopen(path, "rb");
  if (f == nullptr) {
    fprintf(stderr, "warp_host: cannot open %s\n", path);
    std::exit(1);
  }
  fseek(f, 0, SEEK_END);
  long n = ftell(f);
  rewind(f);
  std::vector<uint8_t> buf(static_cast<size_t>(n));
  size_t rd = fread(buf.data(), 1U, buf.size(), f);
  (void)rd;
  fclose(f);
  return buf;
}
} // namespace

int main(int argc, char **argv) {
  if (argc < 2) {
    fprintf(stderr, "usage: warp_host <module.wasm>\n");
    return 1;
  }
  std::vector<uint8_t> bytecode = loadFile(argv[1]);
  g_epoch = Clock::now();

  WasmModule::initEnvironment(&malloc, &realloc, &free);
  STDCompilerLogger logger{};
  WasmModule module(UINT64_MAX, logger, false, nullptr, 0U);
  g_module = &module;

  // V1 imports (statically linked at compile time -> pass to compile(), and an
  // EMPTY span to initFromCompiledBinary, which rejects STATIC symbols).
  auto imports = make_array(
      STATIC_LINK("env", "performance.now", host_performance_now),
      STATIC_LINK("env", "Date.now", host_date_now),
      STATIC_LINK("env", "console.log", host_console_log),
      STATIC_LINK("env", "writeFile", host_write_file),
      STATIC_LINK("env", "abort", host_abort));
  Span<NativeSymbol const> importSpan(imports.data(), imports.size());

  try {
    WasmModule::CompileResult compiled{module.compile(
        Span<uint8_t const>(bytecode.data(), static_cast<uint32_t>(bytecode.size())), importSpan)};
    module.initFromCompiledBinary(compiled.getModule().span(), Span<NativeSymbol const>(), Span<uint8_t const>());
    module.start(nullptr); // runs the bench (all work happens in the start section)
  } catch (std::exception const &e) {
    fprintf(stderr, "warp_host: %s\n", e.what());
    return 1;
  }
  return 0;
}
