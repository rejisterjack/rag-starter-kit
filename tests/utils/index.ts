/**
 * Test Utilities Index
 *
 * Central export point for all test utilities.
 */

export {
  allSampleChunks,
  createChunk,
  createChunksFromText,
  createChunksWithEmbeddings,
  sampleFinancialChunks,
  sampleHierarchicalChunks,
  sampleSemanticSearchChunks,
  sampleTechnicalChunks,
} from './fixtures/chunks';
// Fixtures
export {
  createMockFile,
  mockImageFile,
  mockInvalidFile,
  mockOversizedFile,
  mockPDFFile,
  mockTextFile,
  mockWordFile,
  sampleDocuments,
  sampleErrorDocument,
  sampleFinancialReportContent,
  samplePDFDocument,
  sampleProcessingDocument,
  sampleTechnicalDocumentation,
  sampleTextDocument,
  sampleWordDocument,
} from './fixtures/documents';
export {
  adminUser,
  adminUserSession,
  allUsers,
  createMockUser,
  mockGitHubAccount,
  mockGoogleAccount,
  mockUserPreferences,
  newUser,
  premiumUser,
  regularUser,
  regularUserSession,
  unauthenticatedSession,
  unverifiedUser,
} from './fixtures/users';
export {
  adminMembership,
  allMemberships,
  allWorkspaces,
  archivedWorkspace,
  createMockMembership,
  createMockWorkspace,
  enterpriseWorkspace,
  memberMembership,
  ownerMembership,
  pendingMembership,
  personalWorkspace,
  planLimits,
  rolePermissions,
  teamWorkspace,
  viewerMembership,
} from './fixtures/workspaces';
// New Test Data Generators
export {
  Faker,
  generateRandomEmail,
  generateRandomId,
  generateRandomText,
  generateTestChunks,
  generateTestConversation,
  generateTestDocuments,
  generateTestEmbedding,
  generateTestVector,
} from './generators';
// API Test Helpers
export {
  createTestFormData,
  createTestJSONRequest,
  createTestRequest,
  expectErrorResponse,
  expectJSONResponse,
  expectSuccessResponse,
  mockAPIResponse,
  parseJSONResponse,
  parseStreamResponse,
} from './helpers/api-helpers';
// Setup Helpers
export { wait } from './helpers/setup';
// Embedding Provider Mocks
export {
  createMockGoogleProvider,
  createMockOllamaProvider,
  createMockOpenAIProvider,
  mockEmbeddingProviders,
} from './mocks/embedding-providers';
export {
  mockOpenAI,
  mockOpenAIResponses,
  resetOpenAIMocks,
  setupStreamingMock,
} from './mocks/openai';
// Mocks
export {
  createMockPrismaClient,
  type DeepMockProxy,
  mockPrisma,
  mockTransaction,
  mockVectorSearch,
  resetPrismaMocks,
} from './mocks/prisma';
// Security Mocks
export {
  createMockRedisClient,
  mockCSRF,
  mockRateLimit,
  mockRedis,
} from './mocks/security';
