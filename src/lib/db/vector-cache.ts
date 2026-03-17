/**
 * Vector Cache
 * 
 * Redis-based caching layer for embeddings and query results.
 * Reduces API costs and improves response times.
 */

import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface CacheConfig {
  /** Default TTL in seconds (default: 86400 = 24 hours) */
  defaultTtl?: number;
  /** Maximum entry size in bytes (default: 1MB) */
  maxEntrySize?: number;
  /** Key prefix for namespacing (default: 'rag:') */
  keyPrefix?: string;
  /** Enable compression for large values (default: true) */
  compression?: boolean;
}

export interface SemanticCacheEntry {
  /** Original query */
  query: string;
  /** Query embedding */
  queryEmbedding: number[];
  /** Search results */
  results: unknown;
  /** Timestamp */
  cachedAt: Date;
  /** Access count for LRU tracking */
  accessCount: number;
}

export interface CacheStats {
  /** Total keys in cache */
  totalKeys: number;
  /** Memory usage */
  memoryUsage: string;
  /** Hit rate */
  hitRate: number;
  /** Miss rate */
  missRate: number;
}

// ============================================================================
// Cache Provider Interface
// ============================================================================

export interface CacheProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  getBuffer(key: string): Promise<Buffer | null>;
  setBuffer(key: string, value: Buffer, ttlSeconds?: number): Promise<void>;
  mget(keys: string[]): Promise<(string | null)[]>;
  del(key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
  flush(): Promise<void>;
  stats(): Promise<CacheStats>;
}

// ============================================================================
// Embedding Cache
// ============================================================================

export class EmbeddingCache {
  private config: Required<CacheConfig>;
  private hitCount = 0;
  private missCount = 0;

  constructor(
    private cache: CacheProvider,
    config: CacheConfig = {}
  ) {
    this.config = {
      defaultTtl: 86400, // 24 hours
      maxEntrySize: 1024 * 1024, // 1MB
      keyPrefix: 'rag:embed:',
      compression: true,
      ...config,
    };
  }

  /**
   * Generate cache key for text
   */
  private generateKey(text: string, model: string): string {
    // Normalize text for consistent caching
    const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
    const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
    return `${this.config.keyPrefix}${model}:${hash}`;
  }

  /**
   * Get cached embedding
   */
  async get(text: string, model: string): Promise<number[] | null> {
    const key = this.generateKey(text, model);
    
    try {
      const cached = await this.cache.get(key);
      
      if (cached) {
        this.hitCount++;
        return JSON.parse(cached) as number[];
      }
      
      this.missCount++;
      return null;
    } catch (error) {
      console.warn('Cache get error:', error);
      this.missCount++;
      return null;
    }
  }

  /**
   * Set embedding in cache
   */
  async set(
    text: string,
    model: string,
    embedding: number[],
    ttlSeconds?: number
  ): Promise<void> {
    const key = this.generateKey(text, model);
    const value = JSON.stringify(embedding);

    // Check size limit
    if (Buffer.byteLength(value, 'utf8') > this.config.maxEntrySize) {
      console.warn(`Embedding too large to cache: ${key}`);
      return;
    }

    try {
      await this.cache.set(key, value, ttlSeconds ?? this.config.defaultTtl);
    } catch (error) {
      console.warn('Cache set error:', error);
    }
  }

  /**
   * Get multiple embeddings from cache
   */
  async getBatch(
    texts: string[],
    model: string
  ): Promise<Map<string, number[] | null>> {
    const keys = texts.map((text) => this.generateKey(text, model));
    const results = new Map<string, number[] | null>();

    try {
      const cached = await this.cache.mget(keys);
      
      texts.forEach((text, index) => {
        const value = cached[index];
        if (value) {
          this.hitCount++;
          results.set(text, JSON.parse(value) as number[]);
        } else {
          this.missCount++;
          results.set(text, null);
        }
      });
    } catch (error) {
      console.warn('Cache batch get error:', error);
      texts.forEach((text) => results.set(text, null));
    }

    return results;
  }

  /**
   * Set multiple embeddings in cache
   */
  async setBatch(
    entries: Array<{ text: string; embedding: number[] }>,
    model: string,
    ttlSeconds?: number
  ): Promise<void> {
    const ttl = ttlSeconds ?? this.config.defaultTtl;

    await Promise.all(
      entries.map(async (entry) => {
        try {
          await this.set(entry.text, model, entry.embedding, ttl);
        } catch (error) {
          console.warn('Failed to cache embedding:', error);
        }
      })
    );
  }

  /**
   * Invalidate cached embedding
   */
  async invalidate(text: string, model: string): Promise<void> {
    const key = this.generateKey(text, model);
    await this.cache.del(key);
  }

  /**
   * Clear all embedding cache
   */
  async clear(): Promise<void> {
    const keys = await this.cache.keys(`${this.config.keyPrefix}*`);
    await Promise.all(keys.map((key) => this.cache.del(key)));
  }

  /**
   * Get cache statistics
   */
  getStats(): { hits: number; misses: number; hitRate: number } {
    const total = this.hitCount + this.missCount;
    return {
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: total > 0 ? this.hitCount / total : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
  }
}

// ============================================================================
// Semantic Query Cache
// ============================================================================

export class SemanticCache {
  private config: Required<CacheConfig>;
  private similarityThreshold: number;

