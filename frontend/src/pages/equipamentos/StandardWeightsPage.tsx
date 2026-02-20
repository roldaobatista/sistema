import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Search, Plus, Scale, AlertTriangle, CheckCircle2,
    Filter, Eye, Edit, Trash2, Download, XCircle, Clock
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/pageheader'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'

interface StandardWeight {
    id: number
    code: string
    nominal_value: string
    unit: string
    serial_number: string | null
    manufacturer: string | null
    precision_class: string
    material: string | null
    shape: string | null
    certificate_number: string | null
    certificate_date: string | null
    certificate_expiry: string | null
    laboratory: string | null
    status: string
    status_label: string
    display_name: string
    notes: string | null
    created_at: string
}

interface Constants {
    statuses: Record<string, string | { label: string; color: string }>
    precision_classes: Record<string, string>
    units: string[]
    shapes: Record<string, string>
}

const statusColors: Record<string, string> = {
    ativo: 'bg-emerald-100 text-emerald-700',
    em_calibracao: 'bg-blue-100 text-blue-700',
    fora_de_uso: 'bg-red-100 text-red-700',
    descartado: 'bg-surface-200 text-surface-600',
}

function fmtDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('pt-BR')
}

function certBadge(expiry: string | null) {
    if (!expiry) return null
    const diff = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000)
    if (diff < 0) return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600"><XCircle className="h-3 w-3" /> Vencido</span>
    if (diff <= 30) return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600"><AlertTriangle className="h-3 w-3" /> {diff}d</span>
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600"><CheckCircle2 className="h-3 w-3" /> OK</span>
}

