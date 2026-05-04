/**
 * SSRF (Server-Side Request Forgery) Protection
 *
 * Validates URLs to prevent requests to internal/private network addresses.
 * This blocks attacks like:
 * - Accessing cloud metadata endpoints (169.254.169.254)
 * - Scanning internal networks (10.x, 172.16-31.x, 192.168.x)
 * - Localhost access (127.0.0.1, ::1)
 * - DNS rebinding attacks
 */

import { logger } from '@/lib/logger';

// =============================================================================
// Blocked Hostnames
// =============================================================================

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '::',
  // AWS metadata
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',
  // Kubernetes
  'kubernetes',
  'kubernetes.default',
  'kubernetes.default.svc',
  'kubernetes.default.svc.cluster.local',
]);

// =============================================================================
// Private IP Range Detection
// =============================================================================

/**
 * Check if an IPv4 address is in a private/reserved range
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Invalid IPs are treated as private (blocked)
  }

  const [a, b, c, d] = parts;

  return (
    // Loopback: 127.0.0.0/8
    a === 127 ||
    // Private: 10.0.0.0/8
    a === 10 ||
    // Private: 172.16.0.0/12
    (a === 172 && b >= 16 && b <= 31) ||
    // Private: 192.168.0.0/16
    (a === 192 && b === 168) ||
    // Link-local / APIPA: 169.254.0.0/16 (AWS/GCP/Azure metadata)
    (a === 169 && b === 254) ||
    // Current network: 0.0.0.0/8
    a === 0 ||
    // Shared address space (CGNAT): 100.64.0.0/10
    (a === 100 && b >= 64 && b <= 127) ||
    // IETF protocol assignments: 192.0.0.0/24
    (a === 192 && b === 0 && c === 0) ||
    // Documentation: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    // Benchmarking: 198.18.0.0/15
    (a === 198 && (b === 18 || b === 19)) ||
    // Broadcast: 255.255.255.255
    (a === 255 && b === 255 && c === 255 && d === 255) ||
    // Multicast: 224.0.0.0/4
    (a >= 224 && a <= 239)
  );
}

/**
 * Check if an IPv6 address is private/reserved
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();

  return (
    // Loopback
    normalized === '::1' ||
    // Unspecified
    normalized === '::' ||
    // Link-local: fe80::/10
    normalized.startsWith('fe80:') ||
    // Unique local: fc00::/7
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    // IPv4-mapped private addresses: ::ffff:10.0.0.0/8 etc.
    normalized.startsWith('::ffff:')
  );
}

/**
 * Check if an IP address (v4 or v6) is private
 */
function isPrivateIP(ip: string): boolean {
  if (ip.includes(':')) {
    return isPrivateIPv6(ip);
  }
  return isPrivateIPv4(ip);
}

// =============================================================================
// URL Validation
// =============================================================================

export interface SSRFValidationResult {
  safe: boolean;
  reason?: string;
}

/**
 * Custom error class for SSRF violations
 */
export class SSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SSRFError';
  }
}

/**
 * Validate a URL is safe from SSRF attacks.
 *
 * Checks:
 * 1. Protocol is http or https only
 * 2. Hostname is not a known private/internal hostname
 * 3. Hostname does not resolve to a private IP address
 * 4. Port is standard (80, 443) or explicitly allowed
 * 5. No credentials in URL
 */