  constructor(
    private cache: CacheProvider,
    config: CacheConfig & { similarityThreshold?: number } = {}
  ) {
    this.config = {
      defaultTtl: 3600, // 1 hour for query results
      maxEntrySize: 5 * 1024 * 1024, // 5MB
      keyPrefix: 'rag:query:',
      compression: true,
      ...config,
    };
    this.similarityThreshold = config.similarityThreshold ?? 0.95;
  }

  /**
   * Find similar cached query using embedding similarity
   */
  async findSimilar(
    _query: string,
    queryEmbedding: number[]
  ): Promise<unknown | null> {
    try {
      // Get all cached query keys
      const keys = await this.cache.keys(`${this.config.keyPrefix}*`);
      
      if (keys.length === 0) return null;

      // Get all cached entries
      const entries = await this.cache.mget(keys);
      
      for (const entry of entries) {
        if (!entry) continue;
        
        try {
          const cached = JSON.parse(entry) as SemanticCacheEntry;
          
          // Check if embeddings are similar enough
          const similarity = this.cosineSimilarity(
            queryEmbedding,
            cached.queryEmbedding
          );
          
          if (similarity >= this.similarityThreshold) {
            // Update access count for LRU
            cached.accessCount++;
            await this.cache.set(
              this.generateKey(cached.query),
              JSON.stringify(cached),
              this.config.defaultTtl
            );
            
            return cached.results;
          }
        } catch {
          // Skip invalid entries
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Semantic cache lookup error:', error);
      return null;
    }
  }

  /**
   * Cache query results
   */
  async set(
    query: string,
    queryEmbedding: number[],
    results: unknown,
    ttlSeconds?: number
  ): Promise<void> {
    const key = this.generateKey(query);
    const entry: SemanticCacheEntry = {
      query,
      queryEmbedding,
      results,
      cachedAt: new Date(),
      accessCount: 1,
    };

    const value = JSON.stringify(entry);

    if (Buffer.byteLength(value, 'utf8') > this.config.maxEntrySize) {
      console.warn(`Query result too large to cache: ${key}`);
      return;
    }

    try {
      await this.cache.set(key, value, ttlSeconds ?? this.config.defaultTtl);
    } catch (error) {
      console.warn('Semantic cache set error:', error);
    }
  }

  /**
   * Invalidate cached query
   */
  async invalidate(query: string): Promise<void> {
    const key = this.generateKey(query);
    await this.cache.del(key);
  }

  /**
   * Clear all semantic cache
   */
  async clear(): Promise<void> {
    const keys = await this.cache.keys(`${this.config.keyPrefix}*`);
    await Promise.all(keys.map((key) => this.cache.del(key)));
  }

  /**
   * Get cache size
   */
  async getSize(): Promise<number> {
    const keys = await this.cache.keys(`${this.config.keyPrefix}*`);
    return keys.length;
  }

  /**
   * Generate cache key for query
   */
  private generateKey(query: string): string {
    const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
    const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
    return `${this.config.keyPrefix}${hash}`;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += (a[i] ?? 0) * (b[i] ?? 0);
      normA += (a[i] ?? 0) ** 2;
      normB += (b[i] ?? 0) ** 2;
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// ============================================================================
// Memory Cache Provider (Fallback)
// ============================================================================

export class MemoryCacheProvider implements CacheProvider {
  private cache = new Map<string, { value: string; expires: number }>();
  private bufferCache = new Map<string, { value: Buffer; expires: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds = 3600): Promise<void> {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }

  async getBuffer(key: string): Promise<Buffer | null> {
    const entry = this.bufferCache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.bufferCache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  async setBuffer(key: string, value: Buffer, ttlSeconds = 3600): Promise<void> {
    this.bufferCache.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    return Promise.all(keys.map((key) => this.get(key)));
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
    this.bufferCache.delete(key);
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.cache.keys()).filter((k) => regex.test(k));
  }

  async flush(): Promise<void> {
    this.cache.clear();
    this.bufferCache.clear();
  }

  async stats(): Promise<CacheStats> {
    let memoryUsage = 0;
    
    for (const entry of this.cache.values()) {
      memoryUsage += Buffer.byteLength(entry.value, 'utf8');
    }
    
    for (const entry of this.bufferCache.values()) {
      memoryUsage += entry.value.length;
    }

    return {
      totalKeys: this.cache.size + this.bufferCache.size,
      memoryUsage: `${(memoryUsage / 1024 / 1024).toFixed(2)} MB`,
      hitRate: 0,
      missRate: 0,
    };
  }

  /** Cleanup expired entries */
  cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
    
    for (const [key, entry] of this.bufferCache.entries()) {
      if (now > entry.expires) {
        this.bufferCache.delete(key);
      }
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create embedding cache with provider
 */
export function createEmbeddingCache(
  provider?: CacheProvider,
  config?: CacheConfig
): EmbeddingCache {
  return new EmbeddingCache(provider ?? new MemoryCacheProvider(), config);
}

/**
 * Create semantic cache with provider
 */
export function createSemanticCache(
  provider?: CacheProvider,
  config?: CacheConfig & { similarityThreshold?: number }
): SemanticCache {
  return new SemanticCache(provider ?? new MemoryCacheProvider(), config);
}
