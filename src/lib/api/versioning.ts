/**
 * API Versioning System
 *
 * Implements API versioning with:
 * - URL path versioning (/api/v1/...)
 * - Header-based versioning (Accept: application/vnd.api+json;version=1)
 * - Deprecation warnings
 * - Version compatibility checks
 *
 * Version Policy:
 * - v1: Current stable version
 * - Versions are supported for 12 months after a new version is released
 * - Deprecated versions return warning headers
 */

import { type NextRequest, NextResponse } from 'next/server';

// =============================================================================
// Configuration
// =============================================================================

export interface ApiVersion {
  version: string;
  status: 'stable' | 'deprecated' | 'sunset';
  releasedAt: Date;
  deprecatedAt?: Date;
  sunsetAt?: Date;
  changes: string[];
}

const API_VERSIONS: Record<string, ApiVersion> = {
  v1: {
    version: 'v1',
    status: 'stable',
    releasedAt: new Date('2024-01-01'),
    changes: ['Initial API release'],
  },
  // v2: {
  //   version: 'v2',
  //   status: 'stable',
  //   releasedAt: new Date('2024-06-01'),
  //   changes: ['New pagination format', 'Improved error responses'],
  // },
};

const CURRENT_VERSION = 'v1';
const DEFAULT_VERSION = 'v1';

// =============================================================================
// Version Detection
// =============================================================================

/**
 * Detect API version from request
 *
 * Priority:
 * 1. URL path (/api/v1/...)
 * 2. Accept header version parameter
 * 3. X-API-Version header
 * 4. Default version
 */
export function detectVersion(req: NextRequest): string {
  // Check URL path first
  const url = new URL(req.url);
  const pathMatch = url.pathname.match(/^\/api\/(v\d+)\//);
  if (pathMatch) {
    return pathMatch[1];
  }

  // Check Accept header
  const acceptHeader = req.headers.get('accept');
  if (acceptHeader) {
    const versionMatch = acceptHeader.match(/version=(\d+)/);
    if (versionMatch) {
      return `v${versionMatch[1]}`;
    }
  }

  // Check X-API-Version header
  const apiVersionHeader = req.headers.get('x-api-version');
  if (apiVersionHeader) {
    return apiVersionHeader.startsWith('v') ? apiVersionHeader : `v${apiVersionHeader}`;
  }

  return DEFAULT_VERSION;
}

// =============================================================================
// Version Validation
// =============================================================================

/**
 * Check if a version is valid and supported
 */
export function isValidVersion(version: string): boolean {
  return version in API_VERSIONS;
}

/**
 * Get version information
 */
export function getVersionInfo(version: string): ApiVersion | null {
  return API_VERSIONS[version] || null;
}

/**
 * Check if a version is deprecated
 */
export function isDeprecated(version: string): boolean {
  const info = getVersionInfo(version);
  return info?.status === 'deprecated' || info?.status === 'sunset';
}

/**
 * Check if a version is sunset (no longer available)
 */
export function isSunset(version: string): boolean {
  const info = getVersionInfo(version);
  return info?.status === 'sunset';
}

// =============================================================================
// Response Headers
// =============================================================================

/**
 * Get deprecation warning headers for a version
 */
export function getDeprecationHeaders(version: string): Record<string, string> {
  const headers: Record<string, string> = {
    'X-API-Version': version,
    'X-API-Current-Version': CURRENT_VERSION,
  };

  const info = getVersionInfo(version);
  if (!info) return headers;

  if (info.status === 'deprecated' && info.sunsetAt) {
    headers.Deprecation = `sunset="${info.sunsetAt.toISOString()}"`;
    headers.Sunset = info.sunsetAt.toISOString();
    headers.Warning = `299 - "This API version is deprecated. Please migrate to ${CURRENT_VERSION}."`;
  }

  if (info.status === 'sunset') {
    headers.Deprecation = 'true';
    headers.Warning = `299 - "This API version is no longer supported. Please use ${CURRENT_VERSION}."`;
  }

  return headers;
}

// =============================================================================
// Version Router
// =============================================================================

export type VersionedHandler = (req: NextRequest) => Promise<NextResponse>;

export interface VersionHandlers {
  [version: string]: VersionedHandler;
}

/**
 * Create a versioned route handler
 *
 * Usage:
 * ```typescript
 * export const GET = createVersionedRoute({
 *   v1: async (req) => {
 *     return NextResponse.json({ version: 'v1', data: [] });
 *   },
 *   v2: async (req) => {
 *     return NextResponse.json({ version: 'v2', data: [], meta: {} });
 *   },
 * });
 * ```
 */
export function createVersionedRoute(handlers: VersionHandlers): VersionedHandler {
  return async (req: NextRequest) => {
    const version = detectVersion(req);

    // Check if version exists
    if (!isValidVersion(version)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_VERSION',
            message: `API version '${version}' is not supported`,
            supportedVersions: Object.keys(API_VERSIONS),
          },
        },
        { status: 400 }
      );
    }

    // Check if version is sunset
    if (isSunset(version)) {
      return NextResponse.json(
        {
          error: {
            code: 'VERSION_SUNSET',
            message: `API version '${version}' is no longer supported`,
            currentVersion: CURRENT_VERSION,
          },
        },
        {
          status: 410,
          headers: getDeprecationHeaders(version),
        }
      );
    }

    // Get handler for version
    const handler = handlers[version];
    if (!handler) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_IMPLEMENTED',
            message: `This endpoint is not implemented for version '${version}'`,
          },
        },
        { status: 501 }
      );
    }

    // Execute handler
    const response = await handler(req);

    // Add version headers
    const headers = getDeprecationHeaders(version);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;
  };
}

