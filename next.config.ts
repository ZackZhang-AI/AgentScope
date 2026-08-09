import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  devIndicators: false,
  async redirects() {
    return [
      { source: "/en", destination: "/", permanent: true },
      { source: "/en/:path*", destination: "/:path*", permanent: true },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/en" },
        { source: "/audit", destination: "/en/audit" },
        { source: "/case-study", destination: "/en/case-study" },
        { source: "/demos/:path*", destination: "/en/demos/:path*" },
        { source: "/runs/:path*", destination: "/en/runs/:path*" },
        { source: "/workbench", destination: "/en/workbench" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
