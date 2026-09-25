import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile } from 'node:fs/promises'

export default defineConfig({
  plugins: [react(), {
    name: 'local-guest-preview',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__rank-history-preview', async (request, response) => {
        if (request.method !== 'GET') { response.statusCode = 405; response.end(); return }
        try {
          const snapshot = await readFile(new URL('./rank-history-preview.local', import.meta.url), 'utf8')
          response.setHeader('Content-Type', 'application/json')
          response.setHeader('Cache-Control', 'no-store')
          response.end(snapshot)
        } catch { response.statusCode = 503; response.end('Rank history preview unavailable') }
      })
      server.middlewares.use('/__guest-preview', async (request, response) => {
        if (request.method !== 'GET') { response.statusCode = 405; response.end(); return }
        try {
          const snapshot = await readFile(new URL('./guest-preview.local', import.meta.url), 'utf8')
          response.setHeader('Content-Type', 'application/json')
          response.setHeader('Cache-Control', 'no-store')
          response.end(snapshot)
        } catch {
          response.statusCode = 503
          response.end('Guest preview snapshot unavailable')
        }
      })
    }
  }],
})
