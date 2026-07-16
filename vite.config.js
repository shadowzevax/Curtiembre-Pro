import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    // La API local corre en server/dev-server.mjs (npm run dev la levanta junto a vite)
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
