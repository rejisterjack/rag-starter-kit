import type { NextConfig } from "next";
import type { webpack } from "next/dist/compiled/webpack/webpack";
import type { Header } from "next/dist/lib/load-custom-routes";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Partial Prerendering - improves TTFB by streaming static shell
    // Requires Next.js 15+ with compatible app structure
    ppr: true,
    
    // Dynamic IO - enables async/await in Server Components
    dynamicIO: true,
  },
  webpack: (config, { isServer }): webpack.Configuration => {
    // Exclude playwright from client-side bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        playwright: false,
      };
    }
    // Exclude problematic modules from webpack processing
    config.externals.push(
      /^playwright-core/,
      /^chromium-bidi/
    );
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  poweredByHeader: false,
  async headers(): Promise<Header[]> {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
      // PWA headers
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
