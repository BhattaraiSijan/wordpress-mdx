// vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  const buildTarget = env.BUILD_TARGET || 'story-editor';
  const entryPoints = {
    'story-editor': path.resolve(__dirname, 'src/story-editor.jsx'),
    'story-renderer': path.resolve(__dirname, 'src/story-renderer.jsx')
  };
  
  return {
    plugins: [react()],
    publicDir: 'public',
    define: {
      global: 'globalThis',
      'process.env': {},
      'process.env.NODE_ENV': JSON.stringify(mode)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        'buffer': 'buffer',
        'process': 'process/browser',
        'stream': 'stream-browserify',
        'string_decoder': 'string_decoder',
        'events': 'events',
        // Next.js shims for compatibility
        'next/dynamic': path.resolve(__dirname, 'src/shims/next-dynamic.js'),
        'next/link': path.resolve(__dirname, 'src/shims/next-link.js'),
        'next/router': path.resolve(__dirname, 'src/shims/next-router.js'),
        'next/head': path.resolve(__dirname, 'src/shims/next-head.js'),
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          includePaths: ['node_modules/@uswds/uswds/packages']
        }
      }
    },
    optimizeDeps: {
      include: [
        '@teamimpact/veda-ui',
        'buffer',
        'process',
        'events',
        'stream-browserify',
        'string_decoder'
      ],
      exclude: ['react', 'react-dom']
    },
    build: {
      outDir: 'dist',
      commonjsOptions: {
        transformMixedEsModules: true,
        include: [/node_modules/]
      },
      rollupOptions: {
        input: entryPoints[buildTarget],
        external: [
          'react',
          'react-dom'
        ],
        output: {
          entryFileNames: `${buildTarget}.build.js`,
          format: 'umd', 
          name: 'VEDAEditor',
          inlineDynamicImports: true,
          globals: {
            'react': 'React',
            'react-dom': 'ReactDOM',
            'buffer': 'Buffer',
            'process': 'process'
          }
        }
      }
    }
  };
});