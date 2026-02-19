import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { FileText, Image, MessageSquare, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ShareTargetPage() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    const title = searchParams.get('title') ?? ''
    const text = searchParams.get('text') ?? ''
    const url = searchParams.get('url') ?? ''

    const sharedContent = [title, text, url].filter(Boolean).join('\n')

    useEffect(() => {
        if (!title && !text && !url) {
            navigate('/', { replace: true })
        }
    }, [title, text, url, navigate])

    const actions = [
        {
            label: 'Novo Orçamento',
            description: 'Criar orçamento com este conteúdo',
            icon: FileText,
            path: `/orcamentos/novo?notes=${encodeURIComponent(sharedContent)}`,
            color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400',
        },
        {
            label: 'Nota Rápida CRM',
            description: 'Salvar como nota no CRM',
            icon: MessageSquare,
            path: `/crm/quick-notes?content=${encodeURIComponent(sharedContent)}`,
            color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400',
        },
        {
            label: 'Nova OS',
            description: 'Criar Ordem de Serviço',
            icon: Image,
            path: `/os/nova?description=${encodeURIComponent(sharedContent)}`,
            color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400',
        },
    ]

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold text-lg shadow-lg shadow-blue-500/20 mb-4">
                        K
                    </div>
                    <h1 className="text-xl font-bold text-surface-900 dark:text-white">
                        Conteúdo Compartilhado
                    </h1>
                    <p className="text-sm text-surface-400 mt-1">
                        Escolha o que fazer com o conteúdo recebido
                    </p>
                </div>

                {/* Preview do conteúdo */}
                <div className="rounded-xl border border-surface-200 dark:border-white/10 bg-surface-50 dark:bg-white/[0.02] p-4">
                    <p className="text-sm text-surface-700 dark:text-surface-200 whitespace-pre-wrap line-clamp-5">
                        {sharedContent || 'Nenhum conteúdo'}
                    </p>
                </div>

                {/* Ações */}
                <div className="space-y-2">
                    {actions.map((action) => (
                        <button
                            key={action.path}
                            onClick={() => navigate(action.path, { replace: true })}
                            className="w-full flex items-center gap-3 rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-surface-900 px-4 py-3.5 text-left hover:bg-surface-50 dark:hover:bg-white/[0.03] transition-colors group"
                        >
                            <div className={`rounded-lg p-2 ${action.color}`}>
                                <action.icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-surface-800 dark:text-white">
                                    {action.label}
                                </p>
                                <p className="text-xs text-surface-400">
                                    {action.description}
                                </p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-surface-300 group-hover:text-surface-500 dark:group-hover:text-surface-300 transition-colors" />
                        </button>
                    ))}
                </div>

                <div className="text-center">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/', { replace: true })}>
                        Cancelar
                    </Button>
                </div>
            </div>
        </div>
    )
}
