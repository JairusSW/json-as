// Command wago-run executes a WASI Preview 1 benchmark with the Wago engine.
package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	wago "github.com/wago-org/wago"
	"github.com/wago-org/wasi/p1"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: wago-run <module.wasm>")
		os.Exit(2)
	}

	wasmPath := os.Args[1]
	wasm, err := os.ReadFile(wasmPath)
	if err != nil {
		fatal(err)
	}
	root, err := filepath.Abs(".")
	if err != nil {
		fatal(err)
	}

	compiled, err := wago.Compile(nil, wasm)
	if err != nil {
		fatal(err)
	}
	instance, err := wago.Instantiate(compiled, wago.InstantiateOptions{
		Imports: p1.Imports(p1.Config{
			Stdout:   os.Stdout,
			Stderr:   os.Stderr,
			Args:     []string{wasmPath},
			Preopens: map[string]string{"/": root},
			Now:      func() int64 { return time.Now().UnixNano() },
		}),
	})
	if err != nil {
		fatal(err)
	}
	defer instance.Close()

	if _, err = instance.Invoke("_start"); err != nil {
		var exit *wago.ExitError
		if !errors.As(err, &exit) || exit.Code != 0 {
			fatal(err)
		}
	}
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "wago-run:", err)
	os.Exit(1)
}
