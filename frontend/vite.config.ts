import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        // Charts and animation are the heavy dependencies; splitting them keeps
        // the initial landing-page payload small.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          motion: ['framer-motion'],
        },
      },
    },
  },
  server: {
    port: 5173,
    // When VITE_API_BASE_URL is left empty, requests go to /api/* on this origin
    // and are proxied to the FastAPI backend below. Point this at your backend.
    proxy: {
      '/api': {
        target: process.env.BACKEND_ORIGIN || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
