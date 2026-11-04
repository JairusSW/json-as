// Runtime CLIs do not all use the same version subcommand.
export function runtimeVersionArgs(runtime) {
  return runtime === "wavm" || runtime === "wazero"
    ? ["version"]
    : ["--version"];
}
