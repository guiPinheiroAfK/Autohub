import path from "node:path"
import fs from "node:fs"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Local: http://localhost:8000 | Docker: http://api:8000 (via VITE_API_URL)
const apiTarget = process.env.VITE_API_URL ?? "http://localhost:8000"

// Vite 8 intercepts .js/.json through its module pipeline before publicDir.
// This plugin bypasses the HTML fallback for PWA static files.
const servePublicPwaFiles = {
  name: "serve-public-pwa-files",
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      const publicDir = path.join(__dirname, "public")
      if (req.url === "/manifest.webmanifest") {
        res.setHeader("Content-Type", "application/manifest+json")
        res.end(fs.readFileSync(path.join(publicDir, "manifest.webmanifest"), "utf-8"))
        return
      }
      if (req.url === "/sw.js") {
        res.setHeader("Content-Type", "application/javascript")
        res.end(fs.readFileSync(path.join(publicDir, "sw.js"), "utf-8"))
        return
      }
      next()
    })
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), servePublicPwaFiles],
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
