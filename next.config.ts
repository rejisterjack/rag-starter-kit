import type { NextConfig } from "next";
import type { webpack } from "next/dist/compiled/webpack/webpack";
import type { Header } from "next/dist/lib/load-custom-routes";
import bundleAnalyzer from "@next/bundle-analyzer";
import createMDX from "@next/mdx";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = bundleAnalyzer({
	enabled: process.env.ANALYZE === "true",
});

const withMDX = createMDX({
	options: {
		jsx: true,
	},
});

const nextConfig: NextConfig = {
	output: 'standalone',

	compress: true,

	pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],

	turbopack: {
		resolveAlias: {
			nodemailer: './src/lib/empty-module.ts',
			pdf2pic: './src/lib/empty-module.ts',
			'file-type': './src/lib/empty-module.ts',
		},
	},

	experimental: {
		serverActions: {
			bodySizeLimit: '4mb',
		},

		staleTimes: {
			dynamic: 30,
			static: 300,
		},

		optimizePackageImports: [
			'recharts',
			'd3',
			'd3-drag',
			'd3-force',
			'd3-selection',
			'd3-transition',
			'd3-zoom',
			'@react-pdf/renderer',
			'lucide-react',
			'date-fns',
			'framer-motion',
			'react-markdown',
			'@tanstack/react-virtual',
			'@tanstack/react-query',
			'@radix-ui/react-icons',
			'cmdk',
			'sonner',
			'archiver',
			'docx',
			'dompurify',
			'i18next',
			'react-i18next',
			'zustand',
			'@hookform/resolvers',
			'react-hook-form',
			'react-day-picker',
			'elysia',
			'@sentry/nextjs',
			'zod',
		],
	},
	webpack: (config, { isServer }): webpack.Configuration => {
		config.infrastructureLogging = {
			...config.infrastructureLogging,
			level: 'error',
		};
		if (config.cache && typeof config.cache === 'object' && 'type' in config.cache && config.cache.type === 'filesystem') {
			config.cache.compression = process.env.NODE_ENV === 'production' ? 'gzip' : false;
		}

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
		config.externals.push(
			/^playwright-core/,
			/^chromium-bidi/,
			/^nodemailer/,
			/^tesseract\.js/,
			/^pdf2pic/,
			/^pg-native/,
			/^@aws-sdk\/client-kms/,
			/^@xenova\/transformers/,
			/^sharp/,
			/^isolated-vm/,
			/^samlify/,
			/^ably/,
		);

		config.resolve.alias = {
			...config.resolve.alias,
			'thread-stream': false,
			'pg-native': false,
			'@opentelemetry/exporter-jaeger': false,
			'@opentelemetry/winston-transport': false,
		};

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
			{
				protocol: "https",
				hostname: "res.cloudinary.com",
			},
		],
		formats: ["image/avif", "image/webp"],
	},
	poweredByHeader: false,

	serverExternalPackages: [
		'nodemailer',
		'pdf2pic',
		'tesseract.js',
		'sharp',
		'isolated-vm',
		'samlify',
		'ably',
		'@xenova/transformers',
		'@aws-sdk/client-kms',
		'pg-native',
	],

	async headers(): Promise<Header[]> {
		return [
			{
				source: "/:path*",
				headers: [
					{ key: "X-Frame-Options", value: "DENY" },
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
				{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
					{ key: "Cross-Origin-Opener-Policy", value: "same-origin" },
					{ key: "Cross-Origin-Resource-Policy", value: "same-origin" },
					{ key: "X-Permitted-Cross-Domain-Policies", value: "none" },
					{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()" },
				],
			},
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

const isDev = process.env.NODE_ENV === 'development';
export default !isDev && process.env.SENTRY_DSN
  ? withSentryConfig(withBundleAnalyzer(withMDX(nextConfig)), {
      silent: true,
    })
  : withBundleAnalyzer(withMDX(nextConfig));
