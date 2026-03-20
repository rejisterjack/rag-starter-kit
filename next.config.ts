import type { NextConfig } from "next";
import type { webpack } from "next/dist/compiled/webpack/webpack";
import type { Header } from "next/dist/lib/load-custom-routes";
import { withSentryConfig } from "@sentry/nextjs";

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
	typescript: {
		ignoreBuildErrors: true,
	},
	eslint: {
		ignoreDuringBuilds: true,
	},
	poweredByHeader: false,

	// Sentry source maps configuration
	productionBrowserSourceMaps: true,

	async headers(): Promise<Header[]> {
		const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
			process.env.NEXTAUTH_URL || "http://localhost:3000",
		];

		const corsOrigin =
			process.env.NODE_ENV === "production"
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

// Sentry configuration options
const sentryWebpackPluginOptions = {
	// For all available options, see:
	// https://github.com/getsentry/sentry-webpack-plugin#options

	// Suppresses source map uploading logs during build
	silent: true,

	// Organization and project settings
	org: process.env.SENTRY_ORG || undefined,
	project: process.env.SENTRY_PROJECT || undefined,

	// Auth token for build-time source map upload
	// This should be set as SENTRY_AUTH_TOKEN env variable
	authToken: process.env.SENTRY_AUTH_TOKEN,

	// Release version - auto-detected from git by default
	// Can be overridden with SENTRY_RELEASE env variable
	release: {
		name: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,
	},

	// Upload source maps
	sourcemaps: {
		assets: "./.next/**/*",
		ignore: ["node_modules/**/*"],
	},

	// Enable telemetry
	telemetry: true,

	// Tunnel events through your own server (optional, helps with ad blockers)
	// tunnelRoute: "/monitoring",

	// Hides source maps from generated client bundles
	hideSourceMaps: true,

	// Automatically tree-shake Sentry logger statements to reduce bundle size
	disableLogger: process.env.NODE_ENV === "production",

	// Enables automatic instrumentation of Vercel Cron Monitors
	// See: https://vercel.com/docs/cron-jobs
	automaticVercelMonitors: true,

	// Widen the upload plugin options
	widenClientFileUpload: true,
	reactComponentAnnotation: {
		enabled: true,
	},
};

// Export the config wrapped with Sentry
// Use SENTRY_DISABLE_BUILD_PLUGIN to skip Sentry during build
const isSentryDisabled =
	process.env.SENTRY_DISABLE_BUILD_PLUGIN === "true" ||
	!process.env.SENTRY_DSN;

export default isSentryDisabled
	? nextConfig
	: withSentryConfig(nextConfig, sentryWebpackPluginOptions);
