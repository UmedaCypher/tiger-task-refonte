import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tiger Task — le carnet du tigre',
        short_name: 'Tiger Task',
        description: 'Chaque jour, des tâches. Chaque tâche, une couleur. Chaque année, une tapisserie.',
        lang: 'fr',
        theme_color: '#0d0b14',
        background_color: '#0d0b14',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png}', '**/*-latin-[0-9w]*.woff2', '**/*-latin-ext-*.woff2'],
      },
    }),
  ],
});
