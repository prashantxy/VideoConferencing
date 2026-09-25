import type { NextConfig } from "next";

const backendUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  // API calls go through /api on the front-end's own domain, so the backend's
  // httpOnly session cookie is first-party (Safari blocks cross-site cookies).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/:path*` }];
  },
};

export default nextConfig;
