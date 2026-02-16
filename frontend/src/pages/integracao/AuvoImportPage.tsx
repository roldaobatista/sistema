import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import {
    useAuvoConnectionStatus,
    useAuvoSyncStatus,
    useAuvoHistory,
    useAuvoImportEntity,
    useAuvoImportAll,
    useAuvoRollback,
    useAuvoConfig,
    useAuvoGetConfig,
} from '@/hooks/useAuvoImport'
import {
    CheckCircle2,
    XCircle,
    Loader2,
    Download,
    RotateCcw,
    Play,
    Database,
    Clock,
    AlertTriangle,
    RefreshCw,
    Settings,
    Eye,
    EyeOff,
    Save,
    KeyRound,
    History,
    Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendente',
    processing: 'Processando',
    done: 'Concluído',
    failed: 'Falhou',
    rolled_back: 'Desfeita',
}

const ENTITY_LABELS: Record<string, string> = {
    customers: 'Clientes',
    segments: 'Segmentos',
    customer_groups: 'Grupos',
    equipments: 'Equipamentos',
    products: 'Produtos',
    services: 'Serviços',
    tasks: 'Ordens de Serviço',
    task_types: 'Tipos de Tarefa',
    quotations: 'Orçamentos',
    tickets: 'Chamados',
    expenses: 'Despesas',
    users: 'Usuários',
    teams: 'Equipes',
    keywords: 'Palavras-chave',
}

const ENTITIES_ORDER = [
    'customers',
    'segments',
    'customer_groups',
    'equipments',
    'products',
    'services',
    'tasks',
]

