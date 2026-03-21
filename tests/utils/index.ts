/**
 * Test Utilities Index
 * 
 * Central export point for all test utilities.
 */

// Mocks
export {
  createMockPrismaClient,
  mockPrisma,
  resetPrismaMocks,
  mockTransaction,
  mockVectorSearch,
  type DeepMockProxy,
} from './mocks/prisma';

export {
  mockOpenAIResponses,
  mockOpenAI,
  resetOpenAIMocks,
  setupStreamingMock,
} from './mocks/openai';

// Embedding Provider Mocks
export {
  createMockGoogleProvider,
  createMockOpenAIProvider,
  createMockOllamaProvider,
  mockEmbeddingProviders,
} from './mocks/embedding-providers';

// Security Mocks
export {
  mockCSRF,
  mockRateLimit,
  mockRedis,
  createMockRedisClient,
} from './mocks/security';

// Fixtures
export {
  samplePDFDocument,
  sampleWordDocument,
  sampleTextDocument,
  sampleProcessingDocument,
  sampleErrorDocument,
  sampleFinancialReportContent,
  sampleTechnicalDocumentation,
  sampleDocuments,
  createMockFile,
  mockPDFFile,
  mockWordFile,
  mockTextFile,
  mockImageFile,
  mockInvalidFile,
  mockOversizedFile,
} from './fixtures/documents';

export {
  sampleFinancialChunks,
  sampleTechnicalChunks,
  sampleHierarchicalChunks,
  sampleSemanticSearchChunks,
  createChunksWithEmbeddings,
  allSampleChunks,
  createChunk,
  createChunksFromText,
} from './fixtures/chunks';

export {
  regularUser,
  adminUser,
  unverifiedUser,
  premiumUser,
  newUser,
  allUsers,
  regularUserSession,
  adminUserSession,
  unauthenticatedSession,
  createMockUser,
  mockUserPreferences,
  mockGitHubAccount,
  mockGoogleAccount,
} from './fixtures/users';

export {
  personalWorkspace,
  teamWorkspace,
  enterpriseWorkspace,
  archivedWorkspace,
  allWorkspaces,
  ownerMembership,
  adminMembership,
  memberMembership,
  viewerMembership,
  pendingMembership,
  allMemberships,
  createMockWorkspace,
  createMockMembership,
  planLimits,
  rolePermissions,
} from './fixtures/workspaces';

// New Test Data Generators
export {
  generateRandomText,
  generateRandomEmail,
  generateRandomId,
  generateTestDocuments,
  generateTestChunks,
  generateTestConversation,
  generateTestEmbedding,
  generateTestVector,
  Faker,
} from './generators';

// API Test Helpers
export {
  createTestRequest,
  createTestFormData,
  createTestJSONRequest,
  parseJSONResponse,
  parseStreamResponse,
  mockAPIResponse,
  expectJSONResponse,
  expectErrorResponse,
  expectSuccessResponse,
} from './helpers/api-helpers';

// Setup Helpers
export {
  wait,
} from './helpers/setup';
