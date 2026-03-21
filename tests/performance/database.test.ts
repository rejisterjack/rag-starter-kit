/**
 * Database Query Performance Tests
 * 
 * Tests for measuring database query performance.
 * Run with: pnpm vitest run tests/performance/database.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import { generateTestDocuments, generateTestChunks } from '@tests/utils/generators';

describe('Database Query Performance', () => {
  // Performance thresholds (in milliseconds)
  const THRESHOLDS = {
    simple: 50,
    medium: 100,
    complex: 500,
    vector: 1000,
  };

  describe('Document Queries', () => {
    it('should fetch documents by workspace within threshold', async () => {
      const start = performance.now();

      const documents = await prisma.document.findMany({
        where: { workspaceId: 'ws-test' },
        take: 100,
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.medium);
    });

    it('should fetch documents with pagination within threshold', async () => {
      const start = performance.now();

      const documents = await prisma.document.findMany({
        where: { workspaceId: 'ws-test' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.medium);
    });

    it('should search documents by name within threshold', async () => {
      const start = performance.now();

      const documents = await prisma.document.findMany({
        where: {
          workspaceId: 'ws-test',
          name: { contains: 'report', mode: 'insensitive' },
        },
        take: 50,
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.medium);
    });

    it('should fetch document count within threshold', async () => {
      const start = performance.now();

      const count = await prisma.document.count({
        where: { workspaceId: 'ws-test' },
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.simple);
    });
  });

  describe('Chunk Queries', () => {
    it('should fetch chunks by document within threshold', async () => {
      const start = performance.now();

      const chunks = await prisma.chunk.findMany({
        where: { documentId: 'doc-test' },
        take: 100,
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.medium);
    });

    it('should fetch chunks with embeddings within threshold', async () => {
      const start = performance.now();

      const chunks = await prisma.chunk.findMany({
        where: { documentId: 'doc-test' },
        select: {
          id: true,
          content: true,
          embedding: true,
          metadata: true,
        },
        take: 50,
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.medium);
    });
  });

  describe('Vector Search Queries', () => {
    it('should perform vector similarity search within threshold', async () => {
      const queryVector = Array(1536).fill(0).map(() => Math.random());

      const start = performance.now();

      // Note: This assumes pgvector is set up with the <=> operator
      const results = await prisma.$queryRaw`
        SELECT id, content, embedding <=> ${queryVector}::vector as distance
        FROM chunks
        ORDER BY embedding <=> ${queryVector}::vector
        LIMIT 10
      `;

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.vector);
    });

    it('should perform vector search with filters within threshold', async () => {
      const queryVector = Array(1536).fill(0).map(() => Math.random());

      const start = performance.now();

      const results = await prisma.$queryRaw`
        SELECT c.id, c.content, c.embedding <=> ${queryVector}::vector as distance
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE d.workspace_id = 'ws-test'
        ORDER BY c.embedding <=> ${queryVector}::vector
        LIMIT 10
      `;

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.vector);
    });
  });

  describe('Conversation Queries', () => {
    it('should fetch conversation with messages within threshold', async () => {
      const start = performance.now();

      const conversation = await prisma.chat.findUnique({
        where: { id: 'chat-test' },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 50,
          },
        },
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.medium);
    });

    it('should fetch recent conversations within threshold', async () => {
      const start = performance.now();

      const conversations = await prisma.chat.findMany({
        where: { userId: 'user-test' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.medium);
    });
  });

  describe('Workspace Queries', () => {
    it('should fetch workspace with members within threshold', async () => {
      const start = performance.now();

      const workspace = await prisma.workspace.findUnique({
        where: { id: 'ws-test' },
        include: {
          memberships: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
        },
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.medium);
    });

    it('should check membership permission within threshold', async () => {
      const start = performance.now();

      const membership = await prisma.membership.findFirst({
        where: {
          userId: 'user-test',
          workspaceId: 'ws-test',
        },
        select: {
          role: true,
        },
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.simple);
    });
  });

  describe('Complex Join Queries', () => {
    it('should fetch documents with chunks and metadata within threshold', async () => {
      const start = performance.now();

      const documents = await prisma.document.findMany({
        where: { workspaceId: 'ws-test' },
        take: 10,
        include: {
          chunks: {
            take: 5,
            select: {
              id: true,
              content: true,
              metadata: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.complex);
    });

    it('should fetch activity feed within threshold', async () => {
      const start = performance.now();

      const activities = await prisma.$queryRaw`
        SELECT 
          'document' as type,
          d.id,
          d.name,
          d.created_at,
          u.name as user_name
        FROM documents d
        JOIN users u ON d.user_id = u.id
        WHERE d.workspace_id = 'ws-test'
        
        UNION ALL
        
        SELECT 
          'chat' as type,
          c.id,
          c.title as name,
          c.created_at,
          u.name as user_name
        FROM chats c
        JOIN users u ON c.user_id = u.id
        WHERE c.workspace_id = 'ws-test'
        
        ORDER BY created_at DESC
        LIMIT 50
      `;

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.complex);
    });
  });

  describe('Batch Operations', () => {
    it('should batch insert chunks within threshold', async () => {
      const chunks = generateTestChunks('doc-test', 100);
      const chunkData = chunks.map((chunk) => ({
        id: chunk.id,
        documentId: 'doc-test',
        content: chunk.content,
        metadata: chunk.metadata,
        embedding: null,
      }));

      const start = performance.now();

      await prisma.chunk.createMany({
        data: chunkData,
        skipDuplicates: true,
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.complex);
    });

    it('should batch update documents within threshold', async () => {
      const start = performance.now();

      await prisma.document.updateMany({
        where: {
          workspaceId: 'ws-test',
          status: 'processing',
        },
        data: {
          status: 'processed',
          processedAt: new Date(),
        },
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.medium);
    });

    it('should batch delete old records within threshold', async () => {
      const start = performance.now();

      await prisma.chat.deleteMany({
        where: {
          createdAt: {
            lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
          },
        },
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.medium);
    });
  });

  describe('Aggregation Queries', () => {
    it('should calculate storage usage within threshold', async () => {
      const start = performance.now();

      const result = await prisma.document.aggregate({
        where: { workspaceId: 'ws-test' },
        _sum: {
          size: true,
        },
        _count: {
          id: true,
        },
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.medium);
    });

    it('should group documents by status within threshold', async () => {
      const start = performance.now();

      const result = await prisma.document.groupBy({
        by: ['status'],
        where: { workspaceId: 'ws-test' },
        _count: {
          id: true,
        },
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.medium);
    });

    it('should calculate daily usage stats within threshold', async () => {
      const start = performance.now();

      const stats = await prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as document_count,
          SUM(size) as total_size
        FROM documents
        WHERE workspace_id = 'ws-test'
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.complex);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent reads within threshold', async () => {
      const start = performance.now();

      const promises = Array.from({ length: 10 }, () =>
        prisma.document.findMany({
          where: { workspaceId: 'ws-test' },
          take: 10,
        })
      );

      await Promise.all(promises);

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.complex);
    });

    it('should handle concurrent writes within threshold', async () => {
      const start = performance.now();

      const promises = Array.from({ length: 5 }, (_, i) =>
        prisma.document.create({
          data: {
            id: `concurrent-doc-${i}`,
            name: `Document ${i}`,
            workspaceId: 'ws-test',
            userId: 'user-test',
            status: 'uploaded',
          },
        })
      );

      await Promise.all(promises);

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(THRESHOLDS.complex);
    });
  });
});

/**
 * Performance benchmark results
 */
describe('Performance Benchmarks', () => {
  it('reports performance baseline', async () => {
    const benchmarks = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test',
      thresholds: {
        simple: 50,
        medium: 100,
        complex: 500,
        vector: 1000,
      },
    };

    console.log('Performance Benchmarks:', JSON.stringify(benchmarks, null, 2));
  });
});
