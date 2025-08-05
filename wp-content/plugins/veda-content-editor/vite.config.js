import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': '"production"'
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        'admin-editor': path.resolve(__dirname, 'src/admin-editor.jsx'),
        'story-renderer': path.resolve(__dirname, 'src/story-renderer.jsx'),
      },
      output: {
        // We only need to ensure the filenames are predictable.
        entryFileNames: `[name].build.js`,
      }
    }
  },
});