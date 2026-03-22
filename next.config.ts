import type { NextConfig } from "next";
import type { webpack } from "next/dist/compiled/webpack/webpack";
import type { Header } from "next/dist/lib/load-custom-routes";
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
	output: "standalone",
	experimental: {
		// Partial Prerendering - improves TTFB by streaming static shell
		// Requires Next.js 15+ canary version - disabled for stability
		// ppr: true,

		// Dynamic IO - enables async/await in Server Components
		// Renamed to cacheComponents in newer versions
		// dynamicIO: true,

		// Optimize package imports for better tree-shaking
		optimizePackageImports: [
			'recharts',
			'd3',
			'gsap',
			'@react-pdf/renderer',
			'tesseract.js',
			'lucide-react',
			'date-fns',
		],
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
			/^pdf2pic/,
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
	poweredByHeader: false,

	async headers(): Promise<Header[]> {
		// Note: Access-Control-Allow-Origin is now handled dynamically in middleware.ts
		// to properly handle multiple allowed origins per the HTTP spec
		return [
			{
				source: "/api/:path*",
				headers: [
					// CORS headers are set dynamically in middleware.ts
					// This fixes the invalid multi-value Access-Control-Allow-Origin header issue
					{
						key: "Access-Control-Allow-Methods",
						value: "GET, POST, PUT, DELETE, OPTIONS",
					},
					{
						key: "Access-Control-Allow-Headers",
						value: "Content-Type, Authorization, X-Requested-With, X-Request-ID, X-API-Key, X-CSRF-Token",
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

// Sentry configuration
const sentryWebpackPluginOptions = {
	// Sentry org/project settings
	org: process.env.SENTRY_ORG || undefined,
	project: process.env.SENTRY_PROJECT || undefined,

	// Only print logs for uploading source maps in CI
	silent: !process.env.CI,

	// Upload a larger set of source maps for prettier stack traces (increases build time)
	widenClientFileUpload: true,

	// Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers
	tunnelRoute: "/monitoring",

	// Hides source maps from generated client bundles
	hideSourceMaps: true,

	// Automatically tree-shake Sentry logger statements to reduce bundle size	disableLogger: true,

	// Enables automatic instrumentation of Vercel Cron Monitors
	automaticVercelMonitors: true,
};

// Export wrapped config
export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
