import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const apiProxy = process.env.VITE_API_PROXY ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': apiProxy,
      '/socket.io': {
        target: apiProxy,
        ws: true,
      },
    },
  },
});
