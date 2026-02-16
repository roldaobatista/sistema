import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

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

// No build de produção, injeta start_url absoluto no manifest para o ícone abrir em modo app (não no navegador)
function manifestAbsoluteStartUrl(): Plugin {
  return {
    name: 'manifest-absolute-start-url',
    closeBundle() {
      const outDir = path.resolve(process.cwd(), 'dist')
      const manifestPath = path.join(outDir, 'manifest.json')
      const baseUrl = process.env.VITE_APP_URL
      if (!baseUrl || !fs.existsSync(manifestPath)) return
      try {
        const origin = baseUrl.replace(/\/$/, '')
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
        manifest.start_url = `${origin}/`
        if (!manifest.scope || manifest.scope === '/') {
          manifest.scope = `${origin}/`
        }
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
      } catch {
        // ignore
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    ...(mode === 'development' ? [devSwKill()] : []),
    react(),
    tailwindcss(),
    ...(mode === 'production' ? [manifestAbsoluteStartUrl()] : []),
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
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-charts': ['recharts'],
          'vendor-maps': ['leaflet', 'react-leaflet'],
          'vendor-utils': ['axios', 'date-fns', 'zustand', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
}))
