import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// ============================================================
// VITE CONFIG
// - Path aliases for clean imports
// - Manual chunk splitting for optimal caching
// - Sourcemaps disabled in production (enabled via VITE_SOURCEMAP env)
// ============================================================

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  resolve: {
    alias: {
      '@':           resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@pages':      resolve(__dirname, './src/pages'),
      '@hooks':      resolve(__dirname, './src/hooks'),
      '@services':   resolve(__dirname, './src/services'),
      '@utils':      resolve(__dirname, './src/utils'),
      '@styles':     resolve(__dirname, './src/styles'),
      '@context':    resolve(__dirname, './src/context'),
    },
  },

  build: {
    target: 'es2020',

    // Sourcemaps only when explicitly requested
    // Set VITE_SOURCEMAP=true locally if you need them
    sourcemap: process.env.VITE_SOURCEMAP === 'true',

    chunkSizeWarningLimit: 500,

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router-dom')
          ) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/firebase')) {
            return 'vendor-firebase';
          }
        },

        chunkFileNames:  'assets/[name]-[hash].js',
        entryFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash].[ext]',
      },
    },
  },

  server: {
    port: 5173,
    strictPort: true,
    open: false,
  },

  preview: {
    port: 4173,
    strictPort: true,
  },
}));
