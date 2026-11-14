import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Person 5's files import '../../../contracts/api/types' from web/src/features/*/
      // That relative path resolves to web/contracts/api/types at runtime.
      // We redirect it to the real file at the repo root.
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
