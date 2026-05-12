// Feel free to edit this file!
// Runner files use the name <mode>.<type>.js, where <type> is bindings, wasi, or web.
// To create a runner for another mode, copy this file to <new-mode>.<type>.js.

import { instantiate } from "as-test/lib";

let exports = null;
const imports = {};

instantiate(imports)
  .then((instance) => {
    exports = instance.exports;
    instance.exports.start?.();
    // Add extra startup logic here when needed.
  })
  .catch((error) => {
    throw new Error("Failed to run web module: " + String(error));
  });
