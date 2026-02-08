import React, { useState, useCallback } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
    Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check,
    AlertCircle, CheckCircle2, AlertTriangle, Loader2,
    Download, History, Save, X
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

type Entity = 'customers' | 'products' | 'services' | 'equipments'
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
    status: 'valid' | 'warning' | 'error'
    messages: string[]
}

const entities: { key: Entity; label: string }[] = [
    { key: 'customers', label: 'Clientes' },
    { key: 'products', label: 'Produtos' },
    { key: 'services', label: 'Serviços' },
    { key: 'equipments', label: 'Equipamentos' },
]

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
    const [result, setResult] = useState<any>(null)
    const [showHistory, setShowHistory] = useState(false)

    // Templates
    const { data: templates } = useQuery({
        queryKey: ['import-templates', entity],
        queryFn: () => api.get(`/import/templates?entity_type=${entity}`).then(r => r.data.templates),
    })

    // Histórico
    const { data: history } = useQuery({
        queryKey: ['import-history'],
        queryFn: () => api.get('/import/history').then(r => r.data.data),
        enabled: showHistory,
    })

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
            setStep(2)
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
        }).then(r => r.data),
        onSuccess: (data) => {
            setResult(data)
            setStep(3)
        },
    })

    // Save template
    const saveTemplateMutation = useMutation({
        mutationFn: (name: string) => api.post('/import/templates', {
            entity_type: entity,
            name,
            mapping,
        }),
    })

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) uploadMutation.mutate(file)
    }, [entity])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) uploadMutation.mutate(file)
    }

    const applyTemplate = (t: any) => {
        setMapping(t.mapping)
    }

    const reset = () => {
        setStep(0)
        setUploadData(null)
        setMapping({})
        setPreviewRows([])
        setResult(null)
    }

    const mappedCount = Object.values(mapping).filter(Boolean).length
    const requiredFields = uploadData?.available_fields.filter(f => f.required) ?? []
    const requiredMapped = requiredFields.every(f => mapping[f.key])

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Importação de Dados</h1>
                    <p className="text-sm text-surface-500">
                        Importe clientes, produtos, serviços e equipamentos via CSV
                    </p>
                </div>
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-4 py-2 text-sm font-medium hover:bg-surface-50"
                >
                    <History size={16} />
                    Histórico
                </button>
            </div>

            {/* Histórico */}
            {showHistory && (
                <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-semibold text-surface-900">Histórico de Importações</h3>
                        <button onClick={() => setShowHistory(false)}><X size={16} /></button>
                    </div>
                    <div className="space-y-2">
                        {(history ?? []).length === 0 && (
                            <p className="text-sm text-surface-500">Nenhuma importação realizada</p>
                        )}
                        {(history ?? []).map((h: any) => (
                            <div key={h.id} className="flex items-center justify-between rounded-lg bg-surface-50 p-3 text-sm">
                                <div>
                                    <span className="font-medium">{h.file_name}</span>
                                    <span className="ml-2 text-surface-500">{h.entity_type}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-emerald-600">+{h.inserted}</span>
                                    <span className="text-blue-600">↻{h.updated}</span>
                                    <span className="text-surface-400">⊘{h.skipped}</span>
                                    {h.errors > 0 && <span className="text-red-600">✕{h.errors}</span>}
                                    <span className="text-surface-400 text-xs">
                                        {new Date(h.created_at).toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
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
                    <div className="grid grid-cols-4 gap-3">
                        {entities.map(e => (
                            <button
                                key={e.key}
                                onClick={() => setEntity(e.key)}
                                className={cn(
                                    'rounded-xl border-2 p-4 text-center font-medium transition-all',
                                    entity === e.key
                                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                                        : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300'
                                )}
                            >
                                {e.label}
                            </button>
                        ))}
                    </div>

                    {/* Área de drop */}
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
                                    Arraste um arquivo CSV ou XLSX aqui
                                </p>
                                <p className="mb-4 text-sm text-surface-500">
                                    ou clique para selecionar
                                </p>
                                <label className="cursor-pointer rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
                                    Selecionar Arquivo
                                    <input
                                        type="file"
                                        accept=".csv,.txt,.xlsx"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                </label>
                            </>
                        )}
                    </div>

                    {uploadMutation.isError && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                            <AlertCircle size={16} className="mr-1 inline" />
                            Erro ao processar arquivo. Verifique o formato.
                        </div>
                    )}
                </div>
            )}

            {/* Step 1: Mapeamento */}
            {step === 1 && uploadData && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-surface-900">
                                    <FileSpreadsheet size={18} className="mr-2 inline text-brand-500" />
                                    {uploadData.file_name}
                                </h3>
                                <p className="text-sm text-surface-500">
                                    {uploadData.total_rows} linhas • Encoding: {uploadData.encoding} • Separador: {uploadData.separator === 'tab' ? 'TAB' : uploadData.separator}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                {(templates ?? []).length > 0 && (
                                    <select
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                            const t = templates?.find((t: any) => t.id === +e.target.value)
                                            if (t) applyTemplate(t)
                                        }}
                                        className="rounded-lg border border-surface-200 px-3 py-1.5 text-sm"
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Aplicar template...</option>
                                        {(templates ?? []).map((t: any) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
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
                                                : 'border-surface-200 bg-white'
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
                            <span className="text-sm text-surface-500">
                                {mappedCount} de {uploadData.available_fields.length} campos mapeados
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        const name = prompt('Nome do template:')
                                        if (name) saveTemplateMutation.mutate(name)
                                    }}
                                    className="flex items-center gap-1 rounded-lg border border-surface-200 px-3 py-1.5 text-sm hover:bg-surface-50"
                                >
                                    <Save size={14} />
                                    Salvar Template
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Estratégia de duplicatas */}
                    <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
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
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
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
                    <div className="overflow-auto rounded-xl border border-surface-200 bg-white shadow-card">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-surface-200 bg-surface-50">
                                    <th className="px-3 py-2 text-left font-semibold text-surface-600">Linha</th>
                                    <th className="px-3 py-2 text-left font-semibold text-surface-600">Status</th>
                                    {Object.keys(mapping).filter(k => mapping[k]).map(k => (
                                        <th key={k} className="px-3 py-2 text-left font-semibold text-surface-600">{k}</th>
                                    ))}
                                    <th className="px-3 py-2 text-left font-semibold text-surface-600">Mensagens</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                                {previewRows.map(row => (
                                    <tr key={row.line} className={cn(
                                        'transition-colors',
                                        row.status === 'error' && 'bg-red-50/50',
                                        row.status === 'warning' && 'bg-amber-50/50',
                                    )}>
                                        <td className="px-3 py-2 text-surface-500">{row.line}</td>
                                        <td className="px-3 py-2">
                                            {row.status === 'valid' && <CheckCircle2 size={16} className="text-emerald-500" />}
                                            {row.status === 'warning' && <AlertTriangle size={16} className="text-amber-500" />}
                                            {row.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
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
                            onClick={() => executeMutation.mutate()}
                            disabled={executeMutation.isPending}
                            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {executeMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            Importar {uploadData?.total_rows} linhas
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Resultado */}
            {step === 3 && result && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
                        <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-500" />
                        <h2 className="text-xl font-bold text-emerald-800">Importação Concluída!</h2>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                        <div className="rounded-xl border border-surface-200 bg-white p-5 text-center shadow-card">
                            <p className="text-3xl font-bold text-surface-900">{result.total_rows}</p>
                            <p className="text-xs text-surface-500">Total</p>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-5 text-center shadow-card">
                            <p className="text-3xl font-bold text-emerald-600">{result.inserted}</p>
                            <p className="text-xs text-surface-500">Inseridos</p>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-5 text-center shadow-card">
                            <p className="text-3xl font-bold text-blue-600">{result.updated}</p>
                            <p className="text-xs text-surface-500">Atualizados</p>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-5 text-center shadow-card">
                            <p className="text-3xl font-bold text-red-600">{result.errors}</p>
                            <p className="text-xs text-surface-500">Erros</p>
                        </div>
                    </div>

                    {result.error_log?.length > 0 && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
                            <h3 className="mb-3 font-semibold text-red-800">Erros encontrados</h3>
                            <div className="max-h-60 space-y-1 overflow-auto text-sm">
                                {result.error_log.map((e: any, i: number) => (
                                    <div key={i} className="rounded bg-white p-2">
                                        <span className="font-medium text-red-700">Linha {e.line}:</span>{' '}
                                        <span className="text-surface-700">{e.message}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-center">
                        <button onClick={reset} className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
                            Nova Importação
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