// =============================================================================
// Version Middleware
// =============================================================================

/**
 * Next.js middleware for API versioning
 * Redirects /api/... to /api/v1/... if no version specified
 */
export function versionMiddleware(req: NextRequest): NextResponse | null {
  const url = new URL(req.url);

  // Skip if already has version
  if (url.pathname.match(/^\/api\/(v\d+|auth|webhooks)\//)) {
    return null;
  }

  // Skip non-API routes
  if (!url.pathname.startsWith('/api/')) {
    return null;
  }

  // Add default version
  const newPath = url.pathname.replace(/^\/api\//, `/api/${DEFAULT_VERSION}/`);
  url.pathname = newPath;

  return NextResponse.rewrite(url);
}

// =============================================================================
// Documentation
// =============================================================================

/**
 * Get API version documentation
 */
export function getVersionDocumentation(): Array<{
  version: string;
  status: string;
  releasedAt: string;
  deprecatedAt?: string;
  sunsetAt?: string;
  changes: string[];
}> {
  return Object.values(API_VERSIONS).map((v) => ({
    version: v.version,
    status: v.status,
    releasedAt: v.releasedAt.toISOString(),
    deprecatedAt: v.deprecatedAt?.toISOString(),
    sunsetAt: v.sunsetAt?.toISOString(),
    changes: v.changes,
  }));
}

/**
 * Get migration guide between versions
 */
export function getMigrationGuide(
  fromVersion: string,
  toVersion: string
): {
  from: string;
  to: string;
  steps: string[];
  breakingChanges: string[];
} | null {
  if (fromVersion === toVersion) {
    return null;
  }

  // Migration guides would be defined here
  const guides: Record<string, Record<string, { steps: string[]; breakingChanges: string[] }>> = {
    v1: {
      v2: {
        steps: [
          'Update pagination parameters from page/limit to cursor/limit',
          'Update error response format handling',
          'Add new required headers',
        ],
        breakingChanges: [
          'Pagination format changed from offset to cursor-based',
          'Error response structure updated',
        ],
      },
    },
  };

  const guide = guides[fromVersion]?.[toVersion];
  if (!guide) return null;

  return {
    from: fromVersion,
    to: toVersion,
    ...guide,
  };
}
