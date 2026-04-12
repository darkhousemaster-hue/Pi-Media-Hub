import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Increase proxy body size for large file uploads
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => console.log('[proxy error]', err.message));
        },
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/player.html': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // /socket.io NOT proxied — Vite v4 WS proxy crashes with socket.io
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
