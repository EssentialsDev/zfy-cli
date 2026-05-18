import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "cli/index": "src/cli/index.ts",
    "mcp/server": "src/mcp/server.ts",
    "sdk/index": "src/sdk/index.ts",
  },
  format: ["esm"],
  target: "node20",
  dts: { entry: { "sdk/index": "src/sdk/index.ts" } },
  splitting: false,
  clean: true,
  shims: true,
  banner: ({ format }) => (format === "esm" ? { js: "#!/usr/bin/env node" } : {}),
});
