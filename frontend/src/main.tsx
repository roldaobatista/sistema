import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { toast } from 'sonner'
import './index.css'
import App from './App'

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
