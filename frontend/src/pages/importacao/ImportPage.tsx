import React, { useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check,
    AlertCircle, CheckCircle2, AlertTriangle, Loader2,
    History, Save, X, Download, Trash2, Undo2
} from 'lucide-react'
import api from '@/lib/api'
import { IMPORT_ROW_STATUS } from '@/lib/constants'
import { cn } from '@/lib/utils'



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

    const queryClient = useQueryClient()

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
        onError: () => {
            setErrorMessage('Erro ao processar arquivo. Verifique o formato e tente novamente.')
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
        onError: () => {
            setErrorMessage('Erro ao validar preview. Verifique o mapeamento e tente novamente.')
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
        }).then(r => r.data as ImportResult),
        onSuccess: (data) => {
            setResult(data)
            setErrorMessage(null)
            setStep(3)
            queryClient.invalidateQueries({ queryKey: ['import-history'] })
        },
        onError: () => {
            setErrorMessage('Erro ao executar importação. Tente novamente.')
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
            setSuccessMessage('Template salvo com sucesso!')
            queryClient.invalidateQueries({ queryKey: ['import-templates'] })
            setTimeout(() => setSuccessMessage(null), 3000)
        },
        onError: () => {
            setErrorMessage('Erro ao salvar template.')
        },
    })

    // Delete template
    const deleteTemplateMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/import/templates/${id}`),
        onSuccess: () => {
            setSuccessMessage('Template removido!')
            queryClient.invalidateQueries({ queryKey: ['import-templates'] })
            setTimeout(() => setSuccessMessage(null), 3000)
        },
        onError: () => {
            setErrorMessage('Erro ao remover template.')
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
            setErrorMessage(err?.response?.data?.message || 'Erro ao desfazer importação.')
        },
    })

    const downloadSampleCsv = async () => {
        try {
            const response = await api.get(`/import/sample/${entity}`, { responseType: 'blob' })
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.download = `modelo_importacao_${entity}.csv`
            link.click()
            window.URL.revokeObjectURL(url)
        } catch {
            setErrorMessage('Erro ao baixar modelo.')
        }
    }

    const downloadErrorCsv = async (importId: number) => {
        try {
            const response = await api.get(`/import/${importId}/errors`, { responseType: 'blob' })
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.download = `erros_importacao_${importId}.csv`
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
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Importação de Dados</h1>
                    <p className="text-[13px] text-surface-500">
                        Importe clientes, produtos, serviços, equipamentos e fornecedores via CSV
                    </p>
                </div>
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 rounded-lg border border-default bg-surface-0 px-4 py-2 text-sm font-medium hover:bg-surface-50"
                >
                    <History size={16} />
                    Histórico
                </button>
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
                        <h3 className="font-semibold text-surface-900">Histórico de Importações</h3>
                        <button onClick={() => setShowHistory(false)}><X size={16} /></button>
                    </div>
                    <div className="space-y-2">
                        {(history ?? []).length === 0 && (
                            <p className="text-[13px] text-surface-500">Nenhuma importação realizada</p>
                        )}
                        {(history ?? []).map((h: { id: number; file_name: string; entity_type: string; status: string; inserted: number; updated: number; skipped: number; errors: number; created_at: string }) => (
                            <div key={h.id} className="flex items-center justify-between rounded-lg bg-surface-50 p-3 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{h.file_name}</span>
                                    <span className="text-surface-500">
                                        {entities.find(e => e.key === h.entity_type)?.label ?? h.entity_type}
                                    </span>
                                    <span className={cn(
                                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                        h.status === 'done' && 'bg-emerald-100 text-emerald-700',
                                        h.status === 'failed' && 'bg-red-100 text-red-700',
                                        h.status === 'processing' && 'bg-blue-100 text-blue-700',
                                        h.status === 'pending' && 'bg-surface-200 text-surface-600',
                                    )}>
                                        {h.status === 'done' ? 'Concluído' : h.status === 'failed' ? 'Falhou' : h.status === 'processing' ? 'Processando' : 'Pendente'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-emerald-600">+{h.inserted}</span>
                                    <span className="text-blue-600">↻{h.updated}</span>
                                    <span className="text-surface-400">⊘{h.skipped}</span>
                                    {h.errors > 0 && <span className="text-red-600">✕{h.errors}</span>}
                                    <span className="text-surface-400 text-xs">
                                        {new Date(h.created_at).toLocaleDateString('pt-BR')}
                                    </span>
                                    {h.errors > 0 && (
                                        <button
                                            onClick={() => downloadErrorCsv(h.id)}
                                            title="Exportar erros"
                                            className="rounded p-1 text-red-500 hover:bg-red-50"
                                        >
                                            <Download size={14} />
                                        </button>
                                    )}
                                    {h.status === 'done' && (
                                        <button
                                            onClick={() => {
                                                if (window.confirm('Tem certeza que deseja desfazer esta importação? Os registros importados serão excluídos.')) {
                                                    rollbackMutation.mutate(h.id)
                                                }
                                            }}
                                            disabled={rollbackMutation.isPending}
                                            title="Desfazer importação"
                                            className="rounded p-1 text-amber-600 hover:bg-amber-50 disabled:opacity-50"
                                        >
                                            <Undo2 size={14} />
                                        </button>
                                    )}
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
                        <button
                            onClick={downloadSampleCsv}
                            className="ml-4 flex shrink-0 items-center gap-2 rounded-lg border border-blue-300 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                            <Download size={16} />
                            Baixar Modelo CSV
                        </button>
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
                                                    if (tplToDelete && window.confirm(`Remover template "${tplToDelete.name}"?`)) {
                                                        deleteTemplateMutation.mutate(selectedTemplateId)
                                                        setSelectedTemplateId(null)
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
                                    <div key={i} className="rounded bg-white p-2">
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
    )
}
