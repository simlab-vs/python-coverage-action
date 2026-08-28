import { defineConfig } from "tsdown";

// Bundles the action and all its dependencies into dist/index.js, the single
// file action.yml points at. GitHub runs it directly, without node_modules.
export default defineConfig({
  entry: { index: "src/action.ts" },
  format: "cjs",
  platform: "node",
  outDir: "dist",
  noExternal: [/.*/],
  dts: false,
  clean: true,
  outExtensions: () => ({ js: ".js" }),
});
