/**
 * Test Data Generators
 * 
 * Utilities for generating test data.
 */

import type { Chunk } from '@/lib/rag/chunking';
import type { Document } from '@/lib/rag/types';

/**
 * Simple faker-like utility for generating test data
 */
export const Faker = {
  random: {
    uuid: () => `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    int: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
    float: (min: number, max: number) => Math.random() * (max - min) + min,
    boolean: () => Math.random() > 0.5,
    arrayElement: <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!,
    arrayElements: <T>(arr: T[], count: number): T[] => {
      const shuffled = [...arr].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    },
  },
  lorem: {
    word: () => Faker.random.arrayElement([
      'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
      'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
      'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
    ]),
    words: (count: number) => Array.from({ length: count }, () => Faker.lorem.word()).join(' '),
    sentence: (wordCount: number = 10) => {
      const words = Faker.lorem.words(wordCount);
      return words.charAt(0).toUpperCase() + words.slice(1) + '.';
    },
    sentences: (count: number, wordCount: number = 10) => 
      Array.from({ length: count }, () => Faker.lorem.sentence(wordCount)).join(' '),
    paragraph: (sentenceCount: number = 5) => 
      Array.from({ length: sentenceCount }, () => Faker.lorem.sentence()).join(' '),
    paragraphs: (count: number, sentenceCount: number = 5) =>
      Array.from({ length: count }, () => Faker.lorem.paragraph(sentenceCount)).join('\n\n'),
  },
  internet: {
    email: () => `${Faker.lorem.word()}@${Faker.lorem.word()}.com`,
    userName: () => Faker.lorem.word() + Faker.random.int(100, 999),
    url: () => `https://${Faker.lorem.word()}.com`,
  },
  date: {
    past: () => new Date(Date.now() - Faker.random.int(1, 365 * 24 * 60 * 60 * 1000)),
    future: () => new Date(Date.now() + Faker.random.int(1, 365 * 24 * 60 * 60 * 1000)),
    recent: () => new Date(Date.now() - Faker.random.int(1, 24 * 60 * 60 * 1000)),
  },
};

/**
 * Generate random text
 */
export function generateRandomText(length: number = 100): string {
  return Faker.lorem.sentences(Math.ceil(length / 10)).slice(0, length);
}

/**
 * Generate random email
 */
export function generateRandomEmail(): string {
  return Faker.internet.email();
}

/**
 * Generate random ID
 */