export default function StandardWeightsPage() {
    const queryClient = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const canCreate = hasRole('super_admin') || hasPermission('equipments.standard_weight.create')
    const canUpdate = hasRole('super_admin') || hasPermission('equipments.standard_weight.update')
    const canDelete = hasRole('super_admin') || hasPermission('equipments.standard_weight.delete')

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [page, setPage] = useState(1)
    const [showModal, setShowModal] = useState(false)
    const [editingWeight, setEditingWeight] = useState<StandardWeight | null>(null)
    const [showDetail, setShowDetail] = useState<StandardWeight | null>(null)

    const emptyForm = {
        nominal_value: '', unit: 'kg', serial_number: '', manufacturer: '',
        precision_class: 'M1', material: '', shape: 'cilindrico',
        certificate_number: '', certificate_date: '', certificate_expiry: '',
        laboratory: '', status: 'ativo', notes: '',
    }
    const [form, setForm] = useState(emptyForm)

    const { data: constants } = useQuery<Constants>({
        queryKey: ['standard-weights-constants'],
        queryFn: () => api.get('/standard-weights/constants').then(r => r.data),
    })

    const { data, isLoading } = useQuery({
        queryKey: ['standard-weights', search, statusFilter, page],
        queryFn: () => api.get('/standard-weights', {
            params: { search, status: statusFilter || undefined, page, per_page: 20 }
        }).then(r => r.data),
    })

    const { data: expiringData } = useQuery({
        queryKey: ['standard-weights-expiring'],
        queryFn: () => api.get('/standard-weights/expiring', { params: { days: 30 } }).then(r => r.data),
    })

    const saveMutation = useMutation({
        mutationFn: (payload: typeof form) => {
            if (editingWeight) {
                return api.put(`/standard-weights/${editingWeight.id}`, payload)
            }
            return api.post('/standard-weights', payload)
        },
        onSuccess: () => {
            toast.success(editingWeight ? 'Peso padrão atualizado!' : 'Peso padrão criado!')
            queryClient.invalidateQueries({ queryKey: ['standard-weights'] })
            setShowModal(false)
            setEditingWeight(null)
            setForm(emptyForm)
        },
        onError: (err: any) => {
            if (err.response?.status === 422) {
                const errors = Object.values(err.response.data.errors || {}).flat().join(', ')
                toast.error(errors || 'Erro de validação')
            } else {
                toast.error(err.response?.data?.message || 'Erro ao salvar')
            }
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/standard-weights/${id}`),
        onSuccess: () => {
            toast.success('Peso padrão removido!')
            queryClient.invalidateQueries({ queryKey: ['standard-weights'] })
        },
        onError: (err: any) => {
            if (err.response?.status === 409) {
                toast.error('Este peso está vinculado a calibrações e não pode ser excluído.')
            } else {
                toast.error(err.response?.data?.message || 'Erro ao excluir')
            }
        },
    })

    const openCreate = () => {
        setEditingWeight(null)
        setForm(emptyForm)
        setShowModal(true)
    }

    const openEdit = (w: StandardWeight) => {
        setEditingWeight(w)
        setForm({
            nominal_value: w.nominal_value,
            unit: w.unit,
            serial_number: w.serial_number ?? '',
            manufacturer: w.manufacturer ?? '',
            precision_class: w.precision_class,
            material: w.material ?? '',
            shape: w.shape ?? 'cilindrico',
            certificate_number: w.certificate_number ?? '',
            certificate_date: w.certificate_date?.substring(0, 10) ?? '',
            certificate_expiry: w.certificate_expiry?.substring(0, 10) ?? '',
            laboratory: w.laboratory ?? '',
            status: w.status,
            notes: w.notes ?? '',
        })
        setShowModal(true)
    }

    const handleDelete = (w: StandardWeight) => {
        if (!confirm(`Deseja excluir o peso padrão ${w.code}?`)) return
        deleteMutation.mutate(w.id)
    }

    const handleExport = async () => {
        try {
            const res = await api.get('/standard-weights/export', { responseType: 'blob' })
            const url = URL.createObjectURL(res.data)
            const a = document.createElement('a')
            a.href = url
            a.download = `pesos-padrão-${new Date().toISOString().split('T')[0]}.csv`
            a.click()
            URL.revokeObjectURL(url)
            toast.success('Exportação concluída!')
        } catch {
            toast.error('Erro ao exportar')
        }
    }

    const weights: StandardWeight[] = data?.data ?? []
    const total = data?.total ?? 0
    const lastPage = data?.last_page ?? 1

    return (
        <div className="space-y-4">
            <PageHeader
                title="Pesos Padrão"
                subtitle={`${total} registro${total !== 1 ? 's' : ''}`}
                icon={Scale}
                actions={
                    <div className="flex items-center gap-2">
                        <button onClick={handleExport} className="btn-ghost text-xs gap-1.5">
                            <Download className="h-3.5 w-3.5" /> CSV
                        </button>
                        {canCreate && (
                            <button onClick={openCreate} className="btn-primary text-xs gap-1.5">
                                <Plus className="h-3.5 w-3.5" /> Novo Peso
                            </button>
                        )}
                    </div>
                }
            />

            {/* KPI Cards */}
            {expiringData && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-default bg-surface-0 p-3">
                        <div className="flex items-center gap-2 text-surface-500 text-xs mb-1">
                            <Scale className="h-3.5 w-3.5" /> Total
                        </div>
                        <div className="text-xl font-bold text-surface-900">{total}</div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <div className="flex items-center gap-2 text-amber-600 text-xs mb-1">
                            <AlertTriangle className="h-3.5 w-3.5" /> Vencendo (30d)
                        </div>
                        <div className="text-xl font-bold text-amber-700">{expiringData.expiring_count ?? 0}</div>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <div className="flex items-center gap-2 text-red-600 text-xs mb-1">
                            <XCircle className="h-3.5 w-3.5" /> Vencidos
                        </div>
                        <div className="text-xl font-bold text-red-700">{expiringData.expired_count ?? 0}</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1) }}
                        placeholder="Buscar por código, número de série..."
                        className="w-full rounded-md border border-default bg-surface-0 pl-8 pr-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
                    className="rounded-md border border-default bg-surface-0 px-3 py-1.5 text-sm"
                >
                    <option value="">Todos os status</option>
                    {constants && Object.entries(constants.statuses).map(([k, v]) => (
                        <option key={k} value={k}>{typeof v === 'object' && v !== null ? v.label : v}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-default bg-surface-0 overflow-hidden">
                {isLoading ? (
                    <div className="p-8 flex justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                    </div>
                ) : weights.length === 0 ? (
                    <div className="p-8 text-center text-surface-400">
                        <Scale className="mx-auto h-10 w-10 mb-2 opacity-40" />
                        <p className="text-sm font-medium">Nenhum peso padrão encontrado</p>
                        <p className="text-xs mt-1">Cadastre um peso para começar</p>
                        {canCreate && (
                            <button onClick={openCreate} className="btn-primary text-xs mt-3 gap-1.5">
                                <Plus className="h-3.5 w-3.5" /> Cadastrar Peso
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-default bg-surface-50 text-surface-500 text-xs">
                                    <th className="px-3 py-2 text-left font-medium">Código</th>
                                    <th className="px-3 py-2 text-left font-medium">Valor Nominal</th>
                                    <th className="px-3 py-2 text-left font-medium">Classe</th>
                                    <th className="px-3 py-2 text-left font-medium">Nº Série</th>
                                    <th className="px-3 py-2 text-left font-medium">Certificado</th>
                                    <th className="px-3 py-2 text-left font-medium">Validade</th>
                                    <th className="px-3 py-2 text-left font-medium">Status</th>
                                    <th className="px-3 py-2 text-right font-medium">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-default">
                                {weights.map(w => (
                                    <tr key={w.id} className="hover:bg-surface-50 transition-colors">
                                        <td className="px-3 py-2 font-mono text-xs font-medium text-brand-600">{w.code}</td>
                                        <td className="px-3 py-2">{Number(w.nominal_value).toLocaleString('pt-BR')} {w.unit}</td>
                                        <td className="px-3 py-2 text-xs">
                                            <span className="rounded-md bg-surface-100 px-1.5 py-0.5 font-mono">{w.precision_class}</span>
                                        </td>
                                        <td className="px-3 py-2 text-surface-500">{w.serial_number ?? '—'}</td>
                                        <td className="px-3 py-2 text-xs text-surface-500">{w.certificate_number ?? '—'}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs text-surface-500">{fmtDate(w.certificate_expiry)}</span>
                                                {certBadge(w.certificate_expiry)}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', statusColors[w.status] ?? 'bg-surface-100 text-surface-600')}>
                                                {w.status_label ?? w.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => setShowDetail(w)} className="rounded-md p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600" title="Detalhes">
                                                    <Eye className="h-3.5 w-3.5" />
                                                </button>
                                                {canUpdate && (
                                                    <button onClick={() => openEdit(w)} className="rounded-md p-1 text-surface-400 hover:bg-surface-100 hover:text-blue-600" title="Editar">
                                                        <Edit className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button onClick={() => handleDelete(w)} className="rounded-md p-1 text-surface-400 hover:bg-red-50 hover:text-red-600" title="Excluir">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {lastPage > 1 && (
                    <div className="flex items-center justify-between border-t border-default px-3 py-2">
                        <span className="text-xs text-surface-500">Página {page} de {lastPage}</span>
                        <div className="flex gap-1">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded px-2 py-1 text-xs border border-default disabled:opacity-30">Anterior</button>
                            <button disabled={page >= lastPage} onClick={() => setPage(p => p + 1)} className="rounded px-2 py-1 text-xs border border-default disabled:opacity-30">Próxima</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="w-full max-w-lg rounded-xl bg-surface-0 shadow-xl border border-default max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-default px-4 py-3">
                            <h3 className="text-sm font-semibold text-surface-900">{editingWeight ? 'Editar Peso Padrão' : 'Novo Peso Padrão'}</h3>
                            <button onClick={() => { setShowModal(false); setEditingWeight(null) }} className="text-surface-400 hover:text-surface-600">✕</button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form) }} className="p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-surface-600 mb-1">Valor Nominal *</label>
                                    <input type="number" step="any" required value={form.nominal_value} onChange={e => setForm({ ...form, nominal_value: e.target.value })} className="w-full rounded-md border border-default px-2.5 py-1.5 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-surface-600 mb-1">Unidade *</label>
                                    <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full rounded-md border border-default px-2.5 py-1.5 text-sm">
                                        {(constants?.units ?? ['kg', 'g', 'mg']).map(u => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-surface-600 mb-1">Nº Série</label>
                                    <input type="text" value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} className="w-full rounded-md border border-default px-2.5 py-1.5 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-surface-600 mb-1">Fabricante</label>
                                    <input type="text" value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} className="w-full rounded-md border border-default px-2.5 py-1.5 text-sm" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-surface-600 mb-1">Classe de Precisão</label>
                                    <select value={form.precision_class} onChange={e => setForm({ ...form, precision_class: e.target.value })} className="w-full rounded-md border border-default px-2.5 py-1.5 text-sm">
                                        {constants && Object.entries(constants.precision_classes).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-surface-600 mb-1">Material</label>
                                    <input type="text" value={form.material} onChange={e => setForm({ ...form, material: e.target.value })} className="w-full rounded-md border border-default px-2.5 py-1.5 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-surface-600 mb-1">Formato</label>
                                    <select value={form.shape} onChange={e => setForm({ ...form, shape: e.target.value })} className="w-full rounded-md border border-default px-2.5 py-1.5 text-sm">
                                        {constants && Object.entries(constants.shapes).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="border-t border-default pt-3">
                                <p className="text-xs font-semibold text-surface-600 mb-2">Certificado</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-surface-600 mb-1">Nº Certificado</label>
                                        <input type="text" value={form.certificate_number} onChange={e => setForm({ ...form, certificate_number: e.target.value })} className="w-full rounded-md border border-default px-2.5 py-1.5 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-surface-600 mb-1">Laboratório</label>
                                        <input type="text" value={form.laboratory} onChange={e => setForm({ ...form, laboratory: e.target.value })} className="w-full rounded-md border border-default px-2.5 py-1.5 text-sm" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <div>
                                        <label className="block text-xs font-medium text-surface-600 mb-1">Data Certificado</label>
                                        <input type="date" value={form.certificate_date} onChange={e => setForm({ ...form, certificate_date: e.target.value })} className="w-full rounded-md border border-default px-2.5 py-1.5 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-surface-600 mb-1">Validade</label>
                                        <input type="date" value={form.certificate_expiry} onChange={e => setForm({ ...form, certificate_expiry: e.target.value })} className="w-full rounded-md border border-default px-2.5 py-1.5 text-sm" />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-surface-600 mb-1">Status</label>
                                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-default px-2.5 py-1.5 text-sm">
                                        {constants && Object.entries(constants.statuses).map(([k, v]) => (
                                            <option key={k} value={k}>{typeof v === 'object' && v !== null ? v.label : v}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-surface-600 mb-1">Observações</label>
                                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-md border border-default px-2.5 py-1.5 text-sm resize-none" />
                            </div>
                            <div className="flex justify-end gap-2 border-t border-default pt-3">
                                <button type="button" onClick={() => { setShowModal(false); setEditingWeight(null) }} className="btn-ghost text-xs">Cancelar</button>
                                <button type="submit" disabled={saveMutation.isPending} className="btn-primary text-xs gap-1.5">
                                    {saveMutation.isPending ? (
                                        <><Clock className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
                                    ) : (
                                        <>{editingWeight ? 'Salvar' : 'Criar'}</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDetail(null)}>
                    <div className="w-full max-w-md rounded-xl bg-surface-0 shadow-xl border border-default" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-default px-4 py-3">
                            <h3 className="text-sm font-semibold text-surface-900">{showDetail.code} — Detalhes</h3>
                            <button onClick={() => setShowDetail(null)} className="text-surface-400 hover:text-surface-600">✕</button>
                        </div>
                        <div className="p-4 space-y-2 text-sm">
                            <div className="grid grid-cols-2 gap-2">
                                <div><span className="text-xs text-surface-400">Valor Nominal</span><p className="font-medium">{Number(showDetail.nominal_value).toLocaleString('pt-BR')} {showDetail.unit}</p></div>
                                <div><span className="text-xs text-surface-400">Classe</span><p className="font-medium">{showDetail.precision_class}</p></div>
                                <div><span className="text-xs text-surface-400">Nº Série</span><p className="font-medium">{showDetail.serial_number ?? '—'}</p></div>
                                <div><span className="text-xs text-surface-400">Fabricante</span><p className="font-medium">{showDetail.manufacturer ?? '—'}</p></div>
                                <div><span className="text-xs text-surface-400">Material</span><p className="font-medium">{showDetail.material ?? '—'}</p></div>
                                <div><span className="text-xs text-surface-400">Formato</span><p className="font-medium">{showDetail.shape ?? '—'}</p></div>
                            </div>
                            <div className="border-t border-default pt-2 mt-2">
                                <p className="text-xs font-semibold text-surface-500 mb-1">Certificado</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><span className="text-xs text-surface-400">Número</span><p className="font-medium">{showDetail.certificate_number ?? '—'}</p></div>
                                    <div><span className="text-xs text-surface-400">Laboratório</span><p className="font-medium">{showDetail.laboratory ?? '—'}</p></div>
                                    <div><span className="text-xs text-surface-400">Data</span><p className="font-medium">{fmtDate(showDetail.certificate_date)}</p></div>
                                    <div>
                                        <span className="text-xs text-surface-400">Validade</span>
                                        <p className="font-medium flex items-center gap-1.5">{fmtDate(showDetail.certificate_expiry)} {certBadge(showDetail.certificate_expiry)}</p>
                                    </div>
                                </div>
                            </div>
                            {showDetail.notes && (
                                <div className="border-t border-default pt-2 mt-2">
                                    <span className="text-xs text-surface-400">Observações</span>
                                    <p className="text-surface-600">{showDetail.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
