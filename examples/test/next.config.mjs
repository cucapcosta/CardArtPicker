import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: join(__dirname, "../.."),
  transpilePackages: ["cardartpicker"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
}
export default nextConfig
