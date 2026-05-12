import { instantiate } from "as-test/lib";

const imports = {};

instantiate(imports)
  .then((instance) => {
    instance.exports.start?.();
    // Add extra startup logic here when needed.
  })
  .catch((error) => {
    throw new Error("Failed to run bindings module: " + String(error));
  });
