import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: 'localhost',
    open: true // Optional: automatically open browser
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  // Ensure compatibility with existing CSS setup
  css: {
    postcss: './postcss.config.js'
  }
})