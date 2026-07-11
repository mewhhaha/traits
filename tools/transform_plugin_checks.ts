import { assert_equals, assert_true } from "../src/assert.ts";
import { build } from "esbuild";
import {
  typeclasses_esbuild_plugin,
  typeclasses_rollup_plugin,
} from "./transform_plugin.ts";

Deno.test("transform plugin lowers TypeScript through Rollup and esbuild-shaped adapters", () => {
  const source = `
import { Do } from "../src/typeclasses.ts";
const value = Do(Maybe, function* () { return 42; });
`;
  const warnings: string[] = [];
  const rollup = typeclasses_rollup_plugin();
  const transformed = rollup.transform.call(
    { warn: (message) => warnings.push(message) },
    source,
    "fixture.ts",
  );
  assert_true(
    transformed !== null,
    "expected Rollup adapter to handle TypeScript",
  );
  if (transformed === null) {
    throw new Error("expected Rollup adapter to handle TypeScript");
  }
  assert_true(
    !transformed.code.includes("function*"),
    "expected generator to lower\n\n" + transformed.code,
  );
  assert_equals(warnings, []);

  let on_load:
    | ((args: { readonly path: string }) => Promise<unknown>)
    | undefined;
  typeclasses_esbuild_plugin().setup({
    onLoad(_options, callback) {
      on_load = callback;
    },
  });
  assert_true(
    on_load !== undefined,
    "expected esbuild adapter to register an onLoad hook",
  );
});

Deno.test({
  name: "esbuild bundles examples/monads.ts through the typeclasses plugin",
  permissions: { env: true, read: true, run: true },
  async fn() {
    const result = await build({
      entryPoints: [new URL("../examples/monads.ts", import.meta.url).pathname],
      bundle: true,
      format: "esm",
      platform: "neutral",
      write: false,
      // The library currently uses TypeScript's `out` type-parameter spelling,
      // which esbuild's parser rejects in transitive source modules. Keeping
      // those imports external still exercises the actual entry bundle and
      // plugin lowering path without changing library source for this smoke.
      external: ["../src/*"],
      plugins: [typeclasses_esbuild_plugin()],
    });
    const output = result.outputFiles[0]?.text;
    assert_true(output !== undefined, "expected esbuild output");
    if (output === undefined) throw new Error("expected esbuild output");
    assert_true(
      !output.includes("function*"),
      "expected transformed entry output to contain no generators\n\n" + output,
    );
  },
});
