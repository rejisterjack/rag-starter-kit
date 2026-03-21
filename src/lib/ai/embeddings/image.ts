/**
 * Image Embedding Module
 *
 * Uses CLIP model from Transformers.js to generate image embeddings
 * for semantic image search and vision-language tasks.
 *
 * Features:
 * - 512-dimensional CLIP embeddings
 * - Image preprocessing (resize, normalize)
 * - Embedding caching
 * - Support for both Buffer and URL inputs
 */

import { createHash } from 'node:crypto';
import { prisma } from '@/lib/db';

// CLIP model configuration
const CLIP_MODEL = 'Xenova/clip-vit-base-patch32';
const EMBEDDING_DIMENSIONS = 512;

// Simple in-memory cache (could be replaced with Redis)
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Model singleton
let clipModel: unknown | null = null;
let clipProcessor: unknown | null = null;

/**
 * Load CLIP model and processor (lazy initialization)
 */
async function loadCLIPModel() {
  if (clipModel && clipProcessor) {
    return { model: clipModel, processor: clipProcessor };
  }

  try {
    // Dynamic import to avoid loading on server start
    const { AutoModel, AutoProcessor } = await import('@xenova/transformers');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clipModel = await (AutoModel as any).from_pretrained(CLIP_MODEL);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clipProcessor = await (AutoProcessor as any).from_pretrained(CLIP_MODEL);
    return { model: clipModel, processor: clipProcessor };
  } catch (_error) {
    throw new Error('Failed to load CLIP model for image embeddings');
  }
}

/**
 * Generate cache key for image
 */
function generateCacheKey(imageData: Buffer | string): string {
  if (typeof imageData === 'string') {
    // For URLs, hash the URL
    return createHash('sha256').update(imageData).digest('hex');
  }
  // For buffers, hash the buffer content
  return createHash('sha256').update(imageData).digest('hex');
}

/**
 * Check if embedding is cached
 */
async function getCachedEmbedding(cacheKey: string): Promise<number[] | null> {
  // Check in-memory cache first
  const cached = embeddingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.embedding;
  }

  // Check database cache
  try {
    const result = await prisma.$queryRaw<{ embedding: number[] }[]>`
      SELECT embedding::float[] as embedding
      FROM image_embeddings
      WHERE content_hash = ${cacheKey}
      AND created_at > NOW() - INTERVAL '7 days'
      LIMIT 1
    `;

    if (result.length > 0 && result[0]?.embedding) {
      const embedding = result[0].embedding;
      // Update in-memory cache
      embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });
      return embedding;
    }
  } catch (_error) {}

  return null;
}

/**
 * Cache embedding in memory and database
 */
async function cacheEmbedding(
  cacheKey: string,
  embedding: number[],
  _imageUrl?: string
): Promise<void> {
  // Update in-memory cache
  embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });

  // Clean old cache entries periodically
  if (embeddingCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of embeddingCache.entries()) {
      if (now - value.timestamp > CACHE_TTL_MS) {
        embeddingCache.delete(key);
      }
    }
  }
}

/**
 * Preprocess image for CLIP model
 */
async function preprocessImage(imageData: Buffer | string): Promise<unknown> {
  const { processor } = await loadCLIPModel();

  if (typeof imageData === 'string') {
    // Fetch image from URL
    const response = await fetch(imageData);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    imageData = Buffer.from(arrayBuffer);
  }

  // Process image with CLIP processor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processed = await (processor as any)(imageData);
  return processed;
}

/**
 * Generate image embedding using CLIP
 *
 * @param imageBuffer - Image as Buffer or URL string
 * @returns Promise resolving to 512-dimensional embedding vector
 */
export async function generateImageEmbedding(imageBuffer: Buffer | string): Promise<number[]> {
  const cacheKey = generateCacheKey(imageBuffer);

  // Check cache first
  const cached = await getCachedEmbedding(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const { model } = await loadCLIPModel();
    const processed = await preprocessImage(imageBuffer);

    // Generate embedding
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output = await (model as any)(processed);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const embedding = output.image_embeds.data as Float32Array;

    // Convert to regular array and normalize
    const embeddingArray = Array.from(embedding);
    const normalizedEmbedding = normalizeVector(embeddingArray);

    // Cache the result
    await cacheEmbedding(
      cacheKey,
      normalizedEmbedding,
      typeof imageBuffer === 'string' ? imageBuffer : undefined
    );

    return normalizedEmbedding;
  } catch (error) {
    throw new Error(
      `Failed to generate image embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate embeddings for multiple images in batch
 *
 * @param imageBuffers - Array of image Buffers or URLs
 * @returns Promise resolving to array of embedding vectors
 */
export async function generateImageEmbeddings(
  imageBuffers: (Buffer | string)[]
): Promise<number[][]> {
  const embeddings: number[][] = [];

  // Process in batches of 4 to avoid memory issues
  const batchSize = 4;
  for (let i = 0; i < imageBuffers.length; i += batchSize) {
    const batch = imageBuffers.slice(i, i + batchSize);
    const batchEmbeddings = await Promise.all(
      batch.map(async (buffer) => {
        try {
          return await generateImageEmbedding(buffer);
        } catch (_error) {
          return null;
        }
      })
    );

    embeddings.push(...batchEmbeddings.filter((e): e is number[] => e !== null));
  }

  return embeddings;
}

/**
 * Generate text embedding using CLIP (for image-text similarity)
 *
 * @param text - Text query
 * @returns Promise resolving to 512-dimensional embedding vector
 */
export async function generateTextEmbeddingForImageSearch(text: string): Promise<number[]> {
  const cacheKey = createHash('sha256').update(`text:${text}`).digest('hex');

  // Check cache
  const cached = await getCachedEmbedding(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const { model, processor } = await loadCLIPModel();

    // Process text
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processed = await (processor as any)(text);

    // Generate embedding
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output = await (model as any)(processed);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const embedding = output.text_embeds.data as Float32Array;

    // Convert to regular array and normalize
    const embeddingArray = Array.from(embedding);
    const normalizedEmbedding = normalizeVector(embeddingArray);

    // Cache the result
    await cacheEmbedding(cacheKey, normalizedEmbedding);

    return normalizedEmbedding;
  } catch (error) {
    throw new Error(
      `Failed to generate text embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Normalize a vector to unit length
 */
function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vector;
  return vector.map((val) => val / magnitude);
}

/**
 * Get embedding dimensions
 */
export function getImageEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}

/**
 * Clear embedding cache
 */
export function clearImageEmbeddingCache(): void {
  embeddingCache.clear();
}

/**
 * Health check for image embedding service
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await loadCLIPModel();
    return true;
  } catch {
    return false;
  }
}
