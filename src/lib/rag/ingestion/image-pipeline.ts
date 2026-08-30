/**
 * Image Ingestion Pipeline
 *
 * Extracts images from PDFs, generates embeddings, and stores them.
 * Supports:
 * - PDF image extraction
 * - Image embedding generation using CLIP
 * - Cloudinary storage
 * - Caption generation using vision-language models
 */

import { createHash } from 'node:crypto';
import { generateImageEmbedding } from '@/lib/ai/embeddings/image';
import { asModel } from '@/lib/ai/types';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  deleteImagePoints,
  searchSimilarImages as qdrantSearchSimilarImages,
  upsertImageEmbedding,
} from '@/lib/vector';

/**
 * Image metadata extracted from documents
 */
export interface ExtractedImage {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  pageNumber?: number;
  width?: number;
  height?: number;
}

/**
 * Image processing result
 */
export interface ImageProcessingResult {
  imageId: string;
  embeddingId: string;
  storageUrl: string;
  caption?: string;
  ocrText?: string;
}

/**
 * Processed image with metadata
 */
export interface ProcessedImage {
  id: string;
  documentId: string;
  storageUrl: string;
  caption?: string;
  ocrText?: string;
  pageNumber?: number;
  embedding?: number[];
}

/**
 * Extract images from PDF buffer
 * Uses pdf2pic for image extraction
 *
 * @param pdfBuffer - PDF file buffer
 * @returns Array of extracted images
 */
export async function extractImagesFromPDF(pdfBuffer: Buffer): Promise<ExtractedImage[]> {
  try {
    // Dynamic import to avoid loading on server start
    const pdf2picModule = await import('pdf2pic');

    const images: ExtractedImage[] = [];

    // Get PDF info to determine page count
    const pdfParse = await import('pdf-parse');
    const pdfData = await pdfParse.default(pdfBuffer, { max: 0 });
    const pageCount = pdfData.numpages;

    // Configure pdf2pic
    const convert = pdf2picModule.fromBuffer(pdfBuffer, {
      density: 150, // DPI
      format: 'png',
      width: 1200,
      height: 1600,
      preserveAspectRatio: true,
    }) as (
      pageNum: number,
      options: { responseType: string }
    ) => Promise<{ buffer?: Buffer | Uint8Array; size?: { width?: number; height?: number } }>;

    // Extract images from each page
    for (let pageNum = 1; pageNum <= Math.min(pageCount, 50); pageNum++) {
      try {
        const result = await convert(pageNum, { responseType: 'buffer' });

        if (result?.buffer) {
          images.push({
            buffer: Buffer.isBuffer(result.buffer) ? result.buffer : Buffer.from(result.buffer),
            filename: `page_${pageNum}.png`,
            mimeType: 'image/png',
            pageNumber: pageNum,
            width: result.size?.width,
            height: result.size?.height,
          });
        }
      } catch (error) {
        logger.warn('Failed to extract image from PDF page', {
          pageNum,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return images;
  } catch (error) {
    logger.warn('PDF image extraction failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Return empty array if extraction fails
    return [];
  }
}

/**
 * Upload image to Cloudinary storage
 *
 * @param buffer - Image buffer
 * @param filename - Filename for the image
 * @param documentId - Parent document ID
 * @returns Storage URL
 */
export async function uploadImageToStorage(
  buffer: Buffer,
  filename: string,
  documentId: string
): Promise<{ storageKey: string; storageUrl: string }> {
  try {
    const USE_CLOUDINARY =
      !!process.env.CLOUDINARY_URL ||
      !!(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
      );

    if (!USE_CLOUDINARY) {
      const base64 = buffer.toString('base64');
      return {
        storageKey: `local/${documentId}/${filename}`,
        storageUrl: `data:image/png;base64,${base64}`,
      };
    }

    const { uploadFile } = await import('@/lib/storage/cloudinary-storage');

    const storageKey = `documents/${documentId}/${Date.now()}_${filename}`;
    const result = await uploadFile(storageKey, buffer, {
      contentType: 'image/png',
      resourceType: 'image',
      metadata: {
        documentId,
        originalName: filename,
      },
    });

    return { storageKey, storageUrl: result.url };
  } catch (error) {
    logger.warn('Image upload to storage failed, using fallback', {
      documentId,
      filename,
      error: error instanceof Error ? error.message : String(error),
    });
    const base64 = buffer.toString('base64');
    return {
      storageKey: `fallback/${documentId}/${filename}`,
      storageUrl: `data:image/png;base64,${base64}`,
    };
  }
}

/**
 * Generate caption for image using vision-language model
 * Uses Google Gemini Vision API
 *
 * @param imageBuffer - Image buffer or URL
 * @returns Generated caption
 */
export async function generateImageCaption(imageBuffer: Buffer | string): Promise<string> {
  try {
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
    const ai = await import('ai');
    const { generateText } = ai;

    // Convert buffer to base64 if needed
    let imageData: string;
    if (typeof imageBuffer === 'string') {
      imageData = imageBuffer;
    } else {
      const base64 = imageBuffer.toString('base64');
      imageData = `data:image/png;base64,${base64}`;
    }

    const googleAI = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });

    const result = await generateText({
      model: asModel<Parameters<typeof generateText>[0]['model']>(googleAI('gemini-1.5-flash')),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe this image in detail. What is shown? What are the key elements?',
            },
            { type: 'image', image: imageData },
          ],
        },
      ],
    });

    return result.text;
  } catch (error) {
    logger.warn('Image caption generation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return '';
  }
}

