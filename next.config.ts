import type { NextConfig } from "next";
import type { webpack } from "next/dist/compiled/webpack/webpack";
import type { Header } from "next/dist/lib/load-custom-routes";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Partial Prerendering - improves TTFB by streaming static shell
    // Requires Next.js 15+ canary version - disabled for stability
    // ppr: true,
    
    // Dynamic IO - enables async/await in Server Components
    // Renamed to cacheComponents in newer versions
    // dynamicIO: true,
  },
  webpack: (config, { isServer }): webpack.Configuration => {
    // Exclude playwright from client-side bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        playwright: false,
        net: false,
        tls: false,
        fs: false,
        crypto: false,
      };
    }
    // Exclude problematic modules from webpack processing
    config.externals.push(
      /^playwright-core/,
      /^chromium-bidi/,
      /^nodemailer/,
      /^tesseract\.js/,
      /^pdf2pic/
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
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  poweredByHeader: false,
  async headers(): Promise<Header[]> {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
      process.env.NEXTAUTH_URL || "http://localhost:3000",
    ];
    
    const corsOrigin = process.env.NODE_ENV === "production" 
      ? allowedOrigins.join(", ")
      : "*";
    
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: corsOrigin,
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-Requested-With",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
          {
            key: "Access-Control-Max-Age",
            value: "86400",
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
