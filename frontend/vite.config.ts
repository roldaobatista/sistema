import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Plugin que intercepta /sw.js em dev e retorna um SW que se auto-desregistra
function devSwKill(): Plugin {
  return {
    name: 'dev-sw-kill',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/sw.js') {
          res.setHeader('Content-Type', 'application/javascript')
          res.setHeader('Cache-Control', 'no-store')
          res.setHeader('Service-Worker-Allowed', '/')
          res.end(`
            // Auto-unregister SW in dev mode
            self.addEventListener('install', () => self.skipWaiting());
            self.addEventListener('activate', () => {
              self.registration.unregister();
              self.clients.matchAll().then(cs => cs.forEach(c => c.navigate(c.url)));
            });
          `)
          return
        }
        next()
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    ...(mode === 'development' ? [devSwKill()] : []),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
}))
