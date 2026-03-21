/**
 * Multi-modal Retrieval Engine
 * 
 * Extends the retrieval engine with image search capabilities:
 * - Search by image (reverse image search)
 * - Search with vision (text + image queries)
 * - Multi-modal result fusion
 */

import { prisma } from '@/lib/db';
import {
  generateImageEmbedding,
  generateTextEmbeddingForImageSearch,
} from '@/lib/ai/embeddings/image';
import type { RetrievedChunk, RetrievalOptions } from './types';

/**
 * Image search result
 */
export interface ImageSearchResult {
  id: string;
  documentId: string;
  documentName: string;
  storageUrl: string;
  caption?: string;
  ocrText?: string;
  pageNumber?: number;
  similarity: number;
  metadata?: {
    width?: number;
    height?: number;
    mimeType?: string;
  };
}

/**
 * Multi-modal search options
 */
export interface MultiModalSearchOptions extends Omit<RetrievalOptions, 'query'> {
  /** Search query text */
  query: string;
  /** Image buffer or URL for image-based search */
  imageQuery?: Buffer | string;
  /** Weight for image vs text (0-1, default: 0.5) */
  imageWeight?: number;
  /** Include related document chunks in results */
  includeChunks?: boolean;
  /** Minimum similarity threshold for images */
  minImageScore?: number;
}

/**
 * Multi-modal search result
 */
export interface MultiModalSearchResult {
  images: ImageSearchResult[];
  chunks: RetrievedChunk[];
  totalResults: number;
  processingTimeMs: number;
  queryType: 'text-only' | 'image-only' | 'multimodal';
}

/**
 * Search for similar images
 * 
 * @param queryImage - Query image buffer or URL
 * @param workspaceId - Workspace to search in
 * @param options - Search options
 * @returns Similar images with scores
 */
