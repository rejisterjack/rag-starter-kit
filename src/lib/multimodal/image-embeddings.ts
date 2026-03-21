/**
 * Multi-Modal Image Embeddings
 *
 * Supports CLIP and OpenAI Vision models for image understanding
 */

import { logger } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

export interface ImageEmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
  processingTimeMs: number;
}

export interface ImageAnalysisResult {
  description: string;
  objects: string[];
  text: string[];
  embedding: number[];
}

// =============================================================================
// CLIP Model Implementation
// =============================================================================

let clipModel: unknown = null;

/**
 * Load CLIP model (using transformers.js)
 */
async function loadCLIPModel() {
  if (!clipModel) {
    try {
      const { pipeline } = await import('@xenova/transformers');
      // Use 'feature-extraction' pipeline type with CLIP model
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clipModel = await (pipeline as any)('feature-extraction', 'Xenova/clip-vit-base-patch32');
    } catch (error) {
      logger.error('Failed to load CLIP model', { error });
      throw new Error('CLIP model not available');
    }
  }
  return clipModel;
}

/**
 * Generate embeddings for an image using CLIP
 */
export async function generateImageEmbedding(imageBuffer: Buffer): Promise<ImageEmbeddingResult> {
  const startTime = Date.now();

  try {
    const model = await loadCLIPModel();
    const result = await (model as { call: (buffer: Buffer) => Promise<{ data: number[] }> }).call(
      imageBuffer
    );

    return {
      embedding: result.data,
      model: 'clip-vit-base-patch32',
      dimensions: 512,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    logger.error('Image embedding failed', { error });
    throw error;
  }
}

// =============================================================================
// OpenAI Vision API
// =============================================================================

/**
 * Analyze image using OpenAI Vision
 */
export async function analyzeImageWithVision(
  imageBase64: string,
  prompt: string = 'Describe this image in detail.'
): Promise<ImageAnalysisResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.statusText}`);
    }

    const data = await response.json();
    const description = data.choices[0]?.message?.content || '';

    return {
      description,
      objects: extractObjectsFromDescription(description),
      text: [], // Would use OCR for this
      embedding: [], // Would generate CLIP embedding separately
    };
  } catch (error) {
    logger.error('Vision analysis failed', { error });
    throw error;
  }
}

/**
 * Extract objects from image description
 */
function extractObjectsFromDescription(description: string): string[] {
  // Simple keyword extraction - in production use NLP
  const objectWords = ['person', 'car', 'building', 'tree', 'animal', 'food', 'document'];
  return objectWords.filter((word) => description.toLowerCase().includes(word));
}

// =============================================================================
// PDF Image Extraction
// =============================================================================

export interface PDFImage {
  pageNumber: number;
  imageBuffer: Buffer;
  position: { x: number; y: number; width: number; height: number };
}

/**
 * Extract images from PDF
 */
export async function extractPDFImages(_pdfBuffer: Buffer): Promise<PDFImage[]> {
  try {
    // Note: pdf-parse doesn't natively support image extraction
    // For production, use pdf-lib or similar
    logger.warn('PDF image extraction requires pdf-lib package');
    return [];
  } catch (error) {
    logger.error('PDF image extraction failed', { error });
    return [];
  }
}

/**
 * Process PDF with image understanding
 */
export async function processPDFWithImages(pdfBuffer: Buffer): Promise<{
  text: string;
  imageDescriptions: string[];
}> {
  const images = await extractPDFImages(pdfBuffer);
  const descriptions: string[] = [];

  for (const image of images.slice(0, 5)) {
    // Limit for cost
    try {
      const base64 = image.imageBuffer.toString('base64');
      const analysis = await analyzeImageWithVision(
        base64,
        'What is shown in this document excerpt?'
      );
      descriptions.push(`[Page ${image.pageNumber}] ${analysis.description}`);
    } catch (error) {
      logger.error('Failed to analyze PDF image', { error });
    }
  }

  return {
    text: '', // Would get from text extraction
    imageDescriptions: descriptions,
  };
}
