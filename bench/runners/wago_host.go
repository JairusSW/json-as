// Command wago_host runs a generated json-as runtime benchmark on WAGO.
//
// The benchmark keeps timing inside WebAssembly. This host only supplies the
// small env ABI used by the AssemblyScript bench library and forwards result
// records to stdout for scripts/run-bench.runtimes.sh.
package main

import (
	"encoding/binary"
	"fmt"
	"os"
	"time"
	"unicode/utf16"

	wago "github.com/wago-org/wago"
)

var epoch = time.Now()

func liftString(m wago.HostModule, ptr uint32) string {
	mem := m.Memory()
	if ptr == 0 || ptr < 4 || uint64(ptr) > uint64(len(mem)) {
		return ""
	}

	byteLen := binary.LittleEndian.Uint32(mem[ptr-4 : ptr])
	end := uint64(ptr) + uint64(byteLen)
	if byteLen%2 != 0 || end > uint64(len(mem)) {
		return ""
	}

	units := make([]uint16, byteLen/2)
	for i := range units {
		off := int(ptr) + i*2
		units[i] = binary.LittleEndian.Uint16(mem[off : off+2])
	}
	return string(utf16.Decode(units))
}

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "wago_host: "+format+"\n", args...)
	os.Exit(1)
}

func trace(message string) {
	if os.Getenv("WAGO_HOST_TRACE") != "" {
		fmt.Fprintln(os.Stderr, "wago_host:", message)
	}
}

func main() {
	if len(os.Args) != 2 {
		fail("usage: wago_host <module.wasm>")
	}

	wasm, err := os.ReadFile(os.Args[1])
	if err != nil {
		fail("read module: %v", err)
	}
	if !wago.GuardPageSupported() {
		fail("guard-page bounds are unavailable; build with -tags wago_guardpage")
	}

	trace("compiling module")
	config := wago.NewRuntimeConfig().WithBoundsChecks(wago.BoundsChecksSignalsBased)
	compiled, err := wago.Compile(config, wasm)
	if err != nil {
		fail("compile module: %v", err)
	}
	defer compiled.Close()
	trace("module compiled")

	imports := wago.Imports{
		"env.performance.now": wago.HostFunc(func(_ wago.HostModule, _ []uint64, results []uint64) {
			results[0] = wago.F64(float64(time.Since(epoch).Nanoseconds()) / 1e6)
		}),
		"env.Date.now": wago.HostFunc(func(_ wago.HostModule, _ []uint64, results []uint64) {
			results[0] = wago.F64(float64(time.Now().UnixNano()) / 1e6)
		}),
		"env.console.log": wago.HostFunc(func(m wago.HostModule, params, _ []uint64) {
			fmt.Println(liftString(m, uint32(params[0])))
		}),
		"env.writeFile": wago.HostFunc(func(m wago.HostModule, params, _ []uint64) {
			name := liftString(m, uint32(params[0]))
			data := liftString(m, uint32(params[1]))
			fmt.Printf("__AS_BENCH_JSON__%s\t%s\n", name, data)
		}),
		"env.abort": wago.HostFunc(func(m wago.HostModule, params, _ []uint64) {
			fmt.Fprintf(
				os.Stderr,
				"abort: %s in %s:%d:%d\n",
				liftString(m, uint32(params[0])),
				liftString(m, uint32(params[1])),
				uint32(params[2]),
				uint32(params[3]),
			)
			panic(wago.HostExit{Code: 1})
		}),
	}

	trace("instantiating module")
	instance, err := wago.Instantiate(compiled, wago.InstantiateOptions{Imports: imports})
	if err != nil {
		fail("instantiate module: %v", err)
	}
	defer instance.Close()
	trace("module instantiated")

	// The module is built with --exportStart so initialization and the full
	// benchmark run through WAGO's normal exported-function invocation path.
	trace("running benchmark")
	if _, err := instance.Invoke("start"); err != nil {
		fail("run benchmark: %v", err)
	}
	trace("benchmark finished")
}
