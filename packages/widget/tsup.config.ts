import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.tsx'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom'],
  },
  {
    entry: ['src/embed.tsx'],
    format: ['esm', 'cjs'],
    sourcemap: true,
    external: ['react', 'react-dom'],
    outDir: 'dist',
  },
]);