export async function searchByImage(
  queryImage: Buffer | string,
  workspaceId: string,
  options: Omit<MultiModalSearchOptions, 'workspaceId' | 'query'> & { query?: string } = {}
): Promise<MultiModalSearchResult> {
  const startTime = Date.now();
  const topK = options.topK ?? 5;
  const minScore = options.minImageScore ?? 0.7;
  const includeChunks = options.includeChunks ?? false;
  
  try {
    // Generate query embedding
    const queryEmbedding = await generateImageEmbedding(queryImage);
    
    // Search for similar images using pgvector
    const results = await prisma.$queryRaw<Array<{
      id: string;
      document_id: string;
      document_name: string;
      storage_url: string;
      caption: string | null;
      ocr_text: string | null;
      page_number: number | null;
      width: number | null;
      height: number | null;
      mime_type: string;
      similarity: number;
    }>>`
      SELECT 
        di.id,
        di.document_id,
        d.name as document_name,
        di.storage_url,
        di.caption,
        di.ocr_text,
        di.page_number,
        di.width,
        di.height,
        di.mime_type,
        1 - (ie.embedding <=> ${queryEmbedding}::vector) as similarity
      FROM image_embeddings ie
      JOIN document_images di ON ie.image_id = di.id
      JOIN documents d ON di.document_id = d.id
      WHERE d.user_id = ${workspaceId}
        AND d.status = 'COMPLETED'
        AND ie.embedding IS NOT NULL
        AND 1 - (ie.embedding <=> ${queryEmbedding}::vector) > ${minScore}
      ORDER BY ie.embedding <=> ${queryEmbedding}::vector
      LIMIT ${topK}
    `;
    
    const images: ImageSearchResult[] = results.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      documentName: r.document_name,
      storageUrl: r.storage_url,
      caption: r.caption || undefined,
      ocrText: r.ocr_text || undefined,
      pageNumber: r.page_number || undefined,
      similarity: Number(r.similarity),
      metadata: {
        width: r.width || undefined,
        height: r.height || undefined,
        mimeType: r.mime_type,
      },
    }));
    
    // Optionally fetch related chunks
    let chunks: RetrievedChunk[] = [];
    if (includeChunks && images.length > 0) {
      const documentIds = [...new Set(images.map((img) => img.documentId))];
      
      // Get chunks from related documents
      const chunkResults = await prisma.$queryRaw<Array<{
        id: string;
        document_id: string;
        content: string;
        index: number;
        page: number | null;
        section: string | null;
        document_name: string;
      }>>`
        SELECT 
          dc.id,
          dc.document_id,
          dc.content,
          dc.index,
          dc.page,
          dc.section,
          d.name as document_name
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE dc.document_id = ANY(${documentIds}::text[])
          AND d.user_id = ${workspaceId}
        ORDER BY dc.index
        LIMIT ${topK * 2}
      `;
      
      chunks = chunkResults.map((c) => ({
        id: c.id,
        content: c.content,
        score: 0.5, // Default score for associated chunks
        metadata: {
          documentId: c.document_id,
          documentName: c.document_name,
          documentType: 'PDF',
          page: c.page || undefined,
          position: c.index,
          section: c.section || undefined,
        },
        retrievalMethod: 'image-associated',
      }));
    }
    
    return {
      images,
      chunks,
      totalResults: images.length + chunks.length,
      processingTimeMs: Date.now() - startTime,
      queryType: 'image-only',
    };
  } catch (error) {
    console.error('[MultiModalRetrieval] Image search failed:', error);
    throw new Error(`Image search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search images by text query using CLIP text embeddings
 * 
 * @param query - Text query
 * @param workspaceId - Workspace to search in
 * @param options - Search options
 * @returns Matching images with scores
 */
export async function searchImagesByText(
  query: string,
  workspaceId: string,
  options: Omit<MultiModalSearchOptions, 'workspaceId' | 'query'> = {}
): Promise<MultiModalSearchResult> {
  const startTime = Date.now();
  const topK = options.topK ?? 5;
  const minScore = options.minImageScore ?? 0.6;
  const includeChunks = options.includeChunks ?? false;
  
  try {
    // Generate text embedding for image search
    const textEmbedding = await generateTextEmbeddingForImageSearch(query);
    
    // Search for matching images
    const results = await prisma.$queryRaw<Array<{
      id: string;
      document_id: string;
      document_name: string;
      storage_url: string;
      caption: string | null;
      ocr_text: string | null;
      page_number: number | null;
      width: number | null;
      height: number | null;
      mime_type: string;
      similarity: number;
    }>>`
      SELECT 
        di.id,
        di.document_id,
        d.name as document_name,
        di.storage_url,
        di.caption,
        di.ocr_text,
        di.page_number,
        di.width,
        di.height,
        di.mime_type,
        1 - (ie.embedding <=> ${textEmbedding}::vector) as similarity
      FROM image_embeddings ie
      JOIN document_images di ON ie.image_id = di.id
      JOIN documents d ON di.document_id = d.id
      WHERE d.user_id = ${workspaceId}
        AND d.status = 'COMPLETED'
        AND ie.embedding IS NOT NULL
        AND 1 - (ie.embedding <=> ${textEmbedding}::vector) > ${minScore}
      ORDER BY ie.embedding <=> ${textEmbedding}::vector
      LIMIT ${topK}
    `;
    
    const images: ImageSearchResult[] = results.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      documentName: r.document_name,
      storageUrl: r.storage_url,
      caption: r.caption || undefined,
      ocrText: r.ocr_text || undefined,
      pageNumber: r.page_number || undefined,
      similarity: Number(r.similarity),
      metadata: {
        width: r.width || undefined,
        height: r.height || undefined,
        mimeType: r.mime_type,
      },
    }));
    
    // Optionally fetch related chunks
    let chunks: RetrievedChunk[] = [];
    if (includeChunks && images.length > 0) {
      const documentIds = [...new Set(images.map((img) => img.documentId))];
      
      const chunkResults = await prisma.$queryRaw<Array<{
        id: string;
        document_id: string;
        content: string;
        index: number;
        page: number | null;
        section: string | null;
        document_name: string;
      }>>`
        SELECT 
          dc.id,
          dc.document_id,
          dc.content,
          dc.index,
          dc.page,
          dc.section,
          d.name as document_name
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE dc.document_id = ANY(${documentIds}::text[])
          AND d.user_id = ${workspaceId}
        ORDER BY dc.index
        LIMIT ${topK * 2}
      `;
      
      chunks = chunkResults.map((c) => ({
        id: c.id,
        content: c.content,
        score: 0.5,
        metadata: {
          documentId: c.document_id,
          documentName: c.document_name,
          documentType: 'PDF',
          page: c.page || undefined,
          position: c.index,
          section: c.section || undefined,
        },
        retrievalMethod: 'text-image-associated',
      }));
    }
    
    return {
      images,
      chunks,
      totalResults: images.length + chunks.length,
      processingTimeMs: Date.now() - startTime,
      queryType: 'text-only',
    };
  } catch (error) {
    console.error('[MultiModalRetrieval] Text-based image search failed:', error);
    throw new Error(`Text-based image search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Multi-modal search combining text and image queries
 * 
 * @param query - Text query
 * @param imageQuery - Optional image query
 * @param workspaceId - Workspace to search in
 * @param options - Search options
 * @returns Combined search results
 */
export async function searchMultiModal(
  query: string,
  imageQuery: Buffer | string | undefined,
  workspaceId: string,
  options: Omit<MultiModalSearchOptions, 'workspaceId' | 'query'> = {}
): Promise<MultiModalSearchResult> {
  const startTime = Date.now();
  const imageWeight = options.imageWeight ?? 0.5;
  
  // If only image provided, do image search
  if (!query && imageQuery) {
    return searchByImage(imageQuery, workspaceId, options);
  }
  
  // If only text provided, do text-based image search
  if (query && !imageQuery) {
    return searchImagesByText(query, workspaceId, options);
  }
  
  // Both text and image provided - combine results
  if (query && imageQuery) {
    const [imageResults, textResults] = await Promise.all([
      searchByImage(imageQuery, workspaceId, { ...options, includeChunks: false }),
      searchImagesByText(query, workspaceId, { ...options, includeChunks: false }),
    ]);
    
    // Merge and re-rank results
    const mergedImages = mergeImageResults(
      imageResults.images,
      textResults.images,
      imageWeight
    );
    
    // Get chunks if requested
    let chunks: RetrievedChunk[] = [];
    if (options.includeChunks && mergedImages.length > 0) {
      const documentIds = [...new Set(mergedImages.map((img) => img.documentId))];
      
      const chunkResults = await prisma.$queryRaw<Array<{
        id: string;
        document_id: string;
        content: string;
        index: number;
        page: number | null;
        section: string | null;
        document_name: string;
      }>>`
        SELECT 
          dc.id,
          dc.document_id,
          dc.content,
          dc.index,
          dc.page,
          dc.section,
          d.name as document_name
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE dc.document_id = ANY(${documentIds}::text[])
          AND d.user_id = ${workspaceId}
        ORDER BY dc.index
        LIMIT ${(options.topK ?? 5) * 2}
      `;
      
      chunks = chunkResults.map((c) => ({
        id: c.id,
        content: c.content,
        score: 0.5,
        metadata: {
          documentId: c.document_id,
          documentName: c.document_name,
          documentType: 'PDF',
          page: c.page || undefined,
          position: c.index,
          section: c.section || undefined,
        },
        retrievalMethod: 'multimodal-associated',
      }));
    }
    
    return {
      images: mergedImages,
      chunks,
      totalResults: mergedImages.length + chunks.length,
      processingTimeMs: Date.now() - startTime,
      queryType: 'multimodal',
    };
  }
  
  // Fallback - no query provided
  return {
    images: [],
    chunks: [],
    totalResults: 0,
    processingTimeMs: Date.now() - startTime,
    queryType: 'text-only',
  };
}

/**
 * Merge image results from text and image queries
 * Uses weighted reciprocal rank fusion
 */
function mergeImageResults(
  imageResults: ImageSearchResult[],
  textResults: ImageSearchResult[],
  imageWeight: number
): ImageSearchResult[] {
  const scores = new Map<string, { image: ImageSearchResult; score: number }>();
  const rrfK = 60;
  
  // Add image query results
  imageResults.forEach((img, rank) => {
    const existing = scores.get(img.id);
    const rrfScore = imageWeight * (1 / (rrfK + rank + 1));
    
    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(img.id, { image: img, score: rrfScore });
    }
  });
  
  // Add text query results
  textResults.forEach((img, rank) => {
    const existing = scores.get(img.id);
    const rrfScore = (1 - imageWeight) * (1 / (rrfK + rank + 1));
    
    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(img.id, { image: img, score: rrfScore });
    }
  });
  
  // Sort by combined score
  const merged = Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map((item) => ({
      ...item.image,
      similarity: item.score, // Use RRF score as similarity
    }));
  
  return merged;
}

