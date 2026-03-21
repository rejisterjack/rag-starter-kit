/**
 * Type declarations for pdf2pic
 * This is an optional dependency for PDF to image conversion
 */

declare module 'pdf2pic' {
  export interface Pdf2PicOptions {
    /** DPI resolution (default: 100) */
    density?: number;
    /** Output format (default: 'png') */
    format?: 'png' | 'jpg' | 'jpeg' | 'tif' | 'tiff' | 'bmp';
    /** Output width in pixels */
    width?: number;
    /** Output height in pixels */
    height?: number;
    /** Preserve aspect ratio (default: true) */
    preserveAspectRatio?: boolean;
    /** Quality for JPEG (0-100) */
    quality?: number;
    /** Save to file instead of returning buffer */
    savePath?: string;
    /** Filename prefix when saving */
    saveFilename?: string;
    /** Compression method */
    compression?: 'jpeg' | 'zip' | 'lzw' | 'none';
  }

  export interface ConvertedImage {
    /** Base64 encoded image data */
    base64?: string;
    /** Path to saved file */
    path?: string;
    /** Page number */
    page?: number;
    /** Image name */
    name?: string;
  }

  export interface PdfConverter {
    /** Convert specific page */
    (page: number): Promise<ConvertedImage>;
    /** Convert multiple pages */
    bulk: (pages: number | number[]) => Promise<ConvertedImage[]>;
  }

  /**
   * Create a converter from a file path
   */
  export function fromPath(filePath: string, options?: Pdf2PicOptions): PdfConverter;

  /**
   * Create a converter from a buffer
   */
  export function fromBuffer(buffer: Buffer, options?: Pdf2PicOptions): PdfConverter;

  /**
   * Create a converter from base64
   */
  export function fromBase64(base64: string, options?: Pdf2PicOptions): PdfConverter;
}
