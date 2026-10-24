// Test-only dependency boundaries. Original application modules execute with
// native Node coverage; this helper never writes coverage data or release bytes.
import filesystem from "node:fs/promises";
import { registerHooks, syncBuiltinESMExports } from "node:module";
import { fileURLToPath } from "node:url";

const mode = new URL(import.meta.url).searchParams.get("mode");
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier === "../lib/contract.mjs" &&
      context.parentURL?.endsWith("/src/release-validator.mjs")
    ) {
      // The validator source is the unchanged release template. Its dependency
      // lives in releases/ after packaging, not beside the source template.
      return nextResolve(
        new URL("../releases/0.1.0/lib/contract.mjs", context.parentURL).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
});

const read = filesystem.readFile;
let manifestReads = 0;
filesystem.readFile = async (filename, ...options) => {
  const value = await read(filename, ...options);
  const path =
    filename instanceof URL ? fileURLToPath(filename) : String(filename);
  if (
    mode === "schema-without-newline" &&
    path.endsWith("/schema/kolibri-contract.schema.json")
  ) {
    return value.replace(/\n$/, "");
  }
  if (
    mode === "unequal-build-reads" &&
    path.endsWith("/releases/0.1.0/manifest.json") &&
    ++manifestReads === 2
  ) {
    return `${value} `;
  }
  return value;
};
syncBuiltinESMExports();
