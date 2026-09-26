/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit reads font metric files from disk at runtime - keep it out of the bundle
  serverExternalPackages: ["pdfkit"],
  // ship the report fonts with the server output
  outputFileTracingIncludes: {
    "/api/gmb/[id]/report": ["./lib/reports/fonts/**"],
    "/api/reports/**": ["./lib/reports/fonts/**"],
  },
  poweredByHeader: false,
  // security headers are set in proxy.js
};

export default nextConfig;
