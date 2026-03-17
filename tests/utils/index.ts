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
  mockEmbeddingResponse,
  createMockEmbeddings,
  mockChatCompletionResponse,
  createMockStreamChunk,
  createMockOpenAIClient,
  MockOpenAI,
  mockStreamingResponse,
  mockAsyncStreamingResponse,
  resetOpenAIMocks,
  mockEmbeddingsCreate,
  mockChatCompletionsCreate,
  mockStreamingChatCompletionsCreate,
} from './mocks/openai';

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

// Helpers
export {
  setupTestEnvironment,
  mockNextRouter,
  mockServerActions,
  mockNextAuthSession,
  defaultMockSession,
  mockMatchMedia,
  mockIntersectionObserver,
  mockResizeObserver,
  mockFetch,
  createMockFetch,
  mockClipboard,
  suppressConsoleErrors,
  wait,
  waitForElementToBeRemoved,
  createDeferredPromise,
  setupCommonMocks,
  getMockPrisma,
  type MockSession,
} from './helpers/setup';
