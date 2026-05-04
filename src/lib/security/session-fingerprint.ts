/**
 * Session Fingerprinting
 *
 * Binds JWT sessions to a client fingerprint to mitigate session token theft.
 * The fingerprint is a hash of stable client attributes (user-agent, etc.).
 *
 * IMPORTANT: We intentionally exclude IP from the fingerprint because:
 * - Mobile users frequently change IPs (WiFi → cellular)
 * - VPN users rotate IPs
 * - Corporate proxies change IPs
 *
 * Instead we use a relaxed fingerprint based on:
 * - User-Agent (browser + OS family, not full version)
 * - Accept-Language header
 *
 * This prevents stolen tokens from being used on a completely different
 * platform (e.g., token stolen via XSS on Chrome/Windows used on curl/Linux)
 * while avoiding false positives for legitimate users.
 */

/**
 * Generate a fingerprint from request headers.
 * Returns a hex string hash that can be stored in the JWT.
 */
export async function generateSessionFingerprint(headers: Headers): Promise<string> {
  const userAgent = headers.get('user-agent') || 'unknown';
  const acceptLanguage = headers.get('accept-language') || 'unknown';

  // Extract stable UA components (browser family + OS, not version numbers)
  const stableUA = extractStableUA(userAgent);

  // Combine components
  const raw = `${stableUA}|${acceptLanguage.split(',')[0]}`;

  // Hash with SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .slice(0, 16) // Use first 16 bytes (32 hex chars) for compactness
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify that a request matches a stored fingerprint.
 * Returns true if fingerprints match (session is valid).
 */
export async function verifySessionFingerprint(
  headers: Headers,
  storedFingerprint: string
): Promise<boolean> {
  if (!storedFingerprint) return true; // No fingerprint stored — allow (backward compat)

  const currentFingerprint = await generateSessionFingerprint(headers);
  return currentFingerprint === storedFingerprint;
}

/**
 * Extract stable components from User-Agent string.
 * Removes version numbers to avoid false positives on browser updates.
 *
 * Examples:
 * - "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"
 *   → "chrome|windows"
 * - "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Safari/604.1"
 *   → "safari|ios"
 */
function extractStableUA(ua: string): string {
  const lowerUA = ua.toLowerCase();

  // Detect browser family
  let browser = 'unknown';
  if (lowerUA.includes('firefox')) browser = 'firefox';
  else if (lowerUA.includes('edg/') || lowerUA.includes('edge')) browser = 'edge';
  else if (lowerUA.includes('opr/') || lowerUA.includes('opera')) browser = 'opera';
  else if (lowerUA.includes('chrome') && !lowerUA.includes('edg')) browser = 'chrome';
  else if (lowerUA.includes('safari') && !lowerUA.includes('chrome')) browser = 'safari';
  else if (lowerUA.includes('curl')) browser = 'curl';
  else if (lowerUA.includes('postman')) browser = 'postman';
  else if (lowerUA.includes('insomnia')) browser = 'insomnia';

  // Detect OS family
  let os = 'unknown';
  if (lowerUA.includes('windows')) os = 'windows';
  else if (lowerUA.includes('macintosh') || lowerUA.includes('mac os')) os = 'macos';
  else if (lowerUA.includes('iphone') || lowerUA.includes('ipad')) os = 'ios';
  else if (lowerUA.includes('android')) os = 'android';
  else if (lowerUA.includes('linux')) os = 'linux';
  else if (lowerUA.includes('cros')) os = 'chromeos';

  return `${browser}|${os}`;
}
