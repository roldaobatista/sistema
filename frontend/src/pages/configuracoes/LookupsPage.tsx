import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/iconbutton'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { Badge } from '@/components/ui/badge'

const LOOKUP_TYPES = [
    { key: 'equipment-categories', label: 'Categorias de Equipamento' },
    { key: 'customer-segments', label: 'Segmentos de Cliente' },
    { key: 'lead-sources', label: 'Origens de Lead' },
    { key: 'contract-types', label: 'Tipos de Contrato' },
    { key: 'measurement-units', label: 'Unidades de Medida' },
    { key: 'calibration-types', label: 'Tipos de Calibração' },
    { key: 'maintenance-types', label: 'Tipos de Manutenção' },
    { key: 'document-types', label: 'Tipos de Documento' },
    { key: 'account-receivable-categories', label: 'Categorias a Receber' },
    { key: 'cancellation-reasons', label: 'Motivos de Cancelamento' },
] as const

type LookupType = (typeof LOOKUP_TYPES)[number]['key']

interface LookupItem {
    id: number
    name: string
    slug?: string
    description?: string | null
    color?: string | null
    icon?: string | null
    is_active: boolean
    sort_order?: number
    abbreviation?: string | null
    unit_type?: string | null
    applies_to?: string[] | null
}

interface ApiErrorLike {
    response?: {
        status?: number
        data?: { message?: string; errors?: Record<string, string[]> }
    }
}

const PRESET_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#64748b',
]

const APPLIES_TO_OPTIONS = [
    { value: 'os', label: 'Ordem de Serviço' },
    { value: 'chamado', label: 'Chamado' },
    { value: 'orcamento', label: 'Orçamento' },
]

