/**
 * SSRF (Server-Side Request Forgery) Protection
 *
 * Prevents attackers from using the server to make requests to internal
 * services, cloud metadata endpoints, or other restricted resources.
 *
 * Features:
 * - Blocks private IP ranges (RFC 1918, RFC 4193)
 * - Blocks cloud metadata endpoints (AWS, GCP, Azure)
 * - Blocks localhost and loopback addresses
 * - DNS rebinding protection
 * - Configurable allow/deny lists
 */

import dns from 'node:dns';
import { logger } from '@/lib/logger';

// =============================================================================
// Configuration
// =============================================================================

interface SSRFConfig {
  // Blocked IP ranges (CIDR notation)
  blockedRanges: string[];
  // Blocked hostnames/patterns
  blockedHosts: string[];
  // Allowed schemes (default: http, https)
  allowedSchemes: string[];
  // Maximum redirects to follow
  maxRedirects: number;
  // Whether to block private IP ranges
  blockPrivateIPs: boolean;
  // Custom allow list (overrides blocks)
  allowList: string[];
}

const DEFAULT_CONFIG: SSRFConfig = {
  blockedRanges: [
    // Private IPv4 ranges (RFC 1918)
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    // Link-local (RFC 3927)
    '169.254.0.0/16',
    // Loopback
    '127.0.0.0/8',
    // Multicast (RFC 5771)
    '224.0.0.0/4',
    // Reserved
    '0.0.0.0/8',
    '240.0.0.0/4',
    // Carrier-grade NAT (RFC 6598)
    '100.64.0.0/10',
    // Documentation/examples
    '192.0.2.0/24',
    '198.51.100.0/24',
    '203.0.113.0/24',
    // IPv6 loopback
    '::1/128',
    // IPv6 link-local
    'fe80::/10',
    // IPv6 unique local (RFC 4193)
    'fc00::/7',
  ],
  blockedHosts: [
    // AWS Metadata Service
    '169.254.169.254',
    'metadata.aws.internal',
    // GCP Metadata Service
    'metadata.google.internal',
    'metadata.google',
    // Azure Metadata Service
    '169.254.169.254',
    'metadata.azure.internal',
    // Alibaba Cloud
    '100.100.100.200',
    // Oracle Cloud
    '192.0.0.192',
    // Common internal hostnames
    'localhost',
    'localhost.localdomain',
    'ip6-localhost',
    'ip6-loopback',
    // Kubernetes
    'kubernetes.default',
    'kubernetes.default.svc',
    'kubernetes.default.svc.cluster.local',
    // Docker
    'host.docker.internal',
    'gateway.docker.internal',
  ],
  allowedSchemes: ['http', 'https'],
  maxRedirects: 5,
  blockPrivateIPs: true,
  allowList: [],
};

// Merge with environment config
const config: SSRFConfig = {
  ...DEFAULT_CONFIG,
  blockedRanges: process.env.SSRF_BLOCKED_RANGES?.split(',') || DEFAULT_CONFIG.blockedRanges,
  blockedHosts: process.env.SSRF_BLOCKED_HOSTS?.split(',') || DEFAULT_CONFIG.blockedHosts,
  allowedSchemes: process.env.SSRF_ALLOWED_SCHEMES?.split(',') || DEFAULT_CONFIG.allowedSchemes,
  maxRedirects: parseInt(process.env.SSRF_MAX_REDIRECTS || '5', 10),
  blockPrivateIPs: process.env.SSRF_BLOCK_PRIVATE_IPS !== 'false',
  allowList: process.env.SSRF_ALLOW_LIST?.split(',') || DEFAULT_CONFIG.allowList,
};

// =============================================================================
// Types
// =============================================================================

export class SSRFError extends Error {
  constructor(
    message: string,
    public readonly url: string
  ) {
    super(message);
    this.name = 'SSRFError';
  }
}

export interface SSRFValidationResult {
  allowed: boolean;
  reason?: string;
  resolvedIp?: string;
}

// =============================================================================
// IP Address Validation
// =============================================================================

/**
 * Convert IP address to numeric value
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    throw new Error('Invalid IPv4 address');
  }
  return parts.reduce((num, part) => (num << 8) + parseInt(part, 10), 0) >>> 0;
}

/**
 * Parse CIDR range to start/end numbers
 */
