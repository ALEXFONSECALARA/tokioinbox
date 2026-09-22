```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    // O aviso será exibido somente para chunks acima de 1 MB.
    chunkSizeWarningLimit: 1000,

    // Otimização do build para produção.
    target: 'es2020',

    // Gera mapas de código somente se necessário.
    sourcemap: false,

    // Minificação para reduzir o tamanho dos arquivos.
    minify: 'esbuild',

    // Divide dependências grandes em chunks separados.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }

          if (
            id.includes('react') ||
            id.includes('react-dom') ||
            id.includes('react-router')
          ) {
            return 'vendor-react';
          }

          if (
            id.includes('@supabase') ||
            id.includes('supabase')
          ) {
            return 'vendor-supabase';
          }

          return 'vendor';
        },
      },
    },
  },
});
```
