import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: /^(\.\.\/)*contracts\/api\/types$/,
        replacement: path.resolve(__dirname, '../contracts/api/types'),
      },
      {
        find: /^(\.\.\/)*contracts\/fixtures\/(.+)$/,
        replacement: path.resolve(__dirname, '../contracts/fixtures/$2'),
      },
    ],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
