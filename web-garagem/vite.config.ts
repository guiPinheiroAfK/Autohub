import path from "node:path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Local: http://localhost:8000 | Docker: http://api:8000 (via VITE_API_URL)
const apiTarget = process.env.VITE_API_URL ?? "http://localhost:8000"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": apiTarget,
      "/auth": apiTarget,
    },
  },
})
