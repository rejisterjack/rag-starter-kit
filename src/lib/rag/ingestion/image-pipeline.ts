/**
 * Image Ingestion Pipeline
 * 
 * Extracts images from PDFs, generates embeddings, and stores them.
 * Supports:
 * - PDF image extraction
 * - Image embedding generation using CLIP
 * - MinIO/S3 storage
 * - Caption generation using vision-language models
 */

import { prisma } from '@/lib/db';
import { generateImageEmbedding } from '@/lib/ai/embeddings/image';
import { createHash } from 'crypto';

// Storage configuration
const STORAGE_BUCKET = process.env.S3_BUCKET_NAME || 'rag-images';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseFn = (pdfParse as any).default;
    const pdfData = await parseFn(pdfBuffer, { max: 0 });
    const pageCount = pdfData.numpages;
    
    // Configure pdf2pic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const convert = (pdf2picModule as any).fromBuffer(pdfBuffer, {
      density: 150, // DPI
      format: 'png',
      width: 1200,
      height: 1600,
      preserveAspectRatio: true,
    });
    
    // Extract images from each page
    for (let pageNum = 1; pageNum <= Math.min(pageCount, 50); pageNum++) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await convert(pageNum, { responseType: 'buffer' }) as any;
        
        if (result && result.buffer) {
          images.push({
            buffer: Buffer.isBuffer(result.buffer) ? result.buffer : Buffer.from(result.buffer as Uint8Array),
            filename: `page_${pageNum}.png`,
            mimeType: 'image/png',
            pageNumber: pageNum,
            width: result.size?.width,
            height: result.size?.height,
          });
        }
      } catch (error) {
        console.warn(`[ImagePipeline] Failed to extract image from page ${pageNum}:`, error);
      }
    }
    
    return images;
  } catch (error) {
    console.error('[ImagePipeline] PDF image extraction failed:', error);
    // Return empty array if extraction fails
    return [];
  }
}

