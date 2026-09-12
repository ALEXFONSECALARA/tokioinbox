import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => ({
  publicDir: false,
  plugins: [react(), tailwindcss(), {
    name: 'tokio-public-assets',
    generateBundle() {
      for (const name of ['sw.js', 'tokioinbox-mark.svg']) {
        const file = path.resolve(__dirname, name);
        if (fs.existsSync(file)) this.emitFile({ type: 'asset', fileName: name, source: fs.readFileSync(file, 'utf8') });
      }
    },
  }],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: { output: { manualChunks: { 'vendor-react': ['react', 'react-dom'], 'vendor-icons': ['lucide-react'] } } },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
    proxy: {
      '/api': { target: process.env.VITE_BACKEND_URL || 'http://localhost:3001', changeOrigin: true },
      '/uploads': { target: process.env.VITE_BACKEND_URL || 'http://localhost:3001', changeOrigin: true },
    },
  },
}));
