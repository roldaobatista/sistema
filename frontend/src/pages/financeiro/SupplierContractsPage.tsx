import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Truck, FileText, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { Modal } from '@/components/ui/modal'

const fmtBRL = (val: string | number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

const statusConfig: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'danger' | 'default' }> = {
    active: { label: 'Ativo', variant: 'success' },
    expired: { label: 'Expirado', variant: 'danger' },
    cancelled: { label: 'Cancelado', variant: 'default' },
}

const freqLabels: Record<string, string> = {
    monthly: 'Mensal', quarterly: 'Trimestral', annual: 'Anual', one_time: 'Único',
}

interface Contract {
    id: number; supplier_id: number; description: string; start_date: string; end_date: string
    value: string; payment_frequency: string; auto_renew: boolean; status: string; notes?: string
    supplier?: { id: number; name: string }
}

interface ContractForm {
    supplier_id: string; description: string; start_date: string; end_date: string
    value: string; payment_frequency: string; auto_renew: boolean; notes: string
}

export function SupplierContractsPage() {
    const qc = useQueryClient()
    const emptyForm: ContractForm = { supplier_id: '', description: '', start_date: '', end_date: '', value: '', payment_frequency: 'monthly', auto_renew: false, notes: '' }

    const [statusFilter, setStatusFilter] = useState('')
    const [page, setPage] = useState(1)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState<ContractForm>(emptyForm)
    const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})

    const { data: res, isLoading, isError, refetch } = useQuery({
        queryKey: ['supplier-contracts', statusFilter, page],
        queryFn: () => api.get('/financial/supplier-contracts', { params: { status: statusFilter || undefined, page } }),
    })
    const records: Contract[] = res?.data?.data ?? []
    const pagination = { currentPage: res?.data?.current_page ?? 1, lastPage: res?.data?.last_page ?? 1, total: res?.data?.total ?? 0 }

    const { data: suppRes } = useQuery({
        queryKey: ['suppliers-select'],
        queryFn: () => api.get('/suppliers', { params: { per_page: 100 } }),
        enabled: showForm,
    })
    const suppliers: { id: number; name: string }[] = suppRes?.data?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: ContractForm) => api.post('/financial/supplier-contracts', { ...data, supplier_id: Number(data.supplier_id), notes: data.notes.trim() || null }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['supplier-contracts'] })
            setShowForm(false); setForm(emptyForm); setFormErrors({})
            toast.success('Contrato criado com sucesso')
        },
        onError: (error: unknown) => {
            const payload = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
            if (payload?.errors) { setFormErrors(payload.errors); toast.error(payload.message ?? 'Verifique os campos'); return }
            toast.error(payload?.message ?? 'Erro ao criar contrato')
        },
    })

    const set = <K extends keyof ContractForm>(k: K, v: ContractForm[K]) => {
        setForm(p => ({ ...p, [k]: v }))
        if (formErrors[k]) { setFormErrors(prev => { const n = { ...prev }; delete n[k]; return n }) }
    }

    return (
        <div className="space-y-5">
            <PageHeader
                title="Contratos de Fornecedor"
                subtitle="Contratos recorrentes com fornecedores"
                count={pagination.total}
                actions={[{ label: 'Novo Contrato', onClick: () => { setForm(emptyForm); setFormErrors({}); setShowForm(true) }, icon: <Plus className="h-4 w-4" /> }]}
            />

            <div className="flex gap-3">
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Status" className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="">Todos os status</option>
                    {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
            </div>

            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Descrição</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Fornecedor</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Vigência</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Frequência</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Status</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Valor</th>
                            <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase text-surface-600">Renova</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-surface-500">Carregando...</td></tr>
                        ) : isError ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-red-600">Erro ao carregar. <button className="underline" onClick={() => refetch()}>Tentar novamente</button></td></tr>
                        ) : records.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-2"><EmptyState icon={<FileText className="h-5 w-5 text-surface-300" />} message="Nenhum contrato encontrado" compact /></td></tr>
                        ) : records.map(r => (
                            <tr key={r.id} className="hover:bg-surface-50 transition-colors">
                                <td className="px-4 py-3 text-sm font-medium text-surface-900">{r.description}</td>
                                <td className="px-4 py-3 text-sm text-surface-600">{r.supplier?.name ?? '—'}</td>
                                <td className="px-4 py-3 text-sm text-surface-500">{fmtDate(r.start_date)} — {fmtDate(r.end_date)}</td>
                                <td className="px-4 py-3 text-sm text-surface-600">{freqLabels[r.payment_frequency] ?? r.payment_frequency}</td>
                                <td className="px-4 py-3"><Badge variant={statusConfig[r.status]?.variant}>{statusConfig[r.status]?.label ?? r.status}</Badge></td>
                                <td className="px-4 py-3 text-right text-sm font-semibold text-surface-900">{fmtBRL(r.value)}</td>
                                <td className="px-4 py-3 text-center">{r.auto_renew ? <RotateCcw className="h-4 w-4 text-emerald-500 mx-auto" /> : <span className="text-surface-300">—</span>}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {pagination.lastPage > 1 && (
                <div className="flex items-center justify-between rounded-xl border border-default bg-surface-0 px-4 py-3 shadow-card">
                    <span className="text-sm text-surface-500">{pagination.total} registro(s)</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled={pagination.currentPage <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                        <span className="text-sm text-surface-700">Página {pagination.currentPage} de {pagination.lastPage}</span>
                        <Button variant="outline" size="sm" disabled={pagination.currentPage >= pagination.lastPage} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                    </div>
                </div>
            )}

            <Modal open={showForm} onOpenChange={setShowForm} title="Novo Contrato de Fornecedor" size="lg">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Fornecedor *</label>
                        <select value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)} required aria-label="Fornecedor" className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                            <option value="">Selecionar</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        {formErrors.supplier_id && <p className="mt-1 text-xs text-red-500">{formErrors.supplier_id[0]}</p>}
                    </div>
                    <Input label="Descrição *" value={form.description} onChange={e => set('description', e.target.value)} error={formErrors.description?.[0]} required />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Início *" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} error={formErrors.start_date?.[0]} required />
                        <Input label="Fim *" type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} error={formErrors.end_date?.[0]} required />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Valor (R$) *" type="number" step="0.01" value={form.value} onChange={e => set('value', e.target.value)} error={formErrors.value?.[0]} required />
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Frequência *</label>
                            <select value={form.payment_frequency} onChange={e => set('payment_frequency', e.target.value)} aria-label="Frequência" className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                {Object.entries(freqLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form.auto_renew} onChange={e => set('auto_renew', e.target.checked)} className="rounded border-default" />
                        Renovação automática
                    </label>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Observações</label>
                        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>Criar Contrato</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
