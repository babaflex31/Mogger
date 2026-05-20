import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), mkcert()],
  server: {
    port: 5173,
    host: true, // Listen on all network interfaces
    https: true,
    proxy: {
      // Proxy socket.io requests to Express backend (still http on 3001)
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
    headers: {
      // Basic security headers for dev (helmet will add more on backend)
      'X-Content-Type-Options': 'nosniff',
    },
  },
})
