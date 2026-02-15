import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Download, Printer, FileSpreadsheet, Loader2, CheckSquare, Square, Package, Users, Wrench, HardDrive, ClipboardList, FileText } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

interface ExportEntity {
    key: string
    label: string
    fields: string[]
    count: number
}

const ENTITY_ICONS: Record<string, React.ReactNode> = {
    customers: <Users className="w-5 h-5" />,
    products: <Package className="w-5 h-5" />,
    services: <Wrench className="w-5 h-5" />,
    equipments: <HardDrive className="w-5 h-5" />,
    work_orders: <ClipboardList className="w-5 h-5" />,
    quotes: <FileText className="w-5 h-5" />,
}

export function BatchExportPage() {
  const { hasPermission } = useAuthStore()

    const [selectedEntity, setSelectedEntity] = useState<string>('')
    const [selectedFields, setSelectedFields] = useState<string[]>([])

    const { data: entities, isLoading } = useQuery<ExportEntity[]>({
        queryKey: ['batch-export-entities'],
        const { data, isLoading, isError } = useQuery({
        queryFn: async () => {
            const res = await api.get('/batch-export/entities')
            return res.data.data
        },
    })

    const exportMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post('/batch-export/csv', {
                entity: selectedEntity,
                fields: selectedFields.length > 0 ? selectedFields : undefined,
            }, { responseType: 'blob' })
            const url = window.URL.createObjectURL(new Blob([res.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `${selectedEntity}_export.csv`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
        },
    onSuccess: () => { toast.success('Operação realizada com sucesso') },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro na operação') }
  })

    const currentEntity = entities?.find(e => e.key === selectedEntity)

    const toggleField = (field: string) => {
        setSelectedFields(prev =>
            prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
        )
    }

    const toggleAllFields = () => {
        if (!currentEntity) return
        if (selectedFields.length === currentEntity.fields.length) {
            setSelectedFields([])
        } else {
            setSelectedFields([...currentEntity.fields])
        }
    }

    const handleSelectEntity = (key: string) => {
        setSelectedEntity(key)
        const entity = entities?.find(e => e.key === key)
        setSelectedFields(entity ? [...entity.fields] : [])
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Exportação em Lote</h1>
                    <p className="text-[13px] text-surface-500 mt-1">Exporte dados do sistema em arquivo CSV</p>
                </div>
                <button
                    onClick={() => exportMutation.mutate()}
                    disabled={!selectedEntity || exportMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {exportMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Download className="w-4 h-4" />
                    )}
                    Exportar CSV
                </button>
            </div>

            {/* Entity Selection */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {isLoading ? (
                    <div className="col-span-full flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-surface-400" />
                    </div>
                ) : (
                    entities?.map(entity => (
                        <button
                            key={entity.key}
                            onClick={() => handleSelectEntity(entity.key)}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${selectedEntity === entity.key
                                ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                                : 'border-default bg-surface-0 text-surface-600 hover:border-surface-300'
                                }`}
                        >
                            {ENTITY_ICONS[entity.key] || <FileSpreadsheet className="w-5 h-5" />}
                            <span className="text-sm font-medium">{entity.label}</span>
                            <span className="text-xs text-surface-400">{entity.count} registros</span>
                        </button>
                    ))
                )}
            </div>

            {/* Field Selection */}
            {currentEntity && (
                <div className="bg-white rounded-xl border border-surface-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-surface-900">
                            Campos para exportar â€” {currentEntity.label}
                        </h2>
                        <button
                            onClick={toggleAllFields}
                            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                        >
                            {selectedFields.length === currentEntity.fields.length ? 'Desmarcar todos' : 'Selecionar todos'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {currentEntity.fields.map(field => (
                            <button
                                key={field}
                                onClick={() => toggleField(field)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${selectedFields.includes(field)
                                    ? 'bg-brand-50 text-brand-700 border border-brand-200'
                                    : 'bg-surface-50 text-surface-500 border border-surface-200 hover:bg-surface-100'
                                    }`}
                            >
                                {selectedFields.includes(field) ? (
                                    <CheckSquare className="w-4 h-4 text-brand-500" />
                                ) : (
                                    <Square className="w-4 h-4 text-surface-400" />
                                )}
                                {field}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Export Status */}
            {exportMutation.isSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                    <Download className="w-4 h-4" />
                    <span className="text-sm font-medium">Download do CSV iniciado com sucesso!</span>
                </div>
            )}
            {exportMutation.isError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
                    <Printer className="w-4 h-4" />
                    <span className="text-sm font-medium">Erro ao exportar. Tente novamente.</span>
                </div>
            )}
        </div>
    )
}