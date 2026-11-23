import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Im Container leitet nginx /api an n8n weiter (ui/nginx.conf). Lokal übernimmt das der Dev-Server.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://n8n.mal-zeta.de',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/webhook/ui'),
      },
    },
  },
});
