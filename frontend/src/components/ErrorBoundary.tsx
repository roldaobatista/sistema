import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Report errors to an external monitoring service.
 * Configure VITE_ERROR_REPORTING_URL in .env to enable.
 */
function reportError(error: Error, errorInfo: ErrorInfo) {
  // Always log to console
  console.error('[ErrorBoundary]', error, errorInfo)

  // Send to external monitoring service if configured
  const reportingUrl = import.meta.env.VITE_ERROR_REPORTING_URL
  if (reportingUrl) {
    try {
      const payload = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        app: 'kalibrium-frontend',
      }

      // Use sendBeacon for reliability (fires even during page unload)
      if (navigator.sendBeacon) {
        navigator.sendBeacon(reportingUrl, JSON.stringify(payload))
      } else {
        fetch(reportingUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {
          // Silently fail - don't cause more errors from error reporting
        })
      }
    } catch {
      // Silently fail
    }
  }
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportError(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50/80 p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-red-800">Algo deu errado</h2>
            <p className="mt-2 text-sm text-red-700">
              Ocorreu um erro inesperado. Tente recarregar a pagina.
            </p>
            {this.state.error && !import.meta.env.PROD && (
              <p className="mt-3 rounded-lg bg-red-100 p-2 text-xs font-mono text-red-600 break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="mt-6 flex gap-3 justify-center">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Tentar novamente
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Recarregar pagina
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
