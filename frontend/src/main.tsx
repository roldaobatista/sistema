import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { toast } from 'sonner'
import './index.css'
import App from './App'

// Aplica tema de forma síncrona ao carregar (evita mistura claro+escuro quando index.html está em cache)
function applyThemeSync() {
  try {
    const raw = localStorage.getItem('ui-store')
    let theme: 'light' | 'dark' | 'system' = 'light'
    if (raw) {
      try {
        const o = JSON.parse(raw) as { theme?: string }
        if (o?.theme === 'dark' || o?.theme === 'light' || o?.theme === 'system') theme = o.theme
      } catch { /* ignore */ }
    }
    const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(isDark ? 'dark' : 'light')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', isDark ? '#09090B' : '#2563EB')
  } catch { /* ignore */ }
}
applyThemeSync()

// go2rtc URL for camera streaming (injected at build time or fallback to /go2rtc)
;(window as Window & { __GO2RTC_URL?: string }).__GO2RTC_URL =
  import.meta.env.VITE_GO2RTC_URL || (window.location.origin + '/go2rtc')

// Escuta eventos de 403 (permissão negada) disparados pelo interceptor da API
window.addEventListener('api:forbidden', ((e: CustomEvent<{ message: string }>) => {
  toast.error(e.detail.message || 'Você não tem permissão para realizar esta ação.')
}) as EventListener)

// ─── Service Worker (PWA Offline) ─────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registrado:', reg.scope)

        // Escuta atualizações
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                toast.info('Nova versão disponível! Recarregue para atualizar.', {
                  action: { label: 'Atualizar', onClick: () => { newWorker.postMessage({ type: 'SKIP_WAITING' }); window.location.reload() } },
                  duration: Infinity,
                })
              }
            })
          }
        })
      })
      .catch((err) => console.warn('[PWA] Falha ao registrar SW:', err))

    // Escuta sync completo
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SYNC_COMPLETE') {
        if (event.data.remaining === 0) {
          toast.success('Dados offline sincronizados com sucesso!')
        }
      }
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
