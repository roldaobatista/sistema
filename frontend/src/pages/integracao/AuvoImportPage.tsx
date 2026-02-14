import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ENTITY_LABELS: Record<string, string> = {
    customers: 'Clientes',
    customer_segments: 'Segmentos',
    customer_groups: 'Grupos',
    equipments: 'Equipamentos',
    products: 'Produtos',
    services: 'ServiÃ§os',
    tasks: 'Ordens de ServiÃ§o',
    task_types: 'Tipos de Tarefa',
    quotations: 'OrÃ§amentos',
    tickets: 'Chamados',
    expenses: 'Despesas',
    users: 'UsuÃ¡rios',
    teams: 'Equipes',
    keywords: 'Palavras-chave',
}

export function AuvoImportPage() {
    const { data: connection, isLoading: loadingConn, isError: isErrorConn, refetch: retestConnection } = useAuvoConnectionStatus()
    const { data: syncStatus, isLoading: loadingSync, isError: isErrorSync } = useAuvoSyncStatus()
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

    useEffect(() => {
        if (savedConfig?.has_credentials) {
            setApiKey(savedConfig.api_key)
            setApiToken(savedConfig.api_token)
        }
    }, [savedConfig])

    useEffect(() => {
        if (isErrorConn || isErrorSync) {
            toast.error('Erro ao conectar com o Auvo. Verifique suas credenciais.')
        }
    }, [isErrorConn, isErrorSync])

    const handleSaveConfig = () => {
        if (!apiKey.trim() || !apiToken.trim()) return
        saveConfig.mutate({ api_key: apiKey, api_token: apiToken }, {
            onSuccess: () => {
                setShowConfig(false)
            },
        })
    }

    const handleImportEntity = (entity: string) => {
        setImportingEntity(entity)
        importEntity.mutate({ entity, strategy }, {
            onSettled: () => setImportingEntity(null),
            onError: () => toast.error(`Erro ao importar ${ENTITY_LABELS[entity] || entity}`),
        })
    }

    const handleImportAll = () => {
        setShowConfirmAll(false)
        importAll.mutate(strategy, {
            onError: () => toast.error('Erro na importação completa'),
        })
    }

    const handleRollback = (id: number) => {
        if (confirm('Tem certeza que deseja reverter esta importaÃ§Ã£o? Todos os registros importados serÃ£o excluÃ­dos.')) {
            rollback.mutate(id)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-surface-900">IntegraÃ§Ã£o Auvo</h1>
                    <p className="text-sm text-surface-500 mt-0.5">
                        Importe dados do Auvo para o Kalibrium
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={strategy}
                        onChange={e => setStrategy(e.target.value as 'skip' | 'update')}
                        aria-label="EstratÃ©gia de importaÃ§Ã£o"
                        className="rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm font-medium text-surface-700"
                    >
                        <option value="skip">Pular duplicados</option>
                        <option value="update">Atualizar existentes</option>
                    </select>
                    <button
                        onClick={() => setShowConfirmAll(true)}
                        disabled={!connection?.connected || importAll.isPending}
                        className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {importAll.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        Importar Tudo
                    </button>
                </div>
            </div>

            {/* Connection Status Card */}
            <div className={cn(
                'rounded-xl border p-4 shadow-sm',
                connection?.connected
                    ? 'border-green-200 bg-green-50/60'
                    : 'border-red-200 bg-red-50/60'
            )}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {loadingConn ? (
                            <Loader2 className="h-5 w-5 animate-spin text-surface-400" />
                        ) : connection?.connected ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                            <p className="text-sm font-semibold text-surface-900">
                                {connection?.connected ? 'Conectado ao Auvo' : 'Desconectado'}
                            </p>
                            <p className="text-xs text-surface-500 mt-0.5">
                                {connection?.message || 'Verificando conexÃ£o...'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowConfig(v => !v)}
                            className="flex items-center gap-1.5 rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-100 transition-colors"
                        >
                            <Settings className="h-3.5 w-3.5" />
                            Credenciais
                        </button>
                        <button
                            onClick={() => retestConnection()}
                            className="flex items-center gap-1.5 rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-100 transition-colors"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Testar
                        </button>
                    </div>
                </div>
            </div>

            {/* Credentials Form */}
            {showConfig && (
                <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-surface-900 mb-3">Credenciais da API Auvo</h2>
                    <p className="text-xs text-surface-500 mb-4">
                        Insira a API Key e o API Token da sua conta Auvo. VocÃª encontra essas credenciais no painel administrativo do Auvo.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="auvo-api-key" className="block text-xs font-medium text-surface-700 mb-1">
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
                                >
                                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="auvo-api-token" className="block text-xs font-medium text-surface-700 mb-1">
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
                                >
                                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleSaveConfig}
                            disabled={!apiKey.trim() || !apiToken.trim() || saveConfig.isPending}
                            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {saveConfig.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Salvar Credenciais
                        </button>
                    </div>
                </div>
            )}

            {/* Entity Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Object.entries(ENTITY_LABELS).map(([key, label]) => {
                    const entitySync = syncStatus?.entities?.[key]
                    const isImporting = importingEntity === key
                    const available = connection?.available_entities?.[key]

                    return (
                        <div
                            key={key}
                            className="rounded-xl border border-default bg-surface-0 p-4 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Database className="h-4 w-4 text-brand-500" />
                                    <h3 className="text-sm font-semibold text-surface-900">{label}</h3>
                                </div>
                                {available !== undefined && (
                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                        {available} no Auvo
                                    </span>
                                )}
                            </div>

                            <div className="space-y-1.5 text-xs text-surface-500 mb-3">
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                        <Download className="h-3 w-3" />
                                        Importados
                                    </span>
                                    <span className="font-semibold text-surface-700">
                                        {entitySync?.total_imported ?? 0}
                                    </span>
                                </div>
                                {(entitySync?.total_errors ?? 0) > 0 && (
                                    <div className="flex items-center justify-between text-red-600">
                                        <span className="flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            Erros
                                        </span>
                                        <span className="font-semibold">{entitySync?.total_errors}</span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Ãšltimo sync
                                    </span>
                                    <span className="font-medium text-surface-600">
                                        {entitySync?.last_import_at
                                            ? new Date(entitySync.last_import_at).toLocaleDateString('pt-BR', {
                                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                                            })
                                            : 'Nunca'}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => handleImportEntity(key)}
                                disabled={!connection?.connected || isImporting}
                                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isImporting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Play className="h-3.5 w-3.5" />
                                )}
                                {isImporting ? 'Importando...' : 'Importar'}
                            </button>
                        </div>
                    )
                })}
            </div>

            {/* Import History */}
            {(history?.data?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-default bg-surface-0 shadow-sm">
                    <div className="border-b border-subtle px-5 py-3">
                        <h2 className="text-sm font-semibold text-surface-900">HistÃ³rico de ImportaÃ§Ãµes</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-subtle bg-surface-50/50">
                                    <th className="px-4 py-2.5 text-left font-medium text-surface-500">Entidade</th>
                                    <th className="px-4 py-2.5 text-left font-medium text-surface-500">Status</th>
                                    <th className="px-4 py-2.5 text-right font-medium text-surface-500">Buscados</th>
                                    <th className="px-4 py-2.5 text-right font-medium text-surface-500">Importados</th>
                                    <th className="px-4 py-2.5 text-right font-medium text-surface-500">Atualizados</th>
                                    <th className="px-4 py-2.5 text-right font-medium text-surface-500">Erros</th>
                                    <th className="px-4 py-2.5 text-left font-medium text-surface-500">Data</th>
                                    <th className="px-4 py-2.5 text-left font-medium text-surface-500">UsuÃ¡rio</th>
                                    <th className="px-4 py-2.5 text-right font-medium text-surface-500">AÃ§Ãµes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {history?.data.map(item => (
                                    <tr key={item.id} className="hover:bg-surface-50 transition-colors">
                                        <td className="px-4 py-2.5 font-medium text-surface-800">
                                            {ENTITY_LABELS[item.entity_type] || item.entity_type}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={cn(
                                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                                                item.status === 'completed' && 'bg-green-50 text-green-700',
                                                item.status === 'failed' && 'bg-red-50 text-red-700',
                                                item.status === 'running' && 'bg-blue-50 text-blue-700',
                                                item.status === 'rolled_back' && 'bg-amber-50 text-amber-700',
                                            )}>
                                                {item.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                                                {item.status === 'failed' && <XCircle className="h-3 w-3" />}
                                                {item.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
                                                {item.status === 'rolled_back' && <RotateCcw className="h-3 w-3" />}
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">{item.total_fetched}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-green-700 font-medium">{item.total_imported}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-blue-700">{item.total_updated}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-red-600">{item.total_errors}</td>
                                        <td className="px-4 py-2.5 text-surface-600">
                                            {item.started_at
                                                ? new Date(item.started_at).toLocaleDateString('pt-BR', {
                                                    day: '2-digit', month: '2-digit', year: '2-digit',
                                                    hour: '2-digit', minute: '2-digit',
                                                })
                                                : 'â€”'}
                                        </td>
                                        <td className="px-4 py-2.5 text-surface-600">{item.user_name}</td>
                                        <td className="px-4 py-2.5 text-right">
                                            {item.status === 'completed' && (
                                                <button
                                                    onClick={() => handleRollback(item.id)}
                                                    disabled={rollback.isPending}
                                                    className="flex items-center gap-1 ml-auto rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                                                >
                                                    <RotateCcw className="h-3 w-3" />
                                                    Rollback
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Confirm All Modal */}
            {showConfirmAll && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="rounded-2xl border border-default bg-surface-0 p-6 shadow-xl max-w-md w-full mx-4">
                        <h3 className="text-lg font-bold text-surface-900">Importar Tudo</h3>
                        <p className="mt-2 text-sm text-surface-600">
                            Isso irÃ¡ importar todas as entidades do Auvo na ordem correta de dependÃªncia.
                            O processo pode levar alguns minutos.
                        </p>
                        <p className="mt-2 text-xs text-surface-500">
                            EstratÃ©gia: <strong>{strategy === 'skip' ? 'Pular duplicados' : 'Atualizar existentes'}</strong>
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                onClick={() => setShowConfirmAll(false)}
                                className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleImportAll}
                                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
                            >
                                Confirmar ImportaÃ§Ã£o
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AuvoImportPage