/**
 * Type declarations for dynamically-imported optional/untyped modules.
 *
 * These modules are loaded via dynamic `import()` at runtime, so they
 * either lack type declarations or their default exports don't match
 * the CommonJS/ESM interop shape that bundlers produce.
 */

// =============================================================================
// Document Parsing
// =============================================================================

declare module 'pdf-parse' {
  export default function parse(
    buffer: Buffer,
    options?: { max?: number }
  ): Promise<{
    text: string;
    numpages: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    version: string;
  }>;
}

declare module 'mammoth' {
  export function convertToHtml(
    buffer: Buffer,
    options?: Record<string, unknown>
  ): Promise<{ value: string; messages: unknown[] }>;

  export function extractRawText(buffer: Buffer): Promise<{ value: string }>;
}

declare module 'pdf2pic' {
  export function fromBuffer(
    buffer: Buffer,
    options: Record<string, unknown>
  ): {
    bulk: (pages: number) => Promise<Array<{ base64: string }>>;
    (
      pageNum: number,
      options: { responseType: string }
    ): Promise<{ buffer?: Buffer | Uint8Array; size?: { width?: number; height?: number } }>;
  };
}

// =============================================================================
// AI / ML Libraries
// =============================================================================

declare module '@xenova/transformers' {
  export function pipeline(
    task: string,
    model: string,
    options?: Record<string, unknown>
  ): Promise<unknown>;

  export const AutoModel: {
    from_pretrained(model: string, options?: Record<string, unknown>): Promise<unknown>;
  };

  export const AutoProcessor: {
    from_pretrained(model: string, options?: Record<string, unknown>): Promise<unknown>;
  };
}

// =============================================================================
// Browser Automation (optional dependency)
// =============================================================================

declare module 'playwright' {
  interface Browser {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }

  interface Page {
    goto(url: string, options?: { waitUntil?: string }): Promise<Response | null>;
    url(): string;
    content(): Promise<string>;
    setDefaultTimeout(timeout: number): void;
    setDefaultNavigationTimeout(timeout: number): void;
    waitForSelector(selector: string, options?: { timeout?: number }): Promise<ElementHandle>;
    evaluate<T>(fn: () => T): Promise<T>;
    close(): Promise<void>;
  }

  interface Response {
    status(): number;
    headers(): Record<string, string>;
  }

  interface ElementHandle {}

  interface BrowserType {
    launch(options: { headless: boolean }): Promise<Browser>;
  }

  export const chromium: BrowserType;
}

// =============================================================================
// OCR
// =============================================================================

declare module 'tesseract.js' {
  export type OEM = number;
  export type PSM = string;
  export function createWorker(
    language?: string,
    oem?: number,
    options?: Record<string, unknown>
  ): Promise<TesseractWorker>;

  interface TesseractWorker {
    setParameters(params: Record<string, unknown>): Promise<void>;
    recognize(image: Buffer | string): Promise<TesseractResult>;
    terminate(): Promise<void>;
  }

  interface TesseractResult {
    data: {
      text: string;
      confidence: number;
      paragraphs?: Array<{
        lines: Array<{
          words: Array<{ text: string; confidence: number; bbox: TesseractBBox }>;
        }>;
      }>;
    };
  }

  interface TesseractBBox {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }

  export const PSM: Record<string, string>;
}

// =============================================================================
// DOM Sanitization (server-side)
// =============================================================================

declare module 'dompurify' {
  export interface DOMPurifyInstance {
    sanitize(source: string): string;
  }

  function createDOMPurify(window: unknown): DOMPurifyInstance;
  export default createDOMPurify;
}

// =============================================================================
// Utility types for module interop
// =============================================================================

/**
 * Helper type for dynamic imports that may have a `default` export
 * wrapped by the bundler's CJS/ESM interop.
 */
export interface ModuleWithDefault<T> {
  default: T;
}
