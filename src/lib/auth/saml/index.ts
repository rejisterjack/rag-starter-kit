/**
 * SAML Authentication Module
 *
 * Enterprise-grade SAML 2.0 Single Sign-On implementation.
 *
 * @example
 * ```typescript
 * import { getWorkspaceSamlConfig, initiateLogin } from '@/lib/auth/saml';
 *
 * const config = await getWorkspaceSamlConfig(workspaceId);
 * if (config) {
 *   const { redirectUrl } = await initiateLogin(config, baseUrl, relayState);
 *   redirect(redirectUrl);
 * }
 * ```
 */

// Configuration and types
export {
  type AttributeMapping,
  AttributeMappingSchema,
  DEFAULT_SSO_SETTINGS,
  type DigestAlgorithm,
  generateSPMetadata,
  getCertificateExpiry,
  getSamlUrls,
  isCertificateExpiringSoon,
  isValidCertificate,
  type NameIDFormat,
  parseCertificate,
  type SamlConfig,
  SamlConfigSchema,
  SamlError,
  type SamlErrorCode,
  type SamlProfile,
  type SignatureAlgorithm,
  type SPMetadataConfig,
  UpdateSamlConfigSchema,
  type WorkspaceSSOSettings,
  WorkspaceSSOSettingsSchema,
} from './config';

// Provider implementation
export {
  createIdentityProvider,
  createServiceProvider,
  getWorkspaceSamlConfig,
  initiateLogin,
  initiateLogout,
  isAssertionUsed,
  type LoginCompletionResult,
  type LoginInitiationResult,
  markAssertionUsed,
  type ParsedIdPMetadata,
  parseIdPMetadata,
  processLogoutResponse,
  processSamlResponse,
  rotateCertificate,
  upsertSamlConfig,
  validateEmailDomain,
} from './provider';
