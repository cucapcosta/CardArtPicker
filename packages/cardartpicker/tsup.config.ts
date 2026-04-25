import { defineConfig } from "tsup"
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

const shared = {
  format: ["esm", "cjs"] as const,
  dts: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: ["react", "react-dom", "next", "cardartpicker/client"],
}

const CLIENT_FILES = [
  "dist/client/index.js",
  "dist/client/index.cjs",
  "dist/ui/index.js",
  "dist/ui/index.cjs",
]

export default defineConfig([
  {
    ...shared,
    entry: {
      "index": "src/index.ts",
      "sources/index": "src/sources/index.ts",
      "server/index": "src/server/index.ts",
    },
    clean: true,
  },
  {
    ...shared,
    entry: {
      "client/index": "src/client/index.ts",
      "ui/index": "src/ui/index.ts",
    },
    clean: false,
    async onSuccess() {
      for (const rel of CLIENT_FILES) {
        const path = join(process.cwd(), rel)
        try {
          const src = await readFile(path, "utf8")
          if (src.startsWith('"use client"')) continue
          await writeFile(path, `"use client";\n${src}`)
        } catch {}
      }
    },
  },
])