export function LookupsPage() {
    const [activeType, setActiveType] = useState<LookupType>('equipment-categories')
    return (
        <div className="space-y-5">
            <PageHeader
                title="Cadastros Auxiliares"
                subtitle="Tipos, categorias e demais listas utilizadas no sistema"
            />
            <div className="flex flex-wrap gap-2 border-b border-subtle pb-3">
                {LOOKUP_TYPES.map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setActiveType(key)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            activeType === key
                                ? 'bg-brand-600 text-white'
                                : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <LookupTab type={activeType} />
        </div>
    )
}

function LookupTab({ type }: { type: LookupType }) {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const canCreate = hasRole('super_admin') || hasPermission('lookups.create')
    const canUpdate = hasRole('super_admin') || hasPermission('lookups.update')
    const canDelete = hasRole('super_admin') || hasPermission('lookups.delete')

    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<LookupItem | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<LookupItem | null>(null)
    const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})

    const defaultForm: Record<string, unknown> = {
        name: '',
        description: '',
        color: '#3b82f6',
        icon: '',
        is_active: true,
        sort_order: 0,
        abbreviation: '',
        unit_type: '',
        applies_to: [],
    }
    const [form, setForm] = useState(defaultForm)

    const query = useQuery({
        queryKey: ['lookups', type],
        queryFn: async () => {
            const { data } = await api.get<LookupItem[]>(`/lookups/${type}`)
            return data
        },
    })
    const items = query.data ?? []

    const saveMut = useMutation({
        mutationFn: async () => {
            const payload: Record<string, unknown> = {
                name: String(form.name).trim(),
                description: (form.description as string)?.trim() || null,
                color: (form.color as string) || null,
                icon: (form.icon as string)?.trim() || null,
                is_active: !!form.is_active,
                sort_order: Number(form.sort_order) || 0,
            }
            if (type === 'measurement-units') {
                payload.abbreviation = (form.abbreviation as string)?.trim() || null
                payload.unit_type = (form.unit_type as string)?.trim() || null
            }
            if (type === 'cancellation-reasons') {
                payload.applies_to = Array.isArray(form.applies_to) ? form.applies_to : []
            }
            if (editing) {
                await api.put(`/lookups/${type}/${editing.id}`, payload)
                return
            }
            await api.post(`/lookups/${type}`, payload)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['lookups', type] })
            resetForm()
            toast.success(editing ? 'Registro atualizado' : 'Registro criado')
        },
        onError: (error: unknown) => {
            const status = (error as ApiErrorLike)?.response?.status
            const payload = (error as ApiErrorLike)?.response?.data
            if (status === 422 && payload?.errors) {
                setFormErrors(payload.errors)
                toast.error(payload.message ?? 'Verifique os campos')
                return
            }
            if (status === 403) toast.error('Sem permissão para esta ação')
            else toast.error((payload?.message as string) ?? 'Erro ao salvar')
        },
    })

    const deleteMut = useMutation({
        mutationFn: async (id: number) => api.delete(`/lookups/${type}/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['lookups', type] })
            setDeleteTarget(null)
            toast.success('Registro excluído')
        },
        onError: (error: unknown) => {
            const status = (error as ApiErrorLike)?.response?.status
            const message = (error as ApiErrorLike)?.response?.data?.message
            if (status === 403) toast.error('Sem permissão para excluir')
            else toast.error((message as string) ?? 'Erro ao excluir')
        },
    })

    const resetForm = () => {
        setShowForm(false)
        setEditing(null)
        setForm(defaultForm)
        setFormErrors({})
    }

    const setFormField = <K extends string>(key: K, value: unknown) => {
        setForm((prev) => ({ ...prev, [key]: value }))
        if (formErrors[key]) {
            setFormErrors((prev) => {
                const next = { ...prev }
                delete next[key]
                return next
            })
        }
    }

    const openCreate = () => {
        if (!canCreate) {
            toast.error('Sem permissão para criar')
            return
        }
        setEditing(null)
        setForm(defaultForm)
        setFormErrors({})
        setShowForm(true)
    }

    const openEdit = (item: LookupItem) => {
        if (!canUpdate) {
            toast.error('Sem permissão para editar')
            return
        }
        setEditing(item)
        setForm({
            name: item.name,
            description: item.description ?? '',
            color: item.color ?? '#3b82f6',
            icon: item.icon ?? '',
            is_active: item.is_active,
            sort_order: item.sort_order ?? 0,
            abbreviation: item.abbreviation ?? '',
            unit_type: item.unit_type ?? '',
            applies_to: item.applies_to ?? [],
        })
        setFormErrors({})
        setShowForm(true)
    }

    const openDelete = (item: LookupItem) => {
        if (!canDelete) {
            toast.error('Sem permissão para excluir')
            return
        }
        setDeleteTarget(item)
    }

    const label = LOOKUP_TYPES.find((t) => t.key === type)?.label ?? type

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-sm text-surface-600">{label}</span>
                {canCreate && (
                    <Button size="sm" onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
                        Novo
                    </Button>
                )}
            </div>

            {query.isLoading ? (
                <div className="py-12 text-center text-sm text-surface-500">Carregando...</div>
            ) : query.isError ? (
                <div className="py-12 text-center text-sm text-red-600">
                    Erro ao carregar. <button type="button" className="underline" onClick={() => query.refetch()}>Tentar novamente</button>
                </div>
            ) : items.length === 0 ? (
                <EmptyState
                    message="Nenhum registro cadastrado"
                    action={canCreate ? { label: 'Novo', onClick: openCreate, icon: <Plus className="h-4 w-4" /> } : undefined}
                />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-xl border border-default bg-surface-0 p-4 shadow-card"
                        >
                            <div
                                className="h-10 w-10 shrink-0 rounded-lg"
                                style={{ backgroundColor: item.color ?? '#e2e8f0' }}
                            />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-surface-900">{item.name}</p>
                                {type === 'measurement-units' && item.abbreviation && (
                                    <p className="text-xs text-surface-500">{item.abbreviation}</p>
                                )}
                                {item.description && (
                                    <p className="truncate text-xs text-surface-500">{item.description}</p>
                                )}
                                {!item.is_active && (
                                    <Badge variant="secondary" className="mt-1">Inativo</Badge>
                                )}
                            </div>
                            <div className="flex gap-1">
                                {canUpdate && (
                                    <IconButton label="Editar" icon={<Edit className="h-3.5 w-3.5" />} onClick={() => openEdit(item)} className="hover:text-brand-600" />
                                )}
                                {canDelete && (
                                    <IconButton label="Excluir" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => openDelete(item)} className="hover:text-red-600" />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal
                open={showForm}
                onOpenChange={(open) => {
                    setShowForm(open)
                    if (!open) resetForm()
                }}
                title={editing ? 'Editar' : 'Novo'}
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        saveMut.mutate()
                    }}
                    className="space-y-4"
                >
                    <Input
                        label="Nome *"
                        value={String(form.name)}
                        onChange={(e) => setFormField('name', e.target.value)}
                        error={formErrors.name?.[0]}
                        required
                    />
                    <Input
                        label="Descrição"
                        value={String(form.description)}
                        onChange={(e) => setFormField('description', e.target.value)}
                        error={formErrors.description?.[0]}
                    />
                    <div>
                        <label className="mb-2 block text-sm font-medium text-surface-700">Cor</label>
                        <div className="flex flex-wrap gap-2">
                            {PRESET_COLORS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    title={color}
                                    aria-label={`Cor ${color}`}
                                    onClick={() => setFormField('color', color)}
                                    className={`h-8 w-8 rounded-full border-2 transition-transform ${
                                        form.color === color ? 'scale-110 border-surface-900' : 'border-transparent'
                                    }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>
                    {type === 'measurement-units' && (
                        <>
                            <Input
                                label="Sigla"
                                value={String(form.abbreviation)}
                                onChange={(e) => setFormField('abbreviation', e.target.value)}
                                error={formErrors.abbreviation?.[0]}
                            />
                            <Input
                                label="Tipo (peso, comprimento, volume, etc.)"
                                value={String(form.unit_type)}
                                onChange={(e) => setFormField('unit_type', e.target.value)}
                                error={formErrors.unit_type?.[0]}
                            />
                        </>
                    )}
                    {type === 'cancellation-reasons' && (
                        <div>
                            <label className="mb-2 block text-sm font-medium text-surface-700">Aplica-se a</label>
                            <div className="flex flex-wrap gap-2">
                                {APPLIES_TO_OPTIONS.map((opt) => {
                                    const list = (form.applies_to as string[]) ?? []
                                    const checked = list.includes(opt.value)
                                    return (
                                        <label key={opt.value} className="flex items-center gap-2 rounded border border-subtle px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                    const next = checked
                                                        ? list.filter((x) => x !== opt.value)
                                                        : [...list, opt.value]
                                                    setFormField('applies_to', next)
                                                }}
                                            />
                                            <span className="text-sm">{opt.label}</span>
                                        </label>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={!!form.is_active}
                            onChange={(e) => setFormField('is_active', e.target.checked)}
                        />
                        <label htmlFor="is_active" className="text-sm text-surface-700">Ativo</label>
                    </div>
                    <div className="flex justify-end gap-3 border-t border-subtle pt-4">
                        <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending} disabled={!String(form.name).trim()}>
                            Salvar
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Excluir">
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">
                        Tem certeza que deseja excluir &quot;{deleteTarget?.name}&quot;?
                    </p>
                    <div className="flex justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button
                            variant="danger"
                            loading={deleteMut.isPending}
                            onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
                        >
                            Excluir
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
