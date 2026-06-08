import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(() => ({
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

  server: {
    port:       5173,
    strictPort: true,
    open:       false,
    proxy: {
      '/api': {
        target:       'http://localhost:80',
        changeOrigin: true,
      },
      '/socket.io': {
        target:       'http://localhost:80',
        changeOrigin: true,
        ws:           true,
      },
    },
  },

  build: {
    target:                 'es2020',
    sourcemap:              process.env.VITE_SOURCEMAP === 'true',
    chunkSizeWarningLimit:  600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── Core React ─────────────────────────────────
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/')
          ) return 'vendor-react';

          // ── Firebase ───────────────────────────────────
          if (id.includes('node_modules/firebase/')) return 'vendor-firebase';

          // ── Socket.io ──────────────────────────────────
          if (id.includes('node_modules/socket.io-client/')) return 'vendor-socket';

          // ── TanStack Query ─────────────────────────────
          if (id.includes('node_modules/@tanstack/')) return 'vendor-query';

          // ── Sentry ─────────────────────────────────────
          if (id.includes('node_modules/@sentry/')) return 'vendor-sentry';

          // ── Pages — lazy split by section ──────────────
          // Auth pages (small, always needed)
          if (
            id.includes('/pages/Login') ||
            id.includes('/pages/Register') ||
            id.includes('/pages/Landing') ||
            id.includes('/pages/Onboarding')
          ) return 'pages-auth';

          // Game pages (bigger, only after login)
          if (
            id.includes('/pages/Crimes') ||
            id.includes('/pages/Home') ||
            id.includes('/pages/Jail') ||
            id.includes('/pages/Hospital') ||
            id.includes('/pages/Settings')
          ) return 'pages-game';

          // Stub pages (tiny, bundle together)
          if (id.includes('/pages/')) return 'pages-stub';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },

  preview: {
    port:       4173,
    strictPort: true,
  },
}));
