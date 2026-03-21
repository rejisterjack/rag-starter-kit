declare module 'js-tiktoken' {
  export function get_encoding(name: string): {
    encode(text: string): number[];
    decode(tokens: number[]): string;
  };
}
