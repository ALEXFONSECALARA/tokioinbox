import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      // Aviso "chunks maiores que 500kB" do Vite: o bundle inteiro (React +
      // ícones + todas as telas do admin) ia num arquivo .js só. Isso NÃO
      // afeta o funcionamento — só o tamanho do primeiro download — mas
      // separar as bibliotecas em chunks próprios deixa o cache do navegador
      // mais eficiente entre deploys (o vendor não muda a cada correção de
      // código, então o navegador não precisa rebaixá-lo toda vez).
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Em dev, encaminha chamadas /api para o backend Express local (npm run server)
      proxy: {
        '/api': {
          target: process.env.VITE_BACKEND_URL || 'http://localhost:3001',
          changeOrigin: true,
        },
        // Fotos enviadas pelo admin (logo, banner, splash, pratos) ficam no backend
        '/uploads': {
          target: process.env.VITE_BACKEND_URL || 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
