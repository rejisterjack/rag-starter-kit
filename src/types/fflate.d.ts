/**
 * Type declarations for fflate
 */

declare module 'fflate' {
  export interface UnzipOptions {
    filter?: (file: { name: string; originalSize: number }) => boolean;
  }

  export function unzipSync(data: Uint8Array, opts?: UnzipOptions): Record<string, Uint8Array>;
  
  export function strFromU8(data: Uint8Array, binary?: boolean): string;
}
