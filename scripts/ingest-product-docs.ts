#!/usr/bin/env tsx
/**
 * Product Knowledge Base Ingestion Script
 *
 * Reads product markdown files, chunks them, generates embeddings,
 * and stores in the vector database for RAG Bot retrieval.
 *
 * Usage:
 *   npx tsx scripts/ingest-product-docs.ts
 *   # or
 *   npm run ingest:product-docs
 *
 * This creates/updates a dedicated "product knowledge base" in the database
 * that the RAG Bot queries for product-specific answers.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Files to ingest for product knowledge base
const PRODUCT_DOC_PATHS = [
  'README.md',
  'VISION.MD',
  'CONTRIBUTING.md',
  'ROADMAP.md',
  'CHANGELOG.md',
  'docs/ARCHITECTURE.md',
  'docs/SECURITY.md',
  'docs/PERFORMANCE.md',
];

const PROJECT_ROOT = resolve(__dirname, '..');

interface ProductChunk {
  id: string;
  content: string;
  source: string;
  index: number;
  hash: string;
}

/**
 * Read a markdown file and return its contents
 */
function readMarkdownFile(filePath: string): string | null {
  const fullPath = join(PROJECT_ROOT, filePath);
  if (!existsSync(fullPath)) {
    console.warn(`⚠️  File not found: ${filePath}`);
    return null;
  }
  try {
    const stat = statSync(fullPath);
    if (!stat.isFile()) {
      console.warn(`⚠️  Not a file: ${filePath}`);
      return null;
    }
    return readFileSync(fullPath, 'utf-8');
  } catch (error) {
    console.error(`❌ Error reading ${filePath}:`, error);
    return null;
  }
}

/**
 * Simple markdown-aware chunking
 * Splits on headers and paragraphs while respecting token limits
 */
function chunkContent(content: string, source: string, maxChunkSize = 1500): ProductChunk[] {
  const chunks: ProductChunk[] = [];
  const lines = content.split('\n');
  let currentChunk = '';
  let chunkIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // If line is a header, start a new chunk
    const isHeader = /^#{1,4}\s/.test(trimmed);

    if (isHeader && currentChunk.length > 200) {
      // Store current chunk
      const chunkText = currentChunk.trim();
      if (chunkText) {
        chunks.push({
          id: createHash('sha256').update(`${source}:${chunkIndex}:${chunkText}`).digest('hex').slice(0, 16),
          content: chunkText,
          source,
          index: chunkIndex++,
          hash: createHash('sha256').update(chunkText).digest('hex'),
        });
      }
      currentChunk = trimmed + '\n';
    } else if (currentChunk.length + trimmed.length + 1 > maxChunkSize) {
      // Store current chunk and start new one
      const chunkText = currentChunk.trim();
      if (chunkText) {
        chunks.push({
          id: createHash('sha256').update(`${source}:${chunkIndex}:${chunkText}`).digest('hex').slice(0, 16),
          content: chunkText,
          source,
          index: chunkIndex++,
          hash: createHash('sha256').update(chunkText).digest('hex'),
        });
      }
      currentChunk = trimmed + '\n';
    } else {
      currentChunk += trimmed + '\n';
    }
  }

  // Store remaining content
  if (currentChunk.trim()) {
    chunks.push({
      id: createHash('sha256').update(`${source}:${chunkIndex}:${currentChunk}`).digest('hex').slice(0, 16),
      content: currentChunk.trim(),
      source,
      index: chunkIndex,
      hash: createHash('sha256').update(currentChunk.trim()).digest('hex'),
    });
  }

  return chunks;
}

/**
 * Main ingestion function
 * NOTE: This is a scaffold. Full implementation requires:
 * - Prisma client initialization
 * - Embedding generation via Google Gemini
 * - Document/Chunk creation in the database
 * - Vector insertion into pgvector
 *
 * To fully implement, uncomment and complete the database operations below.
 */
async function ingestProductDocs() {
  console.log('📚 RAG Bot Product Knowledge Base Ingestion');
  console.log('===========================================\n');

  const allChunks: ProductChunk[] = [];

  // Read and chunk all product docs
  for (const docPath of PRODUCT_DOC_PATHS) {
    const content = readMarkdownFile(docPath);
    if (content) {
      console.log(`✅ ${docPath} — ${content.length} chars`);
      const chunks = chunkContent(content, docPath);
      console.log(`   ↳ Split into ${chunks.length} chunks`);
      allChunks.push(...chunks);
    }
  }

  console.log(`\n📊 Total chunks to ingest: ${allChunks.length}`);
  console.log(`   Total content size: ${allChunks.reduce((sum, c) => sum + c.content.length, 0)} chars`);

  // Summary
  console.log('\n📝 Chunk Summary:');
  const bySource = new Map<string, number>();
  for (const chunk of allChunks) {
    bySource.set(chunk.source, (bySource.get(chunk.source) || 0) + 1);
  }
  for (const [source, count] of bySource.entries()) {
    console.log(`   ${source}: ${count} chunks`);
  }

  console.log('\n⚡ Next Steps to Complete Ingestion:');
  console.log('   1. Initialize database connection (Prisma)');
  console.log('   2. Create a system user/workspace for product KB');
  console.log('   3. Generate embeddings via Google Gemini (free tier)');
  console.log('   4. Insert documents and chunks into database');
  console.log('   5. Store vectors in pgvector');
  console.log('\n💡 Note: The RAG Bot currently uses embedded product knowledge');
  console.log('   in its system prompt for instant answers. This ingestion script');
  console.log('   enables true vector retrieval for more dynamic, citation-rich responses.');

  // FUTURE: Full database ingestion
  /*
  const { prisma } = await import('@/lib/db');
  const { generateEmbeddings } = await import('@/lib/ai');
  const { createVectorStore } = await import('@/lib/db/vector-store');

  // Create or get product KB system user
  const SYSTEM_USER_ID = process.env.PRODUCT_KB_USER_ID || 'rag-bot-kb-system';

  // Create document record
  const document = await prisma.document.create({
    data: {
      name: 'RAG Bot Product Knowledge Base',
      contentType: 'MD',
      size: allChunks.reduce((sum, c) => sum + c.content.length, 0),
      userId: SYSTEM_USER_ID,
      status: 'PROCESSING',
      metadata: { source: 'product-kb', autoIngested: true, version: '1.0.0' },
    },
  });

  // Generate embeddings for all chunks
  const embeddings = await generateEmbeddings(allChunks.map(c => c.content));

  // Insert chunks with embeddings
  const vectorStore = createVectorStore(prisma);
  await vectorStore.addVectorsBatched(
    allChunks.map((chunk, i) => ({
      content: chunk.content,
      embedding: embeddings[i] || [],
      documentId: document.id,
      index: chunk.index,
      section: chunk.source,
    })),
    document.id,
    SYSTEM_USER_ID
  );

  // Mark document as completed
  await prisma.document.update({
    where: { id: document.id },
    data: { status: 'COMPLETED' },
  });

  console.log(`\n✅ Successfully ingested ${allChunks.length} chunks into product KB`);
  console.log(`   Document ID: ${document.id}`);
  */

  console.log('\n✨ Ingestion analysis complete!');
}

// Run if executed directly
if (require.main === module) {
  ingestProductDocs().catch((error) => {
    console.error('❌ Ingestion failed:', error);
    process.exit(1);
  });
}

export { ingestProductDocs, chunkContent, readMarkdownFile };
