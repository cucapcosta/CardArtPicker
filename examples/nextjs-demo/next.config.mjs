/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["cardartpicker"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
}
export default nextConfig
