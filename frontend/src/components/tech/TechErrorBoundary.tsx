import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
    children: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export class TechErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[TechPWA Error]', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full px-6 py-12 bg-surface-50 dark:bg-surface-950">
                    <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-lg font-bold text-surface-900 dark:text-surface-50 mb-1">
                        Algo deu errado
                    </h2>
                    <p className="text-sm text-surface-500 text-center mb-6 max-w-xs">
                        Ocorreu um erro inesperado. Tente recarregar a página.
                    </p>
                    {this.state.error?.message && (
                        <p className="text-xs text-surface-400 bg-surface-100 dark:bg-surface-800 rounded-lg px-3 py-2 mb-6 max-w-xs text-center font-mono">
                            {this.state.error.message.slice(0, 100)}
                        </p>
                    )}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            aria-label="Recarregar a página"
                            onClick={() => {
                                this.setState({ hasError: false, error: null })
                                window.location.reload()
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium active:bg-brand-700 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Recarregar
                        </button>
                        <button
                            type="button"
                            aria-label="Voltar ao início do PWA"
                            onClick={() => {
                                this.setState({ hasError: false, error: null })
                                window.location.href = '/tech'
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-300 text-sm font-medium active:bg-surface-300 transition-colors"
                        >
                            <Home className="w-4 h-4" />
                            Início
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
