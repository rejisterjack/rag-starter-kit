# OCR (Optical Character Recognition) Implementation

This document describes the OCR implementation for the RAG Starter Kit.

## Overview

The OCR module enables text extraction from scanned PDFs and image files (PNG, JPG, TIFF, BMP, WEBP, GIF) using Tesseract.js with image preprocessing via Sharp.

## Features

- **Multi-format support**: PNG, JPG, JPEG, TIFF, TIF, BMP, WEBP, GIF
- **Image preprocessing**: Deskew, denoise, contrast enhancement, binarization
- **Multiple languages**: Support for 20+ languages
- **Confidence scoring**: Quality assessment for extracted text
- **Bounding boxes**: Text location information for each word
- **Scanned PDF support**: Automatic OCR fallback for image-based PDFs
- **Progress tracking**: Real-time progress callbacks
- **Batch processing**: Process multiple images efficiently

## Architecture

### Core Components

1. **OCR Configuration** (`src/lib/rag/ingestion/ocr-config.ts`)
   - Centralized configuration management
   - OCR Engine Modes (OEM) and Page Segmentation Modes (PSM)
   - Preprocessing options
   - Builder pattern for easy configuration

2. **OCR Parser** (`src/lib/rag/ingestion/parsers/ocr.ts`)
   - `parseImageWithOCR()`: Main OCR function for images
   - `parsePDFWithOCRFallback()`: OCR for scanned PDFs
   - `preprocessImage()`: Image preprocessing with Sharp
   - `batchOCR()`: Batch processing multiple images

3. **Pipeline Integration** (`src/lib/rag/ingestion/pipeline.ts`)
   - Added 'IMAGE' document type
   - Automatic OCR for image uploads
   - Auto-detection of scanned PDFs
   - OCR progress tracking

4. **API Route** (`src/app/api/ingest/ocr/route.ts`)
   - POST: Process images via file upload or URL
   - GET: Get OCR capabilities and supported languages
   - Rate limiting support

## Configuration

### Environment Variables

```bash
# OCR Language (default: eng)
OCR_LANGUAGE=eng

# OCR Engine Mode (0-3, default: 1 for LSTM_ONLY)
OCR_OEM=1

# Page Segmentation Mode (0-13, default: 3 for AUTO)
OCR_PSM=3

# Confidence threshold (0-100, default: 60)
OCR_CONFIDENCE_THRESHOLD=60

# OCR timeout in milliseconds (default: 120000)
OCR_TIMEOUT_MS=120000
```

### Usage Examples

#### Basic Image OCR

```typescript
import { parseImageWithOCR } from '@/lib/rag/ingestion/parsers/ocr';

const result = await parseImageWithOCR(imageBuffer, {
  language: 'eng',
  confidenceThreshold: 60,
});

console.log(result.content); // Extracted text
console.log(result.metadata.confidence); // Confidence score
```

#### OCR with Preprocessing

```typescript
import { OCRConfigBuilder, PageSegmentationMode } from '@/lib/rag/ingestion/ocr-config';

const config = new OCRConfigBuilder()
  .withLanguage('eng+deu') // English + German
  .withPSM(PageSegmentationMode.AUTO)
  .withConfidenceThreshold(70)
  .withPreprocessing({
    enabled: true,
    deskew: true,
    denoise: true,
    contrastEnhancement: true,
  })
  .build();

const result = await parseImageWithOCR(imageBuffer, config);
```

#### Pipeline Processing

```typescript
import { IngestionPipeline } from '@/lib/rag/ingestion/pipeline';

const pipeline = new IngestionPipeline({
  ocr: {
    enableAutoOCR: true,
    language: 'eng',
    confidenceThreshold: 60,
    preprocessing: true,
  },
});

const result = await pipeline.process({
  type: 'IMAGE',
  file: imageFile,
  workspaceId: 'workspace-123',
});
```

#### API Usage

```bash
# Upload image for OCR
curl -X POST \
  -F "file=@scanned-document.png" \
  -F "language=eng" \
  "http://localhost:3000/api/ingest/ocr?confidence=60&preprocessing=true"

# OCR from URL
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/image.png"}' \
  "http://localhost:3000/api/ingest/ocr?language=eng"

# Get OCR info
curl http://localhost:3000/api/ingest/ocr
```

## Database Schema

### Document Model (OCR Fields)

```prisma
model Document {
  // ... existing fields ...
  
  ocrProcessed        Boolean   @default(false)
  ocrConfidence       Float?
  ocrLanguage         String?
  ocrProcessingTimeMs Int?
  ocrEngineMode       String?
  ocrPSM              String?
  ocrPreprocessing    Boolean   @default(false)
  ocrError            String?
  
  @@index([ocrProcessed])
  @@index([ocrConfidence])
}
```

### DocumentImage Model (OCR Fields)

```prisma
model DocumentImage {
  // ... existing fields ...
  
  ocrConfidence       Float?
  ocrLanguage         String?
  ocrProcessingTimeMs Int?
  ocrPreprocessing    Boolean @default(false)
  ocrBoundingBoxes    Json?
  
  @@index([ocrConfidence])
}
```

## Supported Languages

| Code | Language |
|------|----------|
| eng | English |
| deu | German |
| fra | French |
| spa | Spanish |
| ita | Italian |
| por | Portuguese |
| rus | Russian |
| chi_sim | Chinese (Simplified) |
| chi_tra | Chinese (Traditional) |
| jpn | Japanese |
| kor | Korean |
| ara | Arabic |
| hin | Hindi |
| tha | Thai |
| vie | Vietnamese |
| nld | Dutch |
| pol | Polish |
| tur | Turkish |

## Performance Considerations

1. **Image Size**: Large images are automatically resized (default max: 3000px)
2. **Preprocessing**: Enable preprocessing for better accuracy on poor quality scans
3. **Language**: Use specific language codes for better accuracy
4. **Batch Processing**: Use `batchOCR()` for processing multiple images
5. **Worker Pool**: Tesseract workers are reused for better performance

## Error Handling

The OCR module provides specific error codes:

- `INVALID_IMAGE`: File is not a valid image
- `PROCESSING_ERROR`: OCR engine failed to process the image
- `TIMEOUT`: OCR processing exceeded the configured timeout
- `MISSING_DEPENDENCY`: Required dependency (e.g., pdf2pic) is not installed

## Dependencies

### Required
- `tesseract.js`: OCR engine
- `sharp`: Image preprocessing

### Optional
- `pdf2pic`: For OCR of scanned PDFs (PDF to image conversion)

## Migration

To apply the database changes:

```bash
pnpm db:migrate
```

## Future Enhancements

1. Support for Google Vision API as an alternative OCR engine
2. Table structure detection and extraction
3. Handwriting recognition
4. GPU acceleration for faster processing
5. Multi-page TIFF support