/**
 * Get images for a specific page in a document
 * 
 * @param documentId - Document ID
 * @param pageNumber - Page number
 * @returns Images on that page
 */
export async function getPageImages(
  documentId: string,
  pageNumber: number
): Promise<ImageSearchResult[]> {
  const images = await prisma.documentImage.findMany({
    where: {
      documentId,
      pageNumber,
    },
    include: {
      document: {
        select: {
          name: true,
        },
      },
    },
  });
  
  return images.map((img) => ({
    id: img.id,
    documentId: img.documentId,
    documentName: img.document.name,
    storageUrl: img.storageUrl,
    caption: img.caption || undefined,
    ocrText: img.ocrText || undefined,
    pageNumber: img.pageNumber || undefined,
    similarity: 1.0, // Exact match
  }));
}

/**
 * Get all images for a document
 * 
 * @param documentId - Document ID
 * @returns All document images
 */
export async function getDocumentImages(
  documentId: string
): Promise<ImageSearchResult[]> {
  const images = await prisma.documentImage.findMany({
    where: {
      documentId,
    },
    orderBy: {
      pageNumber: 'asc',
    },
    include: {
      document: {
        select: {
          name: true,
        },
      },
    },
  });
  
  return images.map((img) => ({
    id: img.id,
    documentId: img.documentId,
    documentName: img.document.name,
    storageUrl: img.storageUrl,
    caption: img.caption || undefined,
    ocrText: img.ocrText || undefined,
    pageNumber: img.pageNumber || undefined,
    similarity: 1.0,
  }));
}