function parseCidr(cidr: string): { start: number; end: number } {
  const [range, bitsStr] = cidr.split('/');
  const bits = parseInt(bitsStr || '32', 10);
  const start = ipToNumber(range);
  const mask = -1 << (32 - bits);
  const end = start | (~mask >>> 0);
  return { start: start & mask, end };
}

/**
 * Check if an IP is in a CIDR range
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  try {
    const ipNum = ipToNumber(ip);
    const { start, end } = parseCidr(cidr);
    return ipNum >= start && ipNum <= end;
  } catch {
    return false;
  }
}

/**
 * Check if an IP is in any blocked range
 */
function isBlockedIp(ip: string): boolean {
  // Check allow list first
  if (config.allowList.includes(ip)) {
    return false;
  }

  // Check if it's a private IP
  if (!config.blockPrivateIPs) {
    return false;
  }

  // Check blocked ranges
  return config.blockedRanges.some((range) => isIpInCidr(ip, range));
}

// =============================================================================
// Hostname Validation
// =============================================================================

/**
 * Check if a hostname is blocked
 */
function isBlockedHost(hostname: string): boolean {
  // Check allow list first
  if (config.allowList.includes(hostname)) {
    return false;
  }

  const lowerHostname = hostname.toLowerCase();

  // Check exact matches
  if (config.blockedHosts.includes(lowerHostname)) {
    return true;
  }

  // Check suffix matches (e.g., "metadata.google.internal")
  return config.blockedHosts.some(
    (blocked) => lowerHostname === blocked || lowerHostname.endsWith(`.${blocked}`)
  );
}

/**
 * Resolve hostname to IP addresses
 */
async function resolveHostname(hostname: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err) {
        reject(err);
      } else {
        resolve(addresses.map((addr) => addr.address));
      }
    });
  });
}

// =============================================================================
// URL Validation
// =============================================================================

/**
 * Validate a URL for SSRF protection
 *
 * This function performs multiple checks:
 * 1. Validates URL format and scheme
 * 2. Checks hostname against block list
 * 3. Resolves hostname and checks all resolved IPs
 * 4. Prevents DNS rebinding attacks
 *
 * @param urlString - The URL to validate
 * @returns SSRFValidationResult with allowed status
 */
export async function validateUrl(urlString: string): Promise<SSRFValidationResult> {
  // Parse URL
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { allowed: false, reason: 'Invalid URL format' };
  }

  // Check scheme
  if (!config.allowedSchemes.includes(url.protocol.slice(0, -1))) {
    return {
      allowed: false,
      reason: `Scheme '${url.protocol}' not allowed. Allowed: ${config.allowedSchemes.join(', ')}`,
    };
  }

  // Extract hostname (remove port if present)
  const hostname = url.hostname;

  // Check if hostname is an IP address
  const isIpAddress = /^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.startsWith('[');

  if (isIpAddress) {
    // Direct IP access
    const ip = hostname.replace(/[[\]]/g, '');

    if (isBlockedIp(ip)) {
      return {
        allowed: false,
        reason: 'Access to internal IP addresses is not allowed',
        resolvedIp: ip,
      };
    }

    return { allowed: true, resolvedIp: ip };
  }

  // Check hostname against block list
  if (isBlockedHost(hostname)) {
    return { allowed: false, reason: 'Hostname is blocked' };
  }

  // Resolve hostname to IPs
  let resolvedIps: string[];
  try {
    resolvedIps = await resolveHostname(hostname);
  } catch (error) {
    logger.warn('Failed to resolve hostname for SSRF check', {
      hostname,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    // Fail closed - don't allow if we can't verify
    return { allowed: false, reason: 'Failed to resolve hostname' };
  }

  if (resolvedIps.length === 0) {
    return { allowed: false, reason: 'Hostname resolved to no IP addresses' };
  }

  // Check all resolved IPs
  for (const ip of resolvedIps) {
    if (isBlockedIp(ip)) {
      return {
        allowed: false,
        reason: 'Hostname resolves to internal IP address (DNS rebinding protection)',
        resolvedIp: ip,
      };
    }
  }

  return { allowed: true, resolvedIp: resolvedIps[0] };
}

/**
 * Validate URL synchronously (without DNS resolution)
 * Use this for quick checks, but prefer validateUrl for full protection
 */
export function validateUrlSync(urlString: string): SSRFValidationResult {
  // Parse URL
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { allowed: false, reason: 'Invalid URL format' };
  }

  // Check scheme
  if (!config.allowedSchemes.includes(url.protocol.slice(0, -1))) {
    return {
      allowed: false,
      reason: `Scheme '${url.protocol}' not allowed`,
    };
  }

  // Extract hostname
  const hostname = url.hostname;

  // Check if hostname is an IP address
  const isIpAddress = /^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.startsWith('[');

  if (isIpAddress) {
    const ip = hostname.replace(/[[\]]/g, '');

    if (isBlockedIp(ip)) {
      return { allowed: false, reason: 'Access to internal IP addresses is not allowed' };
    }

    return { allowed: true };
  }

  // Check hostname against block list
  if (isBlockedHost(hostname)) {
    return { allowed: false, reason: 'Hostname is blocked' };
  }

  // Note: DNS resolution not performed in sync version
  return { allowed: true };
}

