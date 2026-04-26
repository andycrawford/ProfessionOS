import type { NextConfig } from "next";

// Production app domain: https://app.professionos.com
// Marketing site apex: https://professionos.com (www redirects to apex in HTML)
const MARKETING_ORIGIN = "https://professionos.com";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        // Allow the marketing site (apex only — www redirects to apex) to call app APIs.
        // Note: Access-Control-Allow-Origin accepts a single origin; dynamic multi-origin
        // support would require middleware.
        source: "/api/(.*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: MARKETING_ORIGIN,
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