export async function validateUrlSafety(
  url: string,
  options?: { allowedPorts?: number[] }
): Promise<SSRFValidationResult> {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }

  // Check protocol
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { safe: false, reason: 'Only HTTP and HTTPS protocols are allowed' };
  }

  // Check for credentials in URL
  if (parsedUrl.username || parsedUrl.password) {
    return { safe: false, reason: 'URLs with embedded credentials are not allowed' };
  }

  // Check port
  const allowedPorts = options?.allowedPorts ?? [80, 443];
  if (parsedUrl.port) {
    const port = parseInt(parsedUrl.port, 10);
    if (!allowedPorts.includes(port)) {
      return { safe: false, reason: `Port ${port} is not allowed` };
    }
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Check against blocked hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { safe: false, reason: 'Hostname is blocked (internal/private)' };
  }

  // Check if hostname ends with common internal suffixes
  const internalSuffixes = ['.local', '.internal', '.localhost', '.intranet', '.corp', '.lan'];
  if (internalSuffixes.some((suffix) => hostname.endsWith(suffix))) {
    return { safe: false, reason: 'Internal domain suffix is not allowed' };
  }

  // Check if hostname is already an IP address
  if (isIPAddress(hostname)) {
    if (isPrivateIP(hostname)) {
      return { safe: false, reason: 'Private/internal IP addresses are not allowed' };
    }
    return { safe: true };
  }

  // DNS resolution check — resolve the hostname and verify it doesn't point to private IPs
  try {
    const addresses = await resolveDNS(hostname);

    if (addresses.length === 0) {
      return { safe: false, reason: 'Hostname could not be resolved' };
    }

    for (const addr of addresses) {
      if (isPrivateIP(addr)) {
        logger.warn('SSRF blocked: hostname resolves to private IP', {
          hostname,
          resolvedIP: addr,
        });
        return { safe: false, reason: 'Hostname resolves to a private/internal IP address' };
      }
    }
  } catch (error) {
    logger.warn('DNS resolution failed for SSRF check', {
      hostname,
      error: error instanceof Error ? error.message : String(error),
    });
    return { safe: false, reason: 'Could not verify hostname safety (DNS resolution failed)' };
  }

  return { safe: true };
}

/**
 * Assert a URL is safe — throws SSRFError if not.
 * Convenience wrapper for use in code that expects exceptions.
 */
export async function assertSafeUrl(
  url: string,
  options?: { allowedPorts?: number[] }
): Promise<void> {
  const result = await validateUrlSafety(url, options);
  if (!result.safe) {
    throw new SSRFError(result.reason || 'URL is not allowed');
  }
}

/**
 * Check if an IP address falls within a CIDR range.
 * Supports IPv4 CIDR notation (e.g., "10.0.0.0/8", "192.168.1.0/24").
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.split('/');
  if (!network || !prefixStr) return false;

  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const ipNum = ipToNumber(ip);
  const networkNum = ipToNumber(network);

  if (ipNum === null || networkNum === null) return false;

  // Create mask from prefix length
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;

  return (ipNum & mask) === (networkNum & mask);
}

/**
 * Convert an IPv4 address string to a 32-bit number.
 * Returns null for invalid addresses.
 */
function ipToNumber(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if a string is an IP address (v4 or v6)
 */
function isIPAddress(hostname: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Pattern.test(hostname)) return true;

  // IPv6 pattern (simplified - contains colons)
  if (hostname.includes(':')) return true;

  // IPv6 in brackets (already stripped by URL parser)
  if (hostname.startsWith('[') && hostname.endsWith(']')) return true;

  return false;
}

/**
 * Resolve DNS for a hostname. Works in both Node.js and Edge runtimes.
 *
 * In Edge Runtime (middleware), DNS resolution is not available,
 * so this returns an empty array (callers should handle gracefully).
 */
async function resolveDNS(hostname: string): Promise<string[]> {
  try {
    // Use dynamic import to handle Edge Runtime where 'dns' is not available
    const dns = await import('dns');
    const { promisify } = await import('util');
    const resolve4 = promisify(dns.resolve4);
    const resolve6 = promisify(dns.resolve6);

    const results: string[] = [];

    try {
      const ipv4 = await resolve4(hostname);
      results.push(...ipv4);
    } catch {
      // No IPv4 records — that's fine
    }

    try {
      const ipv6 = await resolve6(hostname);
      results.push(...ipv6);
    } catch {
      // No IPv6 records — that's fine
    }

    return results;
  } catch {
    // If dns module is not available (Edge Runtime), we cannot resolve
    // Return empty — the caller should decide policy (allow or deny)
    return [];
  }
}
