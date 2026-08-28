/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["mysql2", "bcryptjs"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};
export default nextConfig;