/**
 * Process a single image through the pipeline
 *
 * @param image - Extracted image
 * @param documentId - Parent document ID
 * @param chunkId - Optional associated chunk ID
 * @returns Processing result
 */
export async function processImage(
  image: ExtractedImage,
  documentId: string,
  chunkId?: string
): Promise<ImageProcessingResult | null> {
  try {
    // Step 1: Upload to storage
    const { storageKey, storageUrl } = await uploadImageToStorage(
      image.buffer,
      image.filename,
      documentId
    );

    // Step 2: Generate embedding
    const embedding = await generateImageEmbedding(image.buffer);

    // Step 3: Generate caption (async, don't wait)
    const captionPromise = generateImageCaption(image.buffer);

    // Step 4: Create database records in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create DocumentImage record
      const docImage = await tx.documentImage.create({
        data: {
          documentId,
          chunkId,
          filename: image.filename,
          mimeType: image.mimeType,
          size: image.buffer.length,
          width: image.width,
          height: image.height,
          storageKey,
          storageUrl,
          pageNumber: image.pageNumber,
          status: 'PROCESSING',
        },
      });

      // Upsert image embedding into pgvector
      const contentHash = createHash('sha256').update(image.buffer).digest('hex');
      const doc = await tx.document.findUnique({
        where: { id: documentId },
        select: { userId: true },
      });
      await upsertImageEmbedding({
        id: crypto.randomUUID(),
        documentId,
        userId: doc?.userId ?? '',
        embedding,
        storageUrl: docImage.storageUrl,
        caption: undefined,
        pageNumber: image.pageNumber,
        model: 'Xenova/clip-vit-base-patch32',
        dimensions: embedding.length,
      });

      return { docImage, imageEmbedding: undefined, contentHash };
    });

    // Step 5: Update with caption (if available)
    let caption: string | undefined;
    try {
      caption = await Promise.race([
        captionPromise,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Caption timeout')), 10000)
        ),
      ]);

      await prisma.documentImage.update({
        where: { id: result.docImage.id },
        data: {
          caption,
          status: 'COMPLETED',
        },
      });
    } catch (error) {
      // Caption generation timed out or failed, that's ok
      logger.warn('Caption generation timed out or failed', {
        documentId,
        imageId: result.docImage.id,
        error: error instanceof Error ? error.message : String(error),
      });
      await prisma.documentImage.update({
        where: { id: result.docImage.id },
        data: { status: 'COMPLETED' },
      });
    }

    return {
      imageId: result.docImage.id,
      embeddingId: result.contentHash, // Using content hash as identifier
      storageUrl,
      caption,
    };
  } catch (error) {
    logger.warn('Image processing failed', {
      documentId,
      filename: image.filename,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Process multiple images from a document
 *
 * @param images - Array of extracted images
 * @param documentId - Parent document ID
 * @returns Array of processing results
 */
export async function processDocumentImages(
  images: ExtractedImage[],
  documentId: string
): Promise<ImageProcessingResult[]> {
  const results: ImageProcessingResult[] = [];

  // Process images in batches of 3 to avoid overwhelming the system
  const batchSize = 3;
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((image) => processImage(image, documentId)));

    results.push(...batchResults.filter((r): r is ImageProcessingResult => r !== null));
  }

  return results;
}

/**
 * Process images from a PDF document
 *
 * @param pdfBuffer - PDF file buffer
 * @param documentId - Document ID
 * @returns Processing results
 */
export async function processPDFImages(
  pdfBuffer: Buffer,
  documentId: string
): Promise<ImageProcessingResult[]> {
  try {
    // Extract images from PDF
    const images = await extractImagesFromPDF(pdfBuffer);

    if (images.length === 0) {
      return [];
    }

    // Process extracted images
    return processDocumentImages(images, documentId);
  } catch (error) {
    logger.warn('PDF image processing failed', {
      documentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Search for similar images
 *
 * @param queryImage - Query image buffer or URL
 * @param workspaceId - Workspace to search in
 * @param topK - Number of results to return
 * @returns Similar images with scores
 */
export async function searchSimilarImages(
  queryImage: Buffer | string,
  workspaceId: string,
  topK = 5
): Promise<Array<ProcessedImage & { similarity: number }>> {
  try {
    // Generate query embedding
    const queryEmbedding = await generateImageEmbedding(queryImage);

    // Search for similar images using pgvector
    const results = await qdrantSearchSimilarImages(queryEmbedding, {
      userId: workspaceId,
      topK,
    });

    return results.map((r) => {
      const p = r.payload ?? {};
      return {
        id: String(r.id),
        documentId: String(p.documentId ?? ''),
        storageUrl: String(p.storageUrl ?? ''),
        caption: (p.caption as string | null) ?? undefined,
        pageNumber: (p.pageNumber as number | null) ?? undefined,
        similarity: r.score,
      };
    });
  } catch (error) {
    logger.warn('Similar image search failed', {
      workspaceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Search images by text query
 * Uses CLIP text embeddings to find semantically similar images
 *
 * @param query - Text query
 * @param workspaceId - Workspace to search in
 * @param topK - Number of results to return
 * @returns Matching images with scores
 */
export async function searchImagesByText(
  query: string,
  workspaceId: string,
  topK = 5
): Promise<Array<ProcessedImage & { similarity: number }>> {
  try {
    // Import here to avoid circular dependency
    const { generateTextEmbeddingForImageSearch } = await import('@/lib/ai/embeddings/image');

    // Generate text embedding
    const textEmbedding = await generateTextEmbeddingForImageSearch(query);

    // Search for similar images using pgvector
    const results = await qdrantSearchSimilarImages(textEmbedding, {
      userId: workspaceId,
      topK,
    });

    return results.map((r) => {
      const p = r.payload ?? {};
      return {
        id: String(r.id),
        documentId: String(p.documentId ?? ''),
        storageUrl: String(p.storageUrl ?? ''),
        caption: (p.caption as string | null) ?? undefined,
        pageNumber: (p.pageNumber as number | null) ?? undefined,
        similarity: r.score,
      };
    });
  } catch (error) {
    logger.warn('Image search by text failed', {
      workspaceId,
      query,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Get images for a document
 *
 * @param documentId - Document ID
 * @returns Array of processed images
 */
export async function getDocumentImages(documentId: string): Promise<ProcessedImage[]> {
  const images = await prisma.documentImage.findMany({
    where: { documentId },
    orderBy: { pageNumber: 'asc' },
  });

  return images.map((img) => ({
    id: img.id,
    documentId: img.documentId,
    storageUrl: img.storageUrl,
    caption: img.caption || undefined,
    ocrText: img.ocrText || undefined,
    pageNumber: img.pageNumber || undefined,
  }));
}

/**
 * Delete images for a document
 *
 * @param documentId - Document ID
 */
export async function deleteDocumentImages(documentId: string): Promise<void> {
  const USE_CLOUDINARY =
    !!process.env.CLOUDINARY_URL ||
    !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );

  if (USE_CLOUDINARY) {
    try {
      const { deleteDocumentFiles } = await import('@/lib/storage/cloudinary-storage');
      await deleteDocumentFiles(documentId);
    } catch (error) {
      logger.warn('Failed to delete images from Cloudinary', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Delete from pgvector
  try {
    await deleteImagePoints(documentId);
  } catch (error) {
    logger.warn('Failed to delete image points from pgvector', {
      documentId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Delete from database (cascades to embeddings)
  await prisma.documentImage.deleteMany({
    where: { documentId },
  });
}