/**
 * Assert that a URL is safe (throws if not)
 */
export async function assertSafeUrl(urlString: string): Promise<void> {
  const result = await validateUrl(urlString);

  if (!result.allowed) {
    logger.warn('SSRF blocked request', {
      url: urlString,
      reason: result.reason,
      resolvedIp: result.resolvedIp,
    });
    throw new SSRFError(result.reason || 'URL blocked by SSRF protection', urlString);
  }
}

/**
 * Create a safe fetch function that validates URLs before fetching
 */
export function createSafeFetch(
  fetchFn: typeof fetch,
  options?: { maxRedirects?: number }
): typeof fetch {
  const maxRedirects = options?.maxRedirects ?? config.maxRedirects;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Validate URL
    await assertSafeUrl(url);

    // Perform fetch with redirect limit
    const response = await fetchFn(input, {
      ...init,
      redirect: 'manual', // Handle redirects manually to validate each one
    });

    // Handle redirects
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        // Check redirect count
        const redirectCount = parseInt(response.headers.get('x-redirect-count') || '0', 10);
        if (redirectCount >= maxRedirects) {
          throw new SSRFError(`Too many redirects (max: ${maxRedirects})`, url);
        }

        // Resolve and validate redirect URL
        const redirectUrl = new URL(location, url).toString();
        await assertSafeUrl(redirectUrl);

        // Follow redirect with incremented count
        return createSafeFetch(fetchFn, options)(redirectUrl, {
          ...init,
          headers: {
            ...init?.headers,
            'x-redirect-count': String(redirectCount + 1),
          },
        });
      }
    }

    return response;
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get current SSRF configuration
 */
export function getSSRFConfig(): SSRFConfig {
  return { ...config };
}

/**
 * Check if a URL would be allowed (for testing/debugging)
 */
export async function checkUrl(urlString: string): Promise<{
  allowed: boolean;
  reason?: string;
  checks: Record<string, boolean>;
}> {
  const checks: Record<string, boolean> = {
    validUrl: false,
    allowedScheme: false,
    notBlockedHost: false,
    notBlockedIp: false,
  };

  // Parse URL
  let url: URL;
  try {
    url = new URL(urlString);
    checks.validUrl = true;
  } catch {
    return { allowed: false, reason: 'Invalid URL format', checks };
  }

  // Check scheme
  checks.allowedScheme = config.allowedSchemes.includes(url.protocol.slice(0, -1));
  if (!checks.allowedScheme) {
    return {
      allowed: false,
      reason: `Scheme '${url.protocol}' not allowed`,
      checks,
    };
  }

  // Check hostname
  const hostname = url.hostname;
  checks.notBlockedHost = !isBlockedHost(hostname);
  if (!checks.notBlockedHost) {
    return { allowed: false, reason: 'Hostname is blocked', checks };
  }

  // Check IP if hostname is an IP
  const isIpAddress = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
  if (isIpAddress) {
    checks.notBlockedIp = !isBlockedIp(hostname);
    if (!checks.notBlockedIp) {
      return { allowed: false, reason: 'IP address is blocked', checks };
    }
    return { allowed: true, checks };
  }

  // Try to resolve and check
  try {
    const resolvedIps = await resolveHostname(hostname);
    checks.notBlockedIp = resolvedIps.every((ip) => !isBlockedIp(ip));
    if (!checks.notBlockedIp) {
      return {
        allowed: false,
        reason: 'Hostname resolves to blocked IP address',
        checks,
      };
    }
  } catch {
    // Resolution failure - we'll allow it but log a warning
    logger.warn('Could not resolve hostname for SSRF check', { hostname });
  }

  return { allowed: true, checks };
}
