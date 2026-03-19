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
  type SamlConfig,
  type SamlProfile,
  type AttributeMapping,
  type SPMetadataConfig,
  type WorkspaceSSOSettings,
  type SignatureAlgorithm,
  type DigestAlgorithm,
  type NameIDFormat,
  type SamlErrorCode,
  SamlError,
  generateSPMetadata,
  parseCertificate,
  isValidCertificate,
  getCertificateExpiry,
  isCertificateExpiringSoon,
  getSamlUrls,
  DEFAULT_SSO_SETTINGS,
  SamlConfigSchema,
  UpdateSamlConfigSchema,
  WorkspaceSSOSettingsSchema,
  AttributeMappingSchema,
} from './config';

// Provider implementation
export {
  createServiceProvider,
  createIdentityProvider,
  initiateLogin,
  processSamlResponse,
  initiateLogout,
  processLogoutResponse,
  parseIdPMetadata,
  getWorkspaceSamlConfig,
  upsertSamlConfig,
  rotateCertificate,
  isAssertionUsed,
  markAssertionUsed,
  validateEmailDomain,
  type LoginInitiationResult,
  type LoginCompletionResult,
  type ParsedIdPMetadata,
} from './provider';