/**
 * Upload image to MinIO/S3 storage
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
    // Check if S3/MinIO is configured
    if (!process.env.S3_ENDPOINT && !process.env.AWS_ACCESS_KEY_ID) {
      // Fallback: Store locally or return data URL for development
      const base64 = buffer.toString('base64');
      return {
        storageKey: `local/${documentId}/${filename}`,
        storageUrl: `data:image/png;base64,${base64}`,
      };
    }
    
    // Dynamic import AWS SDK
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    
    const s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
      forcePathStyle: true, // Required for MinIO
    });
    
    const storageKey = `documents/${documentId}/${Date.now()}_${filename}`;
    
    // Upload to S3/MinIO
    await s3Client.send(
      new PutObjectCommand({
        Bucket: STORAGE_BUCKET,
        Key: storageKey,
        Body: buffer,
        ContentType: 'image/png',
        Metadata: {
          documentId,
          originalName: filename,
        },
      })
    );
    
    // Generate presigned URL for access
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const storageUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: STORAGE_BUCKET,
        Key: storageKey,
      }),
      { expiresIn: 86400 * 7 } // 7 days
    );
    
    return { storageKey, storageUrl };
  } catch (error) {
    console.error('[ImagePipeline] Storage upload failed:', error);
    // Fallback to data URL
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
    const { google } = await import('@ai-sdk/google');
    const { generateText } = await import('ai');
    
    // Convert buffer to base64 if needed
    let imageData: string;
    if (typeof imageBuffer === 'string') {
      imageData = imageBuffer;
    } else {
      const base64 = imageBuffer.toString('base64');
      imageData = `data:image/png;base64,${base64}`;
    }
    
    const result = await generateText({
      model: google('gemini-1.5-flash'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image in detail. What is shown? What are the key elements?' },
            { type: 'image', image: imageData },
          ],
        },
      ],
    });
    
    return result.text;
  } catch (error) {
    console.error('[ImagePipeline] Caption generation failed:', error);
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
      
      // Create ImageEmbedding record
      const contentHash = createHash('sha256').update(image.buffer).digest('hex');
      const imageEmbedding = await tx.$executeRaw`
        INSERT INTO image_embeddings (
          id, image_id, content_hash, embedding, model, dimensions, created_at
        ) VALUES (
          ${crypto.randomUUID()},
          ${docImage.id},
          ${contentHash},
          ${embedding}::vector,
          'Xenova/clip-vit-base-patch32',
          512,
          NOW()
        )
        RETURNING id
      `;
      
      return { docImage, imageEmbedding, contentHash };
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
    } catch {
      // Caption generation timed out or failed, that's ok
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
    console.error('[ImagePipeline] Image processing failed:', error);
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
    const batchResults = await Promise.all(
      batch.map((image) => processImage(image, documentId))
    );
    
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
    
    console.log(`[ImagePipeline] Extracted ${images.length} images from PDF`);
    
    // Process extracted images
    return processDocumentImages(images, documentId);
  } catch (error) {
    console.error('[ImagePipeline] PDF image processing failed:', error);
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
    const results = await prisma.$queryRaw<Array<{
      id: string;
      document_id: string;
      storage_url: string;
      caption: string | null;
      ocr_text: string | null;
      page_number: number | null;
      similarity: number;
    }>>`
      SELECT 
        di.id,
        di.document_id,
        di.storage_url,
        di.caption,
        di.ocr_text,
        di.page_number,
        1 - (ie.embedding <=> ${queryEmbedding}::vector) as similarity
      FROM image_embeddings ie
      JOIN document_images di ON ie.image_id = di.id
      JOIN documents d ON di.document_id = d.id
      WHERE d.user_id = ${workspaceId}
        AND d.status = 'COMPLETED'
        AND ie.embedding IS NOT NULL
      ORDER BY ie.embedding <=> ${queryEmbedding}::vector
      LIMIT ${topK}
    `;
    
    return results.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      storageUrl: r.storage_url,
      caption: r.caption || undefined,
      ocrText: r.ocr_text || undefined,
      pageNumber: r.page_number || undefined,
      similarity: Number(r.similarity),
    }));
  } catch (error) {
    console.error('[ImagePipeline] Image search failed:', error);
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
    
    // Search for similar images
    const results = await prisma.$queryRaw<Array<{
      id: string;
      document_id: string;
      storage_url: string;
      caption: string | null;
      ocr_text: string | null;
      page_number: number | null;
      similarity: number;
    }>>`
      SELECT 
        di.id,
        di.document_id,
        di.storage_url,
        di.caption,
        di.ocr_text,
        di.page_number,
        1 - (ie.embedding <=> ${textEmbedding}::vector) as similarity
      FROM image_embeddings ie
      JOIN document_images di ON ie.image_id = di.id
      JOIN documents d ON di.document_id = d.id
      WHERE d.user_id = ${workspaceId}
        AND d.status = 'COMPLETED'
        AND ie.embedding IS NOT NULL
      ORDER BY ie.embedding <=> ${textEmbedding}::vector
      LIMIT ${topK}
    `;
    
    return results.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      storageUrl: r.storage_url,
      caption: r.caption || undefined,
      ocrText: r.ocr_text || undefined,
      pageNumber: r.page_number || undefined,
      similarity: Number(r.similarity),
    }));
  } catch (error) {
    console.error('[ImagePipeline] Text-based image search failed:', error);
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
  // Get all images for the document
  const images = await prisma.documentImage.findMany({
    where: { documentId },
    select: { id: true, storageKey: true },
  });
  
  // Delete from S3/MinIO if configured
  if (process.env.S3_ENDPOINT || process.env.AWS_ACCESS_KEY_ID) {
    try {
      const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      
      const s3Client = new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
        forcePathStyle: true,
      });
      
      await Promise.all(
        images.map((img) =>
          s3Client.send(
            new DeleteObjectCommand({
              Bucket: STORAGE_BUCKET,
              Key: img.storageKey,
            })
          )
        )
      );
    } catch (error) {
      console.error('[ImagePipeline] Failed to delete images from storage:', error);
    }
  }
  
  // Delete from database (cascades to embeddings)
  await prisma.documentImage.deleteMany({
    where: { documentId },
  });
}
