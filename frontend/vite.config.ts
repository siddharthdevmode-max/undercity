import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// ============================================================
// VITE CONFIG
// - Path aliases for clean imports
// - Manual chunk splitting for optimal caching
// - Source maps in production for error tracking
// ============================================================

export default defineConfig({
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
    // Target modern browsers
    target: 'es2020',

    // Source maps for production error tracking
    sourcemap: true,

    // Warn if any chunk exceeds 500kb
    chunkSizeWarningLimit: 500,

    rollupOptions: {
      output: {
        // Manual chunk splitting — function form required for Vite 8
        // Each vendor chunk cached independently by the browser
        // Change game code → users don't re-download React/Firebase
        manualChunks(id) {
          if (id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/firebase')) {
            return 'vendor-firebase';
          }
        },

        // Consistent naming for cache busting
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
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
});
