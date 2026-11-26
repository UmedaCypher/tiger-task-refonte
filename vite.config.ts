import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const root = resolve(__dirname, 'web');

/** Toutes les pages HTML du dossier web/ deviennent des entrées (site, app, admin, blog…) */
function pages(dir: string, out: Record<string, string> = {}) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) pages(p, out);
    else if (name.endsWith('.html')) out[relative(root, p).replace(/\.html$/, '').replace(/[\\/]/g, '_') || 'index'] = p;
  }
  return out;
}

export default defineConfig({
  root,
  publicDir: resolve(__dirname, 'public'),
  server: { fs: { allow: [__dirname] } },
  build: { outDir: resolve(__dirname, 'dist'), emptyOutDir: true, rollupOptions: { input: pages(root) } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      scope: '/app/',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tiger Task',
        short_name: 'Tiger Task',
        description: 'Une ligne par jour, une couleur par tâche.',
        lang: 'fr',
        theme_color: '#f3f2f7',
        background_color: '#f3f2f7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/app/',
        scope: '/app/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/app/index.html',
        navigateFallbackAllowlist: [/^\/app\//],
        globPatterns: ['app/**/*.html', 'assets/**/*.{js,css}', '*.{svg,png,webmanifest}'],
      },
    }),
  ],
});
