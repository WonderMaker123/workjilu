import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@element-plus/icons-vue')) {
              return 'vendor-element-icons';
            }
            if (id.includes('element-plus')) {
              return 'vendor-element';
            }
            if (id.includes('vue') || id.includes('pinia')) {
              return 'vendor-vue';
            }
            if (id.includes('marked')) {
              return 'vendor-marked';
            }
            if (id.includes('docx')) {
              return 'docx';
            }
          }
        },
      },
    },
  },
});