export function generateRandomId(prefix: string = ''): string {
  return `${prefix}${prefix ? '-' : ''}${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate test documents
 */
export function generateTestDocuments(count: number = 5, overrides: Partial<Document> = {}): Document[] {
  const documentTypes = ['pdf', 'docx', 'txt', 'md', 'html'];
  const statuses = ['uploaded', 'processing', 'processed', 'error'];

  return Array.from({ length: count }, (_, i) => ({
    id: generateRandomId('doc'),
    name: `document-${i + 1}.${Faker.random.arrayElement(documentTypes)}`,
    content: generateRandomText(1000),
    workspaceId: generateRandomId('ws'),
    userId: generateRandomId('user'),
    status: Faker.random.arrayElement(statuses) as Document['status'],
    createdAt: Faker.date.recent(),
    updatedAt: new Date(),
    metadata: {
      size: Faker.random.int(1024, 10 * 1024 * 1024),
      mimeType: 'application/pdf',
      ...overrides.metadata,
    },
    ...overrides,
  }));
}

/**
 * Generate test chunks
 */
export function generateTestChunks(
  documentId: string,
  count: number = 10,
  overrides: Partial<Chunk> = {}
): Chunk[] {
  return Array.from({ length: count }, (_, i) => ({
    id: generateRandomId('chunk'),
    content: Faker.lorem.paragraph(),
    metadata: {
      index: i,
      start: i * 500,
      end: (i + 1) * 500,
      tokenCount: Faker.random.int(50, 200),
      charCount: Faker.random.int(200, 500),
      ...overrides.metadata,
    },
    ...overrides,
  }));
}

/**
 * Generate test conversation
 */
export function generateTestConversation(
  messageCount: number = 5
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const conversation: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (let i = 0; i < messageCount; i++) {
    conversation.push({
      role: 'user',
      content: Faker.lorem.sentence(Faker.random.int(5, 15)),
    });
    conversation.push({
      role: 'assistant',
      content: Faker.lorem.paragraph(Faker.random.int(3, 8)),
    });
  }

  return conversation;
}

/**
 * Generate test embedding
 */
export function generateTestEmbedding(dimensions: number = 1536): number[] {
  return Array.from({ length: dimensions }, () => Faker.random.float(-1, 1));
}

/**
 * Generate test vector for database
 */
export function generateTestVector(dimensions: number = 1536): string {
  return `[${Array.from({ length: dimensions }, () => Faker.random.float(-1, 1)).join(',')}]`;
}

/**
 * Generate test batch embeddings
 */
export function generateTestBatchEmbeddings(
  count: number,
  dimensions: number = 1536
): number[][] {
  return Array.from({ length: count }, () => generateTestEmbedding(dimensions));
}

/**
 * Generate test file
 */
export function generateTestFile(
  name: string = 'test.txt',
  size: number = 1024,
  type: string = 'text/plain'
): File {
  const content = generateRandomText(size);
  return new File([content], name, { type });
}

/**
 * Generate test form data
 */
export function generateTestFormData(data: Record<string, string | File>): FormData {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
}

/**
 * Generate test workspace
 */
export function generateTestWorkspace(overrides: Record<string, unknown> = {}) {
  return {
    id: generateRandomId('ws'),
    name: `${Faker.lorem.word()} Workspace`,
    slug: Faker.lorem.word().toLowerCase(),
    plan: Faker.random.arrayElement(['free', 'starter', 'pro', 'enterprise']),
    settings: {
      chunkingStrategy: Faker.random.arrayElement(['fixed', 'semantic', 'hierarchical']),
      maxDocuments: Faker.random.int(10, 1000),
      maxStorage: Faker.random.int(1, 100) * 1024 * 1024 * 1024,
    },
    createdAt: Faker.date.past(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Generate test user
 */
export function generateTestUser(overrides: Record<string, unknown> = {}) {
  return {
    id: generateRandomId('user'),
    email: generateRandomEmail(),
    name: `${Faker.lorem.word()} ${Faker.lorem.word()}`,
    image: `https://avatar.example.com/${generateRandomId()}.png`,
    emailVerified: Faker.random.boolean() ? new Date() : null,
    preferences: {
      theme: Faker.random.arrayElement(['light', 'dark', 'system']),
      language: 'en',
      notifications: true,
    },
    createdAt: Faker.date.past(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Generate test membership
 */
export function generateTestMembership(
  userId: string,
  workspaceId: string,
  role: 'owner' | 'admin' | 'member' | 'viewer' = 'member'
) {
  return {
    id: generateRandomId('membership'),
    userId,
    workspaceId,
    role,
    createdAt: Faker.date.past(),
    updatedAt: new Date(),
  };
}

/**
 * Generate test API key
 */
export function generateTestAPIKey(overrides: Record<string, unknown> = {}) {
  return {
    id: generateRandomId('key'),
    key: `pk_${generateRandomId()}`,
    name: `${Faker.lorem.word()} API Key`,
    workspaceId: generateRandomId('ws'),
    userId: generateRandomId('user'),
    permissions: ['read', 'write'],
    lastUsedAt: Faker.random.boolean() ? Faker.date.recent() : null,
    expiresAt: Faker.random.boolean() ? Faker.date.future() : null,
    createdAt: Faker.date.past(),
    ...overrides,
  };
}

/**
 * Generate test webhook
 */
export function generateTestWebhook(overrides: Record<string, unknown> = {}) {
  const events = [
    'document.created',
    'document.updated',
    'document.deleted',
    'document.processed',
    'chat.message_sent',
  ];

  return {
    id: generateRandomId('webhook'),
    url: Faker.internet.url(),
    secret: `whsec_${generateRandomId()}`,
    events: Faker.random.arrayElements(events, Faker.random.int(1, events.length)),
    workspaceId: generateRandomId('ws'),
    isActive: true,
    createdAt: Faker.date.past(),
    updatedAt: new Date(),
    ...overrides,
  };
}
