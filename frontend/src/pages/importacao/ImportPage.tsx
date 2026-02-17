import React, { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check,
    AlertCircle, CheckCircle2, AlertTriangle, Loader2,
    History, Save, X, Download, Trash2, Undo2, Eye, FileDown,
    BarChart3, RefreshCw, Database
} from 'lucide-react'
import api from '@/lib/api'
import { IMPORT_ROW_STATUS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

type Entity = 'customers' | 'products' | 'services' | 'equipments' | 'suppliers'
type Step = 0 | 1 | 2 | 3
type DuplicateStrategy = 'skip' | 'update' | 'create'

interface FieldDef {
    key: string
    label: string
    required: boolean
}

interface UploadResult {
    file_path: string
    file_name: string
    encoding: string
    separator: string
    headers: string[]
    total_rows: number
    entity_type: string
    available_fields: FieldDef[]
}

interface PreviewRow {
    line: number
    data: Record<string, string>
    status: typeof IMPORT_ROW_STATUS[keyof typeof IMPORT_ROW_STATUS]
    messages: string[]
}

interface ImportResult {
    import_id: number
    total_rows: number
    inserted: number
    updated: number
    skipped: number
    errors: number
    error_log: Array<{ line: number; message: string; data: Record<string, string> }>
}

const entities: { key: Entity; label: string }[] = [
    { key: 'customers', label: 'Clientes' },
    { key: 'products', label: 'Produtos' },
    { key: 'services', label: 'Serviços' },
    { key: 'equipments', label: 'Equipamentos' },
    { key: 'suppliers', label: 'Fornecedores' },
]

const ACCEPTED_FILE_TYPES = ['.csv', '.txt']
const ACCEPTED_MIME_TYPES = [
    'text/csv',
    'text/plain',
]

const isValidFile = (file: File): boolean => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    return ACCEPTED_FILE_TYPES.includes(ext) || ACCEPTED_MIME_TYPES.includes(file.type)
}

const stepLabels = ['Upload', 'Mapeamento', 'Validação', 'Resultado']
const strategyLabels: Record<DuplicateStrategy, string> = {
    skip: 'Pular duplicatas',
    update: 'Atualizar existentes',
    create: 'Criar novo mesmo assim',
}