export function AuvoImportPage() {
    const queryClient = useQueryClient()
    const { data: connection, isLoading: loadingConn, isError: isErrorConn, refetch: retestConnection } = useAuvoConnectionStatus()
    const { data: syncStatus, isLoading: loadingSync } = useAuvoSyncStatus()
    const { data: history } = useAuvoHistory()
    const { data: savedConfig } = useAuvoGetConfig()
    const importEntity = useAuvoImportEntity()
    const importAll = useAuvoImportAll()
    const rollback = useAuvoRollback()
    const saveConfig = useAuvoConfig()

    const [strategy, setStrategy] = useState<'skip' | 'update'>('skip')
    const [importingEntity, setImportingEntity] = useState<string | null>(null)
    const [showConfirmAll, setShowConfirmAll] = useState(false)
    const [showConfig, setShowConfig] = useState(false)
    const [apiKey, setApiKey] = useState('')
    const [apiToken, setApiToken] = useState('')
    const [showKey, setShowKey] = useState(false)
    const [showToken, setShowToken] = useState(false)

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/auvo/history/${id}`),
        onSuccess: () => {
            toast.success('Registro removido do histórico.')
            queryClient.invalidateQueries({ queryKey: ['auvo'] })
        },
        onError: (err: unknown) => {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
            toast.error(msg || 'Não foi possível remover o registro.')
        },
    })

    useEffect(() => {
        if (savedConfig?.has_credentials) {
            setApiKey(savedConfig.api_key)
            setApiToken(savedConfig.api_token)
        }
    }, [savedConfig])

    useEffect(() => {
        if (isErrorConn) {
            toast.error('Não foi possível conectar ao Auvo. Verifique as credenciais e tente novamente.')
        }
    }, [isErrorConn])

    const handleSaveConfig = () => {
        if (!apiKey.trim() || !apiToken.trim()) return
        saveConfig.mutate(
            { api_key: apiKey, api_token: apiToken },
            {
                onSuccess: (_, __, ctx) => {
                    setShowConfig(false)
                },
            }
        )
    }

    const handleImportEntity = (entity: string) => {
        setImportingEntity(entity)
        importEntity.mutate(
            { entity, strategy },
            {
                onSettled: () => setImportingEntity(null),
                onError: (err: unknown) => {
                    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                    toast.error(msg || `Falha ao importar ${ENTITY_LABELS[entity] || entity}.`)
                },
            }
        )
    }

    const handleImportAll = () => {
        setShowConfirmAll(false)
        importAll.mutate(strategy, {
            onError: (err: unknown) => {
                const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                toast.error(msg || 'Falha na importação em lote.')
            },
        })
    }

    const handleRollback = (id: number) => {
        if (
            window.confirm(
                'Tem certeza que deseja desfazer esta importação? Todos os registros importados nesta execução serão removidos do Kalibrium.'
            )
        ) {
            rollback.mutate(id)
        }
    }

    const handleDeleteHistory = (id: number) => {
        if (window.confirm('Remover este registro do histórico? A ação não altera dados já importados.')) {
            deleteMutation.mutate(id)
        }
    }

    const entityKeys = ENTITIES_ORDER.filter(k => ENTITY_LABELS[k]).length
        ? ENTITIES_ORDER
        : Object.keys(ENTITY_LABELS)

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Integração Auvo</h1>
                <p className="mt-1 text-sm text-surface-500 max-w-2xl">
                    Sincronize clientes, equipamentos, produtos e demais dados do Auvo com o Kalibrium.
                    Configure as credenciais da API abaixo e execute as importações por entidade ou em lote.
                </p>
            </div>

            {/* Connection */}
            <section className="rounded-xl border border-default bg-surface-0 shadow-sm overflow-hidden">
                <div
                    className={cn(
                        'px-5 py-4 flex flex-wrap items-center justify-between gap-4',
                        connection?.connected ? 'bg-emerald-50/80 border-b border-emerald-100' : 'bg-red-50/80 border-b border-red-100'
                    )}
                >
                    <div className="flex items-center gap-3">
                        {loadingConn ? (
                            <Loader2 className="h-5 w-5 animate-spin text-surface-400 shrink-0" />
                        ) : connection?.connected ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                        ) : (
                            <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                        )}
                        <div>
                            <p className="text-sm font-semibold text-surface-900">
                                {loadingConn ? 'Verificando conexão…' : connection?.connected ? 'Conectado ao Auvo' : 'Sem conexão'}
                            </p>
                            <p className="text-xs text-surface-600 mt-0.5">
                                {connection?.message || (connection?.connected ? 'API respondendo normalmente.' : 'Configure as credenciais para conectar.')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowConfig(v => !v)}
                            className="inline-flex items-center gap-2 rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm font-medium text-surface-700 shadow-sm hover:bg-surface-50 transition-colors"
                        >
                            <KeyRound className="h-4 w-4" />
                            {showConfig ? 'Ocultar credenciais' : 'Configurar credenciais'}
                        </button>
                        <button
                            type="button"
                            onClick={() => retestConnection()}
                            disabled={loadingConn}
                            className="inline-flex items-center gap-2 rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm font-medium text-surface-700 shadow-sm hover:bg-surface-50 disabled:opacity-50 transition-colors"
                        >
                            <RefreshCw className={cn('h-4 w-4', loadingConn && 'animate-spin')} />
                            Testar conexão
                        </button>
                    </div>
                </div>

                {/* Credentials form */}
                {showConfig && (
                    <div className="p-5 border-t border-subtle bg-surface-50/50">
                        <h2 className="text-sm font-semibold text-surface-900 mb-1">Credenciais da API Auvo</h2>
                        <p className="text-xs text-surface-500 mb-4">
                            Informe a API Key e o API Token do painel Auvo. As credenciais são armazenadas de forma segura por tenant.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                            <div>
                                <label htmlFor="auvo-api-key" className="block text-xs font-medium text-surface-700 mb-1.5">
                                    API Key <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        id="auvo-api-key"
                                        type={showKey ? 'text' : 'password'}
                                        value={apiKey}
                                        onChange={e => setApiKey(e.target.value)}
                                        placeholder="Sua API Key"
                                        className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 pr-10 text-sm text-surface-800 placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowKey(v => !v)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                                        aria-label={showKey ? 'Ocultar' : 'Mostrar'}
                                    >
                                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="auvo-api-token" className="block text-xs font-medium text-surface-700 mb-1.5">
                                    API Token <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        id="auvo-api-token"
                                        type={showToken ? 'text' : 'password'}
                                        value={apiToken}
                                        onChange={e => setApiToken(e.target.value)}
                                        placeholder="Seu API Token"
                                        className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 pr-10 text-sm text-surface-800 placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowToken(v => !v)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                                        aria-label={showToken ? 'Ocultar' : 'Mostrar'}
                                    >
                                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleSaveConfig}
                                disabled={!apiKey.trim() || !apiToken.trim() || saveConfig.isPending}
                                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {saveConfig.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                Salvar e testar conexão
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {/* Strategy + Import all */}
            <section className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-surface-700">Estratégia de importação:</span>
                    <select
                        value={strategy}
                        onChange={e => setStrategy(e.target.value as 'skip' | 'update')}
                        aria-label="Estratégia de importação"
                        className="rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm text-surface-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                        <option value="skip">Ignorar registros já existentes</option>
                        <option value="update">Atualizar registros existentes</option>
                    </select>
                </div>
                <button
                    type="button"
                    onClick={() => setShowConfirmAll(true)}
                    disabled={!connection?.connected || importAll.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {importAll.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="h-4 w-4" />
                    )}
                    Importar todas as entidades
                </button>
            </section>

            {/* Entity cards */}
            <section>
                <h2 className="text-sm font-semibold text-surface-900 mb-3">Importação por entidade</h2>
                {!connection?.connected && !loadingConn ? (
                    <div className="rounded-xl border border-default bg-surface-50/50 p-8 text-center">
                        <Database className="mx-auto h-10 w-10 text-surface-300" />
                        <p className="mt-2 text-sm text-surface-600">Conecte ao Auvo para ver e importar as entidades.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {entityKeys.map(key => {
                            const entitySync = syncStatus?.entities?.[key]
                            const isImporting = importingEntity === key
                            const available = connection?.available_entities?.[key]
                            const label = ENTITY_LABELS[key]

                            return (
                                <div
                                    key={key}
                                    className="rounded-xl border border-default bg-surface-0 p-4 shadow-sm hover:shadow transition-shadow"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Database className="h-4 w-4 text-brand-500 shrink-0" />
                                            <h3 className="text-sm font-semibold text-surface-900">{label}</h3>
                                        </div>
                                        {available !== undefined && available >= 0 && (
                                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                                {available} no Auvo
                                            </span>
                                        )}
                                        {available === -1 && (
                                            <span
                                                className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700"
                                                title="Quantidade indisponível na API"
                                            >
                                                —
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-1.5 text-xs text-surface-500 mb-4">
                                        <div className="flex justify-between">
                                            <span>Importados</span>
                                            <span className="font-medium text-surface-700 tabular-nums">
                                                {loadingSync ? '—' : (entitySync?.total_imported ?? 0)}
                                            </span>
                                        </div>
                                        {(entitySync?.total_errors ?? 0) > 0 && (
                                            <div className="flex justify-between text-amber-600">
                                                <span className="flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    Erros
                                                </span>
                                                <span className="font-medium tabular-nums">{entitySync?.total_errors}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                Última sincronização
                                            </span>
                                            <span className="font-medium text-surface-600">
                                                {entitySync?.last_import_at
                                                    ? new Date(entitySync.last_import_at).toLocaleDateString('pt-BR', {
                                                          day: '2-digit',
                                                          month: '2-digit',
                                                          hour: '2-digit',
                                                          minute: '2-digit',
                                                      })
                                                    : 'Nunca'}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleImportEntity(key)}
                                        disabled={!connection?.connected || isImporting}
                                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {isImporting ? (
                                            <>
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                Importando…
                                            </>
                                        ) : (
                                            <>
                                                <Play className="h-3.5 w-3.5" />
                                                Importar
                                            </>
                                        )}
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            {/* History */}
            <section className="rounded-xl border border-default bg-surface-0 shadow-sm overflow-hidden">
                <div className="border-b border-subtle px-5 py-3 flex items-center gap-2">
                    <History className="h-4 w-4 text-surface-500" />
                    <h2 className="text-sm font-semibold text-surface-900">Histórico de importações</h2>
                </div>
                {(history?.data?.length ?? 0) === 0 ? (
                    <div className="p-8 text-center">
                        <History className="mx-auto h-10 w-10 text-surface-300" />
                        <p className="mt-2 text-sm text-surface-500">Nenhuma importação registrada ainda.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-subtle bg-surface-50/50">
                                    <th className="px-4 py-3 text-left font-medium text-surface-500">Entidade</th>
                                    <th className="px-4 py-3 text-left font-medium text-surface-500">Status</th>
                                    <th className="px-4 py-3 text-right font-medium text-surface-500">Buscados</th>
                                    <th className="px-4 py-3 text-right font-medium text-surface-500">Importados</th>
                                    <th className="px-4 py-3 text-right font-medium text-surface-500">Atualizados</th>
                                    <th className="px-4 py-3 text-right font-medium text-surface-500">Erros</th>
                                    <th className="px-4 py-3 text-left font-medium text-surface-500">Data</th>
                                    <th className="px-4 py-3 text-left font-medium text-surface-500">Usuário</th>
                                    <th className="px-4 py-3 text-right font-medium text-surface-500">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {history?.data.map(item => (
                                    <tr key={item.id} className="hover:bg-surface-50/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-surface-800">
                                            {ENTITY_LABELS[item.entity_type] ?? item.entity_type}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={cn(
                                                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                                                    item.status === 'done' && 'bg-emerald-50 text-emerald-700',
                                                    item.status === 'failed' && 'bg-red-50 text-red-700',
                                                    item.status === 'processing' && 'bg-blue-50 text-blue-700',
                                                    item.status === 'pending' && 'bg-surface-100 text-surface-600',
                                                    item.status === 'rolled_back' && 'bg-amber-50 text-amber-700'
                                                )}
                                            >
                                                {item.status === 'done' && <CheckCircle2 className="h-3.5 w-3.5" />}
                                                {item.status === 'failed' && <XCircle className="h-3.5 w-3.5" />}
                                                {item.status === 'processing' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                                {item.status === 'rolled_back' && <RotateCcw className="h-3.5 w-3.5" />}
                                                {STATUS_LABELS[item.status] ?? item.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums text-surface-600">{item.total_fetched}</td>
                                        <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-700">{item.total_imported}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-blue-600">{item.total_updated}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-red-600">{item.total_errors}</td>
                                        <td className="px-4 py-3 text-surface-600">
                                            {item.started_at
                                                ? new Date(item.started_at).toLocaleDateString('pt-BR', {
                                                      day: '2-digit',
                                                      month: '2-digit',
                                                      year: '2-digit',
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                  })
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-surface-600">{item.user_name ?? '—'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {item.status === 'done' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRollback(item.id)}
                                                        disabled={rollback.isPending}
                                                        className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                        Desfazer
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteHistory(item.id)}
                                                    disabled={deleteMutation.isPending}
                                                    className="inline-flex items-center gap-1 rounded-md border border-default bg-surface-0 px-2 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-100 disabled:opacity-50 transition-colors"
                                                    aria-label="Remover do histórico"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Modal Importar tudo */}
            {showConfirmAll && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="confirm-all-title">
                    <div className="rounded-2xl border border-default bg-surface-0 shadow-xl max-w-md w-full p-6">
                        <h3 id="confirm-all-title" className="text-lg font-bold text-surface-900">
                            Importar todas as entidades
                        </h3>
                        <p className="mt-2 text-sm text-surface-600">
                            Serão importadas todas as entidades suportadas na ordem de dependência (ex.: clientes antes de equipamentos).
                            O processo pode levar alguns minutos.
                        </p>
                        <p className="mt-2 text-xs text-surface-500">
                            Estratégia: <strong>{strategy === 'skip' ? 'Ignorar existentes' : 'Atualizar existentes'}</strong>
                        </p>
                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowConfirmAll(false)}
                                className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleImportAll}
                                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AuvoImportPage
