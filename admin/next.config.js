/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const apiBaseURL = (process.env.ADMIN_API_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
    return [{ source: "/api/backend/:path*", destination: `${apiBaseURL}/:path*` }];
  },
};

module.exports = nextConfig;