export default function ImportPage() {
    const [step, setStep] = useState<Step>(0)
    const [entity, setEntity] = useState<Entity>('customers')
    const [uploadData, setUploadData] = useState<UploadResult | null>(null)
    const [mapping, setMapping] = useState<Record<string, string>>({})
    const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
    const [previewStats, setPreviewStats] = useState({ valid: 0, warnings: 0, errors: 0 })
    const [strategy, setStrategy] = useState<DuplicateStrategy>('skip')
    const [result, setResult] = useState<ImportResult | null>(null)
    const [showHistory, setShowHistory] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [templateName, setTemplateName] = useState('')
    const [showTemplateInput, setShowTemplateInput] = useState(false)
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
    const [historyEntityFilter, setHistoryEntityFilter] = useState('')
    const [historyStatusFilter, setHistoryStatusFilter] = useState('')
    const [historyDateFrom, setHistoryDateFrom] = useState('')
    const [historyDateTo, setHistoryDateTo] = useState('')
    const [historySearchTerm, setHistorySearchTerm] = useState('')
    const [historyPage, setHistoryPage] = useState(1)
    const [expandedImportId, setExpandedImportId] = useState<number | null>(null)
    const [showStats, setShowStats] = useState(false)
    const [isDownloadingSample, setIsDownloadingSample] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => { } })

    const queryClient = useQueryClient()
    const hasPermission = useAuthStore(s => s.hasPermission)

    // Templates
    const { data: templates } = useQuery({
        queryKey: ['import-templates', entity],
        queryFn: () => api.get(`/import/templates?entity_type=${entity}`).then(r => r.data.templates),
    })

    // Estatísticas
    const { data: statsData } = useQuery({
        queryKey: ['import-stats'],
        queryFn: () => api.get('/import-stats').then(r => r.data.stats),
        enabled: showStats,
    })

    // F6: Contagem de registros por entidade
    const { data: entityCounts } = useQuery({
        queryKey: ['import-entity-counts'],
        queryFn: () => api.get('/import-entity-counts').then(r => r.data.counts),
        staleTime: 60_000,
    })

    const handleReImport = useCallback((h: any) => {
        setEntity(h.entity_type)
        if (h.mapping) setMapping(h.mapping)
        setStrategy(h.duplicate_strategy || 'skip')
        setShowHistory(false)
        setStep(0)
        setSuccessMessage(`Re-importar: selecione o arquivo CSV para ${entities.find(e => e.key === h.entity_type)?.label ?? h.entity_type}. O mapeamento anterior foi carregado.`)
    }, [])

    // Histórico
    const { data: historyResponse, isLoading: historyLoading } = useQuery({
        queryKey: ['import-history', historyEntityFilter, historyStatusFilter, historyDateFrom, historyDateTo, historySearchTerm, historyPage],
        queryFn: () => {
            const params = new URLSearchParams()
            if (historyEntityFilter) params.append('entity_type', historyEntityFilter)
            if (historyStatusFilter) params.append('status', historyStatusFilter)
            if (historyDateFrom) params.append('date_from', historyDateFrom)
            if (historyDateTo) params.append('date_to', historyDateTo)
            if (historySearchTerm) params.append('search', historySearchTerm)
            params.append('page', String(historyPage))
            return api.get(`/import/history?${params}`).then(r => r.data)
        },
        enabled: showHistory,
    })

    const history = historyResponse?.data ?? []
    const historyLastPage = historyResponse?.last_page ?? 1
    const historyTotal = historyResponse?.total ?? 0

    // Map de entity para queryKey usada nos módulos
    const entityQueryKeyMap: Record<Entity, string[]> = {
        customers: ['customers'],
        products: ['products'],
        services: ['services'],
        equipments: ['equipments'],
        suppliers: ['suppliers'],
    }

    // Upload
    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('entity_type', entity)
            return api.post('/import/upload', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            }).then(r => r.data as UploadResult)
        },
        onSuccess: (data) => {
            setUploadData(data)
            setErrorMessage(null)
            // Auto-map por nome similar
            const autoMap: Record<string, string> = {}
            data.available_fields.forEach(f => {
                const match = data.headers.find(h =>
                    h.toLowerCase().includes(f.key.toLowerCase()) ||
                    f.label.toLowerCase().includes(h.toLowerCase()) ||
                    h.toLowerCase().includes(f.label.toLowerCase())
                )
                if (match) autoMap[f.key] = match
            })
            setMapping(autoMap)
            setStep(1)
        },
        onError: (err: any) => {
            toast.error('Ocorreu um erro. Tente novamente.')
            if (err?.response?.status === 403) {
                setErrorMessage('Sem permissão para realizar upload.')
            } else {
                setErrorMessage('Erro ao processar arquivo. Verifique o formato e tente novamente.')
            }
        },
    })

    // Preview
    const previewMutation = useMutation({
        mutationFn: () => api.post('/import/preview', {
            file_path: uploadData?.file_path,
            entity_type: entity,
            mapping,
            separator: uploadData?.separator,
        }).then(r => r.data),
        onSuccess: (data) => {
            setPreviewRows(data.rows)
            setPreviewStats(data.stats)
            setErrorMessage(null)
            setStep(2)
        },
        onError: (err: any) => {
            toast.error('Ocorreu um erro. Tente novamente.')
            if (err?.response?.status === 403) {
                setErrorMessage('Sem permissão para validar preview.')
            } else {
                setErrorMessage('Erro ao validar preview. Verifique o mapeamento e tente novamente.')
            }
        },
    })

    // Execute
    const executeMutation = useMutation({
        mutationFn: () => api.post('/import/execute', {
            file_path: uploadData?.file_path,
            entity_type: entity,
            mapping,
            separator: uploadData?.separator,
            duplicate_strategy: strategy,
            original_name: uploadData?.file_name,
        }).then(r => r.data as ImportResult),
        onSuccess: (data) => {
            setResult(data)
            setErrorMessage(null)
            setStep(3)
            queryClient.invalidateQueries({ queryKey: ['import-history'] })
            // Invalidate entity cache so lists reflect new data
            const keys = entityQueryKeyMap[entity]
            if (keys) queryClient.invalidateQueries({ queryKey: keys })
        },
        onError: (err: any) => {
            toast.error('Ocorreu um erro. Tente novamente.')
            if (err?.response?.status === 403) {
                setErrorMessage('Sem permissão para executar importação.')
            } else {
                setErrorMessage(err?.response?.data?.message || 'Erro ao executar importação. Tente novamente.')
            }
        },
    })

    // Save template
    const saveTemplateMutation = useMutation({
        mutationFn: (name: string) => api.post('/import/templates', {
            entity_type: entity,
            name,
            mapping,
        }),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                setSuccessMessage('Template salvo com sucesso!')
            queryClient.invalidateQueries({ queryKey: ['import-templates'] })
            setTimeout(() => setSuccessMessage(null), 3000)
        },
        onError: (err: any) => {
            toast.error('Ocorreu um erro. Tente novamente.')
            if (err?.response?.status === 403) {
                setErrorMessage('Sem permissão para salvar template.')
            } else {
                setErrorMessage('Erro ao salvar template.')
            }
        },
    })

    // Delete template
    const deleteTemplateMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/import/templates/${id}`),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                setSuccessMessage('Template removido!')
            queryClient.invalidateQueries({ queryKey: ['import-templates'] })
            setTimeout(() => setSuccessMessage(null), 3000)
        },
        onError: (err: any) => {
            toast.error('Ocorreu um erro. Tente novamente.')
            if (err?.response?.status === 403) {
                setErrorMessage('Sem permissão para remover template.')
            } else {
                setErrorMessage('Erro ao remover template.')
            }
        },
    })

    // Rollback import
    const rollbackMutation = useMutation({
        mutationFn: (id: number) => api.post(`/import/${id}/rollback`).then(r => r.data),
        onSuccess: (data) => {
            setSuccessMessage(data.message)
            queryClient.invalidateQueries({ queryKey: ['import-history'] })
            setTimeout(() => setSuccessMessage(null), 5000)
        },
        onError: (err: any) => {
            toast.error('Ocorreu um erro. Tente novamente.')
            if (err?.response?.status === 403) {
                setErrorMessage('Sem permissão para desfazer importação.')
            } else {
                setErrorMessage(err?.response?.data?.message || 'Erro ao desfazer importação.')
            }
        },
    })

    // Delete import record
    const deleteImportMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/import/${id}`),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                setSuccessMessage('Registro de importação removido.')
            queryClient.invalidateQueries({ queryKey: ['import-history'] })
            setTimeout(() => setSuccessMessage(null), 3000)
        },
        onError: (err: any) => {
            toast.error('Ocorreu um erro. Tente novamente.')
            if (err?.response?.status === 403) {
                setErrorMessage('Sem permissão para remover registro.')
            } else {
                setErrorMessage(err?.response?.data?.message || 'Erro ao remover registro.')
            }
        },
    })

    const downloadSampleCsv = async () => {
        setIsDownloadingSample(true)
        try {
            const response = await api.get(`/import/sample/${entity}`, { responseType: 'blob' })
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.download = `modelo_importação_${entity}.csv`
            link.click()
            window.URL.revokeObjectURL(url)
        } catch {
            setErrorMessage('Erro ao baixar modelo.')
        } finally {
            setIsDownloadingSample(false)
        }
    }

    const exportEntityData = async () => {
        setIsExporting(true)
        try {
            const response = await api.get(`/import/export/${entity}`, { responseType: 'blob' })
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.download = `exportação_${entity}_${new Date().toISOString().slice(0, 10)}.csv`
            link.click()
            window.URL.revokeObjectURL(url)
            setSuccessMessage('Dados exportados com sucesso!')
            setTimeout(() => setSuccessMessage(null), 3000)
        } catch (err: any) {
            if (err?.response?.status === 403) {
                setErrorMessage('Sem permissão para exportar dados.')
            } else {
                setErrorMessage('Erro ao exportar dados.')
            }
        } finally {
            setIsExporting(false)
        }
    }

    const downloadErrorCsv = async (importId: number) => {
        try {
            const response = await api.get(`/import/${importId}/errors`, { responseType: 'blob' })
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.download = `erros_importação_${importId}.csv`
            link.click()
            window.URL.revokeObjectURL(url)
        } catch {
            setErrorMessage('Erro ao exportar erros.')
        }
    }

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) {
            if (!isValidFile(file)) {
                setErrorMessage('Tipo de arquivo inválido. Aceitos: CSV, TXT.')
                return
            }
            setErrorMessage(null)
            uploadMutation.mutate(file)
        }
    }, [uploadMutation, entity])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (!isValidFile(file)) {
                setErrorMessage('Tipo de arquivo inválido. Aceitos: CSV, TXT.')
                return
            }
            uploadMutation.mutate(file)
        }
    }

    const applyTemplate = (t: { mapping: Record<string, string> }) => {
        setMapping(t.mapping)
    }

    const clearHistoryFilters = () => {
        setHistoryEntityFilter('')
        setHistoryStatusFilter('')
        setHistoryDateFrom('')
        setHistoryDateTo('')
        setHistorySearchTerm('')
        setHistoryPage(1)
    }

    const hasActiveFilters = historyEntityFilter || historyStatusFilter || historyDateFrom || historyDateTo || historySearchTerm

    const reset = () => {
        setStep(0)
        setUploadData(null)
        setMapping({})
        setPreviewRows([])
        setPreviewStats({ valid: 0, warnings: 0, errors: 0 })
        setResult(null)
        setErrorMessage(null)
        setSuccessMessage(null)
        setTemplateName('')
        setShowTemplateInput(false)
    }

    const getFieldLabel = (key: string): string => {
        const field = uploadData?.available_fields.find(f => f.key === key)
        return field?.label ?? key
    }

    const mappedCount = Object.values(mapping).filter(Boolean).length
    const requiredFields = uploadData?.available_fields.filter(f => f.required) ?? []
    const requiredMapped = requiredFields.every(f => mapping[f.key])

    return (
        <>
            <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Importação de Dados</h1>
                        <p className="text-[13px] text-surface-500">
                            Importe clientes, produtos, serviços, equipamentos e fornecedores via CSV
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setShowStats(!showStats); if (!showStats) setShowHistory(false) }}
                            className={cn(
                                'flex items-center gap-2 rounded-lg border border-default px-4 py-2 text-sm font-medium hover:bg-surface-50',
                                showStats ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-surface-0'
                            )}
                        >
                            <BarChart3 size={16} />
                            Estatísticas
                        </button>
                        <button
                            onClick={() => { setShowHistory(!showHistory); if (!showHistory) setShowStats(false) }}
                            className={cn(
                                'flex items-center gap-2 rounded-lg border border-default px-4 py-2 text-sm font-medium hover:bg-surface-50',
                                showHistory ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-surface-0'
                            )}
                        >
                            <History size={16} />
                            Histórico
                        </button>
                    </div>
                </div>

                {/* Mensagens de erro e sucesso */}
                {errorMessage && (
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between">
                        <div>
                            <AlertCircle size={16} className="mr-1 inline" />
                            {errorMessage}
                        </div>
                        <button onClick={() => setErrorMessage(null)}><X size={14} /></button>
                    </div>
                )}
                {successMessage && (
                    <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 flex items-center justify-between">
                        <div>
                            <CheckCircle2 size={16} className="mr-1 inline" />
                            {successMessage}
                        </div>
                        <button onClick={() => setSuccessMessage(null)}><X size={14} /></button>
                    </div>
                )}

                {/* Histórico */}
                {showHistory && (
                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-surface-900">Histórico de Importações</h3>
                                {historyTotal > 0 && (
                                    <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                                        {historyTotal}
                                    </span>
                                )}
                            </div>
                            <button onClick={() => setShowHistory(false)}><X size={16} /></button>
                        </div>

                        {/* Filtros */}
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                            <input
                                type="text"
                                value={historySearchTerm}
                                onChange={(e) => { setHistorySearchTerm(e.target.value); setHistoryPage(1) }}
                                placeholder="Buscar por nome do arquivo..."
                                className="rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm min-w-[200px]"
                            />
                            <select
                                value={historyEntityFilter}
                                onChange={(e) => { setHistoryEntityFilter(e.target.value); setHistoryPage(1) }}
                                className="rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm"
                            >
                                <option value="">Todas as entidades</option>
                                {entities.map(e => (
                                    <option key={e.key} value={e.key}>{e.label}</option>
                                ))}
                            </select>
                            <select
                                value={historyStatusFilter}
                                onChange={(e) => { setHistoryStatusFilter(e.target.value); setHistoryPage(1) }}
                                className="rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm"
                            >
                                <option value="">Todos os status</option>
                                <option value="done">Concluído</option>
                                <option value="failed">Falhou</option>
                                <option value="processing">Processando</option>
                                <option value="rolled_back">Desfeito</option>
                                <option value="partially_rolled_back">Parcialmente Desfeito</option>
                            </select>
                            <input
                                type="date"
                                value={historyDateFrom}
                                onChange={(e) => { setHistoryDateFrom(e.target.value); setHistoryPage(1) }}
                                className="rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm"
                                placeholder="Data início"
                            />
                            <input
                                type="date"
                                value={historyDateTo}
                                onChange={(e) => { setHistoryDateTo(e.target.value); setHistoryPage(1) }}
                                className="rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm"
                                placeholder="Data fim"
                            />
                            {hasActiveFilters && (
                                <button
                                    onClick={clearHistoryFilters}
                                    className="flex items-center gap-1 rounded-lg border border-surface-200 px-3 py-1.5 text-sm text-surface-600 hover:bg-surface-50"
                                >
                                    <X size={14} />
                                    Limpar Filtros
                                </button>
                            )}
                        </div>

                        <div className="space-y-2">
                            {historyLoading && (
                                <div className="space-y-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-100" />
                                    ))}
                                </div>
                            )}
                            {!historyLoading && (history ?? []).length === 0 && (
                                <div className="flex flex-col items-center justify-center py-8 text-surface-400">
                                    <History size={32} className="mb-2" />
                                    <p className="text-sm font-medium">Nenhuma importação encontrada</p>
                                    {hasActiveFilters && (
                                        <p className="mt-1 text-xs">Tente ajustar os filtros</p>
                                    )}
                                </div>
                            )}
                            {!historyLoading && (history ?? []).map((h: { id: number; file_name: string; original_name?: string; entity_type: string; status: string; inserted: number; updated: number; skipped: number; errors: number; total_rows: number; created_at: string; user?: { name: string } }) => (
                                <div key={h.id} className="rounded-lg bg-surface-50 p-3 text-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{h.original_name || h.file_name}</span>
                                            <span className="text-surface-500">
                                                {entities.find(e => e.key === h.entity_type)?.label ?? h.entity_type}
                                            </span>
                                            <span className={cn(
                                                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                                h.status === 'done' && 'bg-emerald-100 text-emerald-700',
                                                h.status === 'failed' && 'bg-red-100 text-red-700',
                                                h.status === 'processing' && 'bg-blue-100 text-blue-700',
                                                h.status === 'pending' && 'bg-surface-200 text-surface-600',
                                                h.status === 'rolled_back' && 'bg-amber-100 text-amber-700',
                                                h.status === 'partially_rolled_back' && 'bg-orange-100 text-orange-700',
                                            )}>
                                                {h.status === 'done' ? 'Concluído' : h.status === 'failed' ? 'Falhou' : h.status === 'processing' ? 'Processando' : h.status === 'rolled_back' ? 'Desfeito' : h.status === 'partially_rolled_back' ? 'Parcial' : 'Pendente'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-surface-400 text-xs" title="Total de linhas">{h.total_rows} linhas</span>
                                            <span className="text-emerald-600">+{h.inserted}</span>
                                            <span className="text-blue-600">↻{h.updated}</span>
                                            <span className="text-surface-400">âŠ˜{h.skipped}</span>
                                            {h.errors > 0 && <span className="text-red-600">âœ•{h.errors}</span>}
                                            <span className="text-surface-400 text-xs">
                                                {new Date(h.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                            </span>
                                            {h.user?.name && (
                                                <span className="text-surface-400 text-xs" title="Importado por">
                                                    {h.user.name}
                                                </span>
                                            )}
                                            <button
                                                onClick={() => setExpandedImportId(expandedImportId === h.id ? null : h.id)}
                                                title="Ver detalhes"
                                                className={cn(
                                                    'rounded p-1 hover:bg-surface-200',
                                                    expandedImportId === h.id ? 'text-brand-600 bg-brand-50' : 'text-surface-500'
                                                )}
                                            >
                                                <Eye size={14} />
                                            </button>
                                            {h.errors > 0 && (
                                                <button
                                                    onClick={() => downloadErrorCsv(h.id)}
                                                    title="Exportar erros"
                                                    className="rounded p-1 text-red-500 hover:bg-red-50"
                                                >
                                                    <Download size={14} />
                                                </button>
                                            )}
                                            {h.status === 'done' && hasPermission('import.data.delete') && (
                                                <button
                                                    onClick={() => setConfirmDialog({
                                                        open: true,
                                                        title: 'Desfazer Importação',
                                                        message: 'Tem certeza que deseja desfazer esta importação? Os registros importados serão excluídos.',
                                                        onConfirm: () => { rollbackMutation.mutate(h.id); setConfirmDialog(prev => ({ ...prev, open: false })) },
                                                    })}
                                                    disabled={rollbackMutation.isPending}
                                                    title="Desfazer importação"
                                                    className="rounded p-1 text-amber-600 hover:bg-amber-50 disabled:opacity-50"
                                                >
                                                    <Undo2 size={14} />
                                                </button>
                                            )}
                                            {(h.status === 'failed' || h.status === 'rolled_back' || h.status === 'partially_rolled_back') && hasPermission('import.data.delete') && (
                                                <button
                                                    onClick={() => setConfirmDialog({
                                                        open: true,
                                                        title: 'Remover Registro',
                                                        message: 'Remover este registro do histórico?',
                                                        onConfirm: () => { deleteImportMutation.mutate(h.id); setConfirmDialog(prev => ({ ...prev, open: false })) },
                                                    })}
                                                    disabled={deleteImportMutation.isPending}
                                                    title="Remover registro"
                                                    className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                            {hasPermission('import.data.execute') && (
                                                <button
                                                    onClick={() => handleReImport(h)}
                                                    title="Re-importar com mesmo mapeamento"
                                                    className="rounded p-1 text-brand-600 hover:bg-brand-50"
                                                >
                                                    <RefreshCw size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {expandedImportId === h.id && (
                                        <div className="mt-2 rounded-lg bg-surface-100 p-3 text-xs space-y-2">
                                            <div className="flex gap-4">
                                                <span><strong>Usuário:</strong> {(h as any).user?.name ?? '—'}</span>
                                                <span><strong>Estratégia:</strong> {(h as any).duplicate_strategy ?? '—'}</span>
                                                <span><strong>Separador:</strong> {(h as any).separator ?? '—'}</span>
                                            </div>
                                            {(h as any).mapping && (
                                                <div>
                                                    <strong>Mapeamento:</strong>
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {Object.entries((h as any).mapping).map(([field, header]) => (
                                                            <span key={field} className="rounded bg-surface-200 px-2 py-0.5">
                                                                {String(field)} → {String(header)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {(h as any).error_log?.length > 0 && (
                                                <div>
                                                    <strong className="text-red-700">Erros ({(h as any).error_log.length}):</strong>
                                                    <div className="mt-1 max-h-32 overflow-auto space-y-0.5">
                                                        {(h as any).error_log.slice(0, 20).map((e: any, i: number) => (
                                                            <div key={i} className="rounded bg-red-50 px-2 py-1">
                                                                <span className="font-medium text-red-600">Linha {e.line}:</span>{' '}
                                                                <span className="text-surface-700">{e.message}</span>
                                                            </div>
                                                        ))}
                                                        {(h as any).error_log.length > 20 && (
                                                            <p className="text-surface-500 italic">... e mais {(h as any).error_log.length - 20} erros</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Paginação */}
                        {historyLastPage > 1 && (
                            <div className="mt-3 flex items-center justify-between text-sm">
                                <span className="text-surface-500">
                                    {historyTotal} importações
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                        disabled={historyPage <= 1}
                                        className="rounded-lg border border-default px-3 py-1 text-surface-600 hover:bg-surface-50 disabled:opacity-40"
                                    >
                                        <ArrowLeft size={14} />
                                    </button>
                                    <span className="text-surface-600">
                                        {historyPage} / {historyLastPage}
                                    </span>
                                    <button
                                        onClick={() => setHistoryPage(p => Math.min(historyLastPage, p + 1))}
                                        disabled={historyPage >= historyLastPage}
                                        className="rounded-lg border border-default px-3 py-1 text-surface-600 hover:bg-surface-50 disabled:opacity-40"
                                    >
                                        <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Estatísticas */}
                {showStats && (
                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold text-surface-900">Estatísticas de Importação</h3>
                            <button onClick={() => setShowStats(false)}><X size={16} /></button>
                        </div>
                        {!statsData ? (
                            <div className="flex items-center justify-center py-6">
                                <Loader2 size={20} className="animate-spin text-surface-400" />
                            </div>
                        ) : Object.values(statsData as Record<string, { total_imports: number }>).every(s => s.total_imports === 0) ? (
                            <div className="flex flex-col items-center justify-center py-8 text-surface-400">
                                <BarChart3 size={40} className="mb-2" />
                                <p className="text-sm font-medium">Nenhuma importação realizada ainda</p>
                                <p className="text-xs">As estatísticas aparecerão após a primeira importação</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                                {entities.map(ent => {
                                    const s = (statsData as any)?.[ent.key]
                                    if (!s) return null
                                    return (
                                        <div key={ent.key} className="rounded-lg border border-default bg-surface-50 p-4 space-y-2">
                                            <h4 className="text-sm font-semibold text-surface-800">{ent.label}</h4>
                                            <div className="text-xs text-surface-500 space-y-1">
                                                <div className="flex justify-between">
                                                    <span>Importações</span>
                                                    <span className="font-medium text-surface-700">{s.total_imports}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Taxa sucesso</span>
                                                    <span className={cn(
                                                        'font-medium',
                                                        s.success_rate >= 80 ? 'text-emerald-600' : s.success_rate >= 50 ? 'text-amber-600' : 'text-red-600'
                                                    )}>{s.success_rate}%</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Inseridos</span>
                                                    <span className="font-medium text-emerald-600">+{s.total_inserted}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Atualizados</span>
                                                    <span className="font-medium text-blue-600">{s.total_updated}</span>
                                                </div>
                                                {s.last_import_at && (
                                                    <div className="flex justify-between">
                                                        <span>Última</span>
                                                        <span className="font-medium text-surface-600">
                                                            {new Date(s.last_import_at).toLocaleDateString('pt-BR')}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Stepper */}
                <div className="flex items-center justify-center gap-2">
                    {stepLabels.map((label, i) => (
                        <div key={label} className="flex items-center gap-2">
                            <div className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors',
                                i <= step ? 'bg-brand-600 text-white' : 'bg-surface-200 text-surface-500'
                            )}>
                                {i < step ? <Check size={16} /> : i + 1}
                            </div>
                            <span className={cn(
                                'text-sm font-medium',
                                i <= step ? 'text-surface-900' : 'text-surface-400'
                            )}>{label}</span>
                            {i < 3 && <ArrowRight size={16} className="text-surface-300 mx-1" />}
                        </div>
                    ))}
                </div>

                {/* Step 0: Upload */}
                {step === 0 && (
                    <div className="space-y-4">
                        {/* Seletor de entidade */}
                        <div className="grid grid-cols-5 gap-3">
                            {entities.map(e => (
                                <button
                                    key={e.key}
                                    onClick={() => setEntity(e.key)}
                                    className={cn(
                                        'rounded-xl border-2 p-4 text-center font-medium transition-all',
                                        entity === e.key
                                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                                            : 'border-default bg-surface-0 text-surface-600 hover:border-surface-300'
                                    )}
                                >
                                    {e.label}
                                    {entityCounts?.[e.key] != null && (
                                        <span className="mt-1 flex items-center justify-center gap-1 text-xs text-surface-400">
                                            <Database size={12} />
                                            {entityCounts[e.key].toLocaleString('pt-BR')} registros
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Ãrea de drop */}
                        <div
                            onDragOver={e => e.preventDefault()}
                            onDrop={handleDrop}
                            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-surface-300 bg-surface-50 p-12 transition-colors hover:border-brand-400 hover:bg-brand-50/30"
                        >
                            {uploadMutation.isPending ? (
                                <Loader2 size={48} className="animate-spin text-brand-500" />
                            ) : (
                                <>
                                    <Upload size={48} className="mb-4 text-surface-400" />
                                    <p className="mb-2 text-lg font-medium text-surface-700">
                                        Arraste um arquivo CSV ou TXT aqui
                                    </p>
                                    <p className="mb-4 text-[13px] text-surface-500">
                                        ou clique para selecionar
                                    </p>
                                    <label className="cursor-pointer rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
                                        Selecionar Arquivo
                                        <input
                                            type="file"
                                            accept=".csv,.txt"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                    </label>
                                </>
                            )}
                        </div>

                        <div className="flex items-center justify-between rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
                            <div>
                                <h4 className="mb-2 font-semibold flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    Dicas de Formatação
                                </h4>
                                <ul className="list-disc pl-5 space-y-1 text-blue-700">
                                    <li>Arquivos <strong>CSV</strong> ou <strong>TXT</strong> com codificação UTF-8 ou ISO-8859-1.</li>
                                    <li>Separadores aceitos: Ponto e vírgula (;), Vírgula (,) ou Tabulação.</li>
                                    <li>Para valores monetários, use o formato brasileiro (ex: <strong>1.234,56</strong>) ou internacional (ex: <strong>1234.56</strong>).</li>
                                    <li>Datas devem estar no formato <strong>DD/MM/AAAA</strong> ou <strong>AAAA-MM-DD</strong>.</li>
                                    <li>Campos de CPF/CNPJ serão limpos automaticamente (removendo pontos e traços).</li>
                                    <li>O tipo PF/PJ será detectado automaticamente pelo CPF/CNPJ.</li>
                                </ul>
                            </div>
                            <div className="flex gap-2 ml-4 shrink-0">
                                <button
                                    onClick={downloadSampleCsv}
                                    disabled={isDownloadingSample}
                                    className="flex items-center gap-2 rounded-lg border border-blue-300 bg-surface-0 dark:bg-surface-800 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                                >
                                    {isDownloadingSample ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                    Baixar Modelo CSV
                                </button>
                                {hasPermission('import.data.execute') && (
                                    <button
                                        onClick={exportEntityData}
                                        disabled={isExporting}
                                        className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-surface-0 dark:bg-surface-800 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                    >
                                        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                                        Exportar Dados
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 1: Mapeamento */}
                {step === 1 && uploadData && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-surface-900">
                                        <FileSpreadsheet size={18} className="mr-2 inline text-brand-500" />
                                        {uploadData.file_name}
                                    </h3>
                                    <p className="text-[13px] text-surface-500">
                                        {uploadData.total_rows} linhas • Encoding: {uploadData.encoding} • Separador: {uploadData.separator === 'tab' ? 'TAB' : uploadData.separator}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {(templates ?? []).length > 0 && (
                                        <div className="flex items-center gap-1">
                                            <select
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                                    const val = +e.target.value
                                                    setSelectedTemplateId(val || null)
                                                    const tpl = templates?.find((item: { id: number; mapping: Record<string, string> }) => item.id === val)
                                                    if (tpl) applyTemplate(tpl)
                                                }}
                                                className="rounded-lg border border-surface-200 px-3 py-1.5 text-sm"
                                                defaultValue=""
                                            >
                                                <option value="" disabled>Aplicar template...</option>
                                                {(templates ?? []).map((t: { id: number; name: string }) => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => {
                                                    if (selectedTemplateId) {
                                                        const tplToDelete = templates?.find((t: { id: number; name: string }) => t.id === selectedTemplateId)
                                                        if (tplToDelete) {
                                                            setConfirmDialog({
                                                                open: true,
                                                                title: 'Remover Template',
                                                                message: `Remover template "${tplToDelete.name}"?`,
                                                                onConfirm: () => {
                                                                    deleteTemplateMutation.mutate(selectedTemplateId)
                                                                    setSelectedTemplateId(null)
                                                                    setConfirmDialog(prev => ({ ...prev, open: false }))
                                                                },
                                                            })
                                                        }
                                                    } else {
                                                        setErrorMessage('Selecione um template para remover.')
                                                        setTimeout(() => setErrorMessage(null), 3000)
                                                    }
                                                }}
                                                disabled={deleteTemplateMutation.isPending}
                                                title="Remover template selecionado"
                                                className="rounded p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                {uploadData.available_fields.map(field => (
                                    <div key={field.key} className="flex items-center gap-4">
                                        <div className="w-52">
                                            <span className="text-sm font-medium">{field.label}</span>
                                            {field.required && (
                                                <span className="ml-1 text-xs text-red-500">*</span>
                                            )}
                                        </div>
                                        <ArrowLeft size={16} className="text-surface-400" />
                                        <select
                                            value={mapping[field.key] || ''}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMapping(prev => ({
                                                ...prev,
                                                [field.key]: e.target.value,
                                            }))}
                                            className={cn(
                                                'flex-1 rounded-lg border px-3 py-2 text-sm',
                                                field.required && !mapping[field.key]
                                                    ? 'border-red-300 bg-red-50'
                                                    : 'border-default bg-surface-0'
                                            )}
                                        >
                                            <option value="">— Não importar —</option>
                                            {uploadData.headers.map(h => (
                                                <option key={h} value={h}>{h}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 flex items-center justify-between border-t border-surface-100 pt-4">
                                <span className="text-[13px] text-surface-500">
                                    {mappedCount} de {uploadData.available_fields.length} campos mapeados
                                </span>
                                <div className="flex gap-2">
                                    {showTemplateInput ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={templateName}
                                                onChange={e => setTemplateName(e.target.value)}
                                                placeholder="Nome do template"
                                                className="rounded-lg border border-surface-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                                                autoFocus
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && templateName.trim()) {
                                                        saveTemplateMutation.mutate(templateName.trim())
                                                        setShowTemplateInput(false)
                                                        setTemplateName('')
                                                    }
                                                    if (e.key === 'Escape') {
                                                        setShowTemplateInput(false)
                                                        setTemplateName('')
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={() => {
                                                    if (templateName.trim()) {
                                                        saveTemplateMutation.mutate(templateName.trim())
                                                        setShowTemplateInput(false)
                                                        setTemplateName('')
                                                    }
                                                }}
                                                disabled={!templateName.trim() || saveTemplateMutation.isPending}
                                                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
                                            >
                                                Salvar
                                            </button>
                                            <button
                                                onClick={() => { setShowTemplateInput(false); setTemplateName('') }}
                                                className="rounded-lg border border-surface-200 px-3 py-1.5 text-sm hover:bg-surface-50"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowTemplateInput(true)}
                                            className="flex items-center gap-1 rounded-lg border border-surface-200 px-3 py-1.5 text-sm hover:bg-surface-50"
                                        >
                                            <Save size={14} />
                                            Salvar Template
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Estratégia de duplicatas */}
                        <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                            <h4 className="mb-3 text-sm font-semibold text-surface-700">Duplicatas encontradas</h4>
                            <div className="flex gap-3">
                                {(Object.entries(strategyLabels) as [DuplicateStrategy, string][]).map(([key, label]) => (
                                    <label key={key} className={cn(
                                        'flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm transition-all',
                                        strategy === key
                                            ? 'border-brand-500 bg-brand-50'
                                            : 'border-surface-200'
                                    )}>
                                        <input
                                            type="radio"
                                            name="strategy"
                                            checked={strategy === key}
                                            onChange={() => setStrategy(key)}
                                            className="accent-brand-600"
                                        />
                                        {label}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-between">
                            <button onClick={reset} className="rounded-lg border border-surface-200 px-4 py-2 text-sm hover:bg-surface-50">
                                ← Voltar
                            </button>
                            <button
                                onClick={() => previewMutation.mutate()}
                                disabled={!requiredMapped || previewMutation.isPending}
                                className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                            >
                                {previewMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                                Validar Preview
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Preview */}
                {step === 2 && (
                    <div className="space-y-4">
                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-xl border border-emerald-200/50 bg-emerald-50 p-4 text-center">
                                <CheckCircle2 size={20} className="mx-auto mb-1 text-emerald-600" />
                                <p className="text-2xl font-bold text-emerald-700">{previewStats.valid}</p>
                                <p className="text-xs text-emerald-600">Válidas</p>
                            </div>
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                                <AlertTriangle size={20} className="mx-auto mb-1 text-amber-600" />
                                <p className="text-2xl font-bold text-amber-700">{previewStats.warnings}</p>
                                <p className="text-xs text-amber-600">Duplicatas</p>
                            </div>
                            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                                <AlertCircle size={20} className="mx-auto mb-1 text-red-600" />
                                <p className="text-2xl font-bold text-red-700">{previewStats.errors}</p>
                                <p className="text-xs text-red-600">Erros</p>
                            </div>
                        </div>

                        {/* Tabela preview */}
                        <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-subtle bg-surface-50">
                                        <th className="px-3 py-2 text-left font-semibold text-surface-600">Linha</th>
                                        <th className="px-3 py-2 text-left font-semibold text-surface-600">Status</th>
                                        {Object.keys(mapping).filter(k => mapping[k]).map(k => (
                                            <th key={k} className="px-3 py-2 text-left font-semibold text-surface-600">{getFieldLabel(k)}</th>
                                        ))}
                                        <th className="px-3 py-2 text-left font-semibold text-surface-600">Mensagens</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-subtle">
                                    {previewRows.map(row => (
                                        <tr key={row.line} className={cn(
                                            'transition-colors',
                                            row.status === IMPORT_ROW_STATUS.ERROR && 'bg-red-50/50',
                                            row.status === IMPORT_ROW_STATUS.WARNING && 'bg-amber-50/50',
                                        )}>
                                            <td className="px-3 py-2 text-surface-500">{row.line}</td>
                                            <td className="px-3 py-2">
                                                {row.status === IMPORT_ROW_STATUS.VALID && <CheckCircle2 size={16} className="text-emerald-500" />}
                                                {row.status === IMPORT_ROW_STATUS.WARNING && <AlertTriangle size={16} className="text-amber-500" />}
                                                {row.status === IMPORT_ROW_STATUS.ERROR && <AlertCircle size={16} className="text-red-500" />}
                                            </td>
                                            {Object.keys(mapping).filter(k => mapping[k]).map(k => (
                                                <td key={k} className="max-w-[200px] truncate px-3 py-2">
                                                    {row.data[k] || '—'}
                                                </td>
                                            ))}
                                            <td className="px-3 py-2 text-xs text-surface-500">
                                                {row.messages.join('; ')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between">
                            <button onClick={() => setStep(1)} className="rounded-lg border border-surface-200 px-4 py-2 text-sm hover:bg-surface-50">
                                ← Ajustar Mapeamento
                            </button>
                            <button
                                onClick={() => {
                                    if ((uploadData?.total_rows ?? 0) > 500) {
                                        setConfirmDialog({
                                            open: true,
                                            title: 'Importação Grande',
                                            message: `Você está prestes a importar ${uploadData?.total_rows?.toLocaleString('pt-BR')} linhas. Deseja continuar?`,
                                            onConfirm: () => { executeMutation.mutate(); setConfirmDialog(prev => ({ ...prev, open: false })) },
                                        })
                                    } else {
                                        executeMutation.mutate()
                                    }
                                }}
                                disabled={executeMutation.isPending}
                                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {executeMutation.isPending ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Processando...
                                    </>
                                ) : (
                                    <>
                                        <Check size={16} />
                                        Importar {uploadData?.total_rows?.toLocaleString('pt-BR')} linhas
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Resultado */}
                {step === 3 && result && (
                    <div className="space-y-4">
                        {result.errors > 0 && result.inserted === 0 && result.updated === 0 ? (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
                                <AlertCircle size={48} className="mx-auto mb-3 text-red-500" />
                                <h2 className="text-xl font-bold text-red-800">Importação Falhou</h2>
                                <p className="mt-1 text-sm text-red-600">Nenhum registro foi importado. Verifique os erros abaixo.</p>
                            </div>
                        ) : result.errors > 0 ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
                                <AlertTriangle size={48} className="mx-auto mb-3 text-amber-500" />
                                <h2 className="text-xl font-bold text-amber-800">Importação Concluída com Avisos</h2>
                                <p className="mt-1 text-sm text-amber-600">{result.inserted + result.updated} registros importados, {result.errors} com erro.</p>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-emerald-200/50 bg-emerald-50 p-8 text-center">
                                <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-500" />
                                <h2 className="text-xl font-bold text-emerald-800">Importação Concluída!</h2>
                            </div>
                        )}

                        <div className="grid grid-cols-5 gap-3">
                            <div className="rounded-xl border border-default bg-surface-0 p-5 text-center shadow-card">
                                <p className="text-3xl font-bold text-surface-900">{result.total_rows}</p>
                                <p className="text-xs text-surface-500">Total</p>
                            </div>
                            <div className="rounded-xl border border-default bg-surface-0 p-5 text-center shadow-card">
                                <p className="text-3xl font-bold text-emerald-600">{result.inserted}</p>
                                <p className="text-xs text-surface-500">Inseridos</p>
                            </div>
                            <div className="rounded-xl border border-default bg-surface-0 p-5 text-center shadow-card">
                                <p className="text-3xl font-bold text-blue-600">{result.updated}</p>
                                <p className="text-xs text-surface-500">Atualizados</p>
                            </div>
                            <div className="rounded-xl border border-default bg-surface-0 p-5 text-center shadow-card">
                                <p className="text-3xl font-bold text-surface-500">{result.skipped}</p>
                                <p className="text-xs text-surface-500">Pulados</p>
                            </div>
                            <div className="rounded-xl border border-default bg-surface-0 p-5 text-center shadow-card">
                                <p className="text-3xl font-bold text-red-600">{result.errors}</p>
                                <p className="text-xs text-surface-500">Erros</p>
                            </div>
                        </div>

                        {result.error_log?.length > 0 && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-5">
                                <h3 className="mb-3 font-semibold text-red-800">Erros encontrados</h3>
                                <div className="max-h-60 space-y-1 overflow-auto text-sm">
                                    {result.error_log.map((e, i) => (
                                        <div key={i} className="rounded bg-surface-0 dark:bg-surface-800 p-2">
                                            <span className="font-medium text-red-700">Linha {e.line}:</span>{' '}
                                            <span className="text-surface-700">{e.message}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-center gap-3">
                            {result.errors > 0 && (
                                <button
                                    onClick={() => downloadErrorCsv(result.import_id)}
                                    className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
                                >
                                    <Download size={16} />
                                    Exportar Erros
                                </button>
                            )}
                            <button onClick={reset} className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
                                Nova Importação
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ConfirmDialog Overlay */}
            {
                confirmDialog.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
                        <div className="w-full max-w-sm rounded-xl bg-surface-0 dark:bg-surface-800 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                            <h3 className="mb-2 text-lg font-semibold text-surface-900">{confirmDialog.title}</h3>
                            <p className="mb-5 text-sm text-surface-600">{confirmDialog.message}</p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
                                    className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-medium hover:bg-surface-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDialog.onConfirm}
                                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    )
}