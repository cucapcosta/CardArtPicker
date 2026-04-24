import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    "index": "src/index.ts",
    "sources/index": "src/sources/index.ts",
    "server/index": "src/server/index.ts",
    "client/index": "src/client/index.ts",
    "ui/index": "src/ui/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: ["react", "react-dom", "next"],
})
