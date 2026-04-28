import { defineConfig } from "vitest/config"

const nodeMajor = Number(process.versions.node.split(".")[0])
const execArgv = nodeMajor >= 25 ? ["--no-webstorage"] : []

export default defineConfig({
  test: {
    pool: "forks",
    poolOptions: { forks: { execArgv } },
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/index.ts"],
    },
    environmentMatchGlobs: [
      ["src/client/**", "jsdom"],
      ["src/ui/**", "jsdom"],
    ],
    environmentOptions: {
      jsdom: { url: "http://localhost/" },
    },
  },
})
