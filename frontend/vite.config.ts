import { defineConfig } from 'vite';
import react            from '@vitejs/plugin-react';
import { resolve }      from 'path';

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
    target:                'es2020',
    sourcemap:             process.env.VITE_SOURCEMAP === 'true',
    chunkSizeWarningLimit: 500,
    cssCodeSplit:          true,
    assetsInlineLimit:     4096, // inline assets < 4KB

    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── Core React runtime (smallest, loads first) ──
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) return 'vendor-react';

          // ── Router (needed on every page) ──────────────
          if (id.includes('node_modules/react-router-dom/') ||
              id.includes('node_modules/@remix-run/'))
            return 'vendor-router';

          // ── Firebase — split by sub-package ────────────
          if (id.includes('node_modules/firebase/auth'))
            return 'vendor-firebase-auth';
          if (id.includes('node_modules/firebase/'))
            return 'vendor-firebase-core';

          // ── Socket.io ──────────────────────────────────
          if (id.includes('node_modules/socket.io-client/') ||
              id.includes('node_modules/engine.io-client/'))
            return 'vendor-socket';

          // ── TanStack Query ─────────────────────────────
          if (id.includes('node_modules/@tanstack/'))
            return 'vendor-query';

          // ── Sentry (large — split out) ──────────────────
          if (id.includes('node_modules/@sentry/'))
            return 'vendor-sentry';

          // ── Fingerprint ────────────────────────────────
          if (id.includes('node_modules/@fingerprintjs/'))
            return 'vendor-fingerprint';

          // ── PostHog ────────────────────────────────────
          if (id.includes('node_modules/posthog-js/'))
            return 'vendor-posthog';

          // ── Pages — public (load fast, no auth needed) ─
          if (
            id.includes('/pages/Landing') ||
            id.includes('/pages/Legal')
          ) return 'pages-public';

          // ── Pages — auth ───────────────────────────────
          if (
            id.includes('/pages/Login')    ||
            id.includes('/pages/Register') ||
            id.includes('/pages/Onboarding')
          ) return 'pages-auth';

          // ── Pages — core game (crimes, home, jail) ─────
          if (
            id.includes('/pages/Home')     ||
            id.includes('/pages/Crimes')   ||
            id.includes('/pages/Jail')     ||
            id.includes('/pages/Hospital') ||
            id.includes('/pages/FederalJail') ||
            id.includes('/pages/Settings')
          ) return 'pages-game-core';

          // ── Pages — stubs (tiny, bundle together) ──────
          if (id.includes('/pages/')) return 'pages-stub';

        },

        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Group images together
          if (/\.(png|jpe?g|svg|gif|webp|avif|ico)$/i.test(assetInfo.name ?? '')) {
            return 'assets/img/[name]-[hash].[ext]';
          }
          // Group fonts together
          if (/\.(woff2?|ttf|eot)$/i.test(assetInfo.name ?? '')) {
            return 'assets/fonts/[name]-[hash].[ext]';
          }
          return 'assets/[name]-[hash].[ext]';
        },
      },
    },
  },

  preview: {
    port:       4173,
    strictPort: true,
  },
}));
