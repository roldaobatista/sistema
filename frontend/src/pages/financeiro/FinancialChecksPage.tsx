import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, FileText, CheckCircle, Clock, ArrowUpFromLine, ArrowDownToLine, Ban } from 'lucide-react'
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
    pending: { label: 'Pendente', variant: 'warning' },
    deposited: { label: 'Depositado', variant: 'info' },
    compensated: { label: 'Compensado', variant: 'success' },
    returned: { label: 'Devolvido', variant: 'danger' },
    custody: { label: 'Em Custódia', variant: 'default' },
}

const typeLabels: Record<string, string> = { received: 'Recebido', issued: 'Emitido' }

interface Check {
    id: number; type: string; number: string; bank: string
    amount: string; due_date: string; issuer: string; status: string; notes?: string
}

interface CheckForm {
    type: string; number: string; bank: string; amount: string
    due_date: string; issuer: string; status: string; notes: string
}

export function FinancialChecksPage() {
    const qc = useQueryClient()
    const emptyForm: CheckForm = { type: 'received', number: '', bank: '', amount: '', due_date: '', issuer: '', status: 'pending', notes: '' }

    const [statusFilter, setStatusFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [page, setPage] = useState(1)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState<CheckForm>(emptyForm)
    const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
    const [statusTarget, setStatusTarget] = useState<Check | null>(null)
    const [newStatus, setNewStatus] = useState('')

    const { data: res, isLoading, isError, refetch } = useQuery({
        queryKey: ['financial-checks', statusFilter, typeFilter, page],
        queryFn: () => api.get('/financial/checks', { params: { status: statusFilter || undefined, type: typeFilter || undefined, page } }),
    })
    const records: Check[] = res?.data?.data ?? []
    const pagination = { currentPage: res?.data?.current_page ?? 1, lastPage: res?.data?.last_page ?? 1, total: res?.data?.total ?? 0 }

    const saveMut = useMutation({
        mutationFn: (data: CheckForm) => api.post('/financial/checks', { ...data, notes: data.notes.trim() || null }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['financial-checks'] })
            setShowForm(false); setForm(emptyForm); setFormErrors({})
            toast.success('Cheque registrado com sucesso')
        },
        onError: (error: unknown) => {
            const payload = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
            if (payload?.errors) { setFormErrors(payload.errors); toast.error(payload.message ?? 'Verifique os campos'); return }
            toast.error(payload?.message ?? 'Erro ao registrar cheque')
        },
    })

    const statusMut = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) => api.patch(`/financial/checks/${id}/status`, { status }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['financial-checks'] })
            setStatusTarget(null); setNewStatus('')
            toast.success('Status atualizado com sucesso')
        },
        onError: (error: unknown) => {
            const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
            toast.error(msg ?? 'Erro ao atualizar status')
        },
    })

    const set = <K extends keyof CheckForm>(k: K, v: CheckForm[K]) => {
        setForm(p => ({ ...p, [k]: v }))
        if (formErrors[k]) { setFormErrors(prev => { const n = { ...prev }; delete n[k]; return n }) }
    }

    return (
        <div className="space-y-5">
            <PageHeader
                title="Cheques"
                subtitle="Gestão de cheques recebidos e emitidos"
                count={pagination.total}
                actions={[{ label: 'Novo Cheque', onClick: () => { setForm(emptyForm); setFormErrors({}); setShowForm(true) }, icon: <Plus className="h-4 w-4" /> }]}
            />

            <div className="flex gap-3">
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Tipo" className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="">Todos os tipos</option>
                    <option value="received">Recebido</option>
                    <option value="issued">Emitido</option>
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Status" className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="">Todos os status</option>
                    {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
            </div>

            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Nº</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Tipo</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Banco</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Emitente</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Vencimento</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Status</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Valor</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading ? (
                            <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-surface-500">Carregando...</td></tr>
                        ) : isError ? (
                            <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-red-600">Erro ao carregar. <button className="underline" onClick={() => refetch()}>Tentar novamente</button></td></tr>
                        ) : records.length === 0 ? (
                            <tr><td colSpan={8} className="px-4 py-2"><EmptyState icon={<FileText className="h-5 w-5 text-surface-300" />} message="Nenhum cheque encontrado" compact /></td></tr>
                        ) : records.map(r => (
                            <tr key={r.id} className="hover:bg-surface-50 transition-colors">
                                <td className="px-4 py-3 text-sm font-medium text-surface-900">{r.number}</td>
                                <td className="px-4 py-3"><Badge variant={r.type === 'received' ? 'info' : 'warning'}>{typeLabels[r.type] ?? r.type}</Badge></td>
                                <td className="px-4 py-3 text-sm text-surface-600">{r.bank}</td>
                                <td className="px-4 py-3 text-sm text-surface-600">{r.issuer}</td>
                                <td className="px-4 py-3 text-sm text-surface-500">{fmtDate(r.due_date)}</td>
                                <td className="px-4 py-3"><Badge variant={statusConfig[r.status]?.variant}>{statusConfig[r.status]?.label ?? r.status}</Badge></td>
                                <td className="px-4 py-3 text-right text-sm font-semibold text-surface-900">{fmtBRL(r.amount)}</td>
                                <td className="px-4 py-3 text-right">
                                    <Button size="sm" variant="outline" onClick={() => { setStatusTarget(r); setNewStatus(r.status) }}>Alterar Status</Button>
                                </td>
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

            {/* CREATE FORM */}
            <Modal open={showForm} onOpenChange={setShowForm} title="Registrar Cheque" size="lg">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Tipo *</label>
                            <select value={form.type} onChange={e => set('type', e.target.value)} aria-label="Tipo de cheque" className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="received">Recebido</option>
                                <option value="issued">Emitido</option>
                            </select>
                        </div>
                        <Input label="Número *" value={form.number} onChange={e => set('number', e.target.value)} error={formErrors.number?.[0]} required />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Banco *" value={form.bank} onChange={e => set('bank', e.target.value)} error={formErrors.bank?.[0]} required />
                        <Input label="Emitente *" value={form.issuer} onChange={e => set('issuer', e.target.value)} error={formErrors.issuer?.[0]} required />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Valor (R$) *" type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} error={formErrors.amount?.[0]} required />
                        <Input label="Vencimento *" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} error={formErrors.due_date?.[0]} required />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Observações</label>
                        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>Registrar</Button>
                    </div>
                </form>
            </Modal>

            {/* STATUS CHANGE */}
            <Modal open={!!statusTarget} onOpenChange={() => setStatusTarget(null)} title="Alterar Status do Cheque">
                <div className="space-y-4">
                    {statusTarget && (
                        <div className="rounded-lg bg-surface-50 p-3 text-sm">
                            <p className="font-medium">Cheque Nº {statusTarget.number}</p>
                            <p className="text-surface-500">{statusTarget.bank} — {statusTarget.issuer} — {fmtBRL(statusTarget.amount)}</p>
                        </div>
                    )}
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Novo Status</label>
                        <select value={newStatus} onChange={e => setNewStatus(e.target.value)} aria-label="Novo status" className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                            {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" onClick={() => setStatusTarget(null)}>Cancelar</Button>
                        <Button loading={statusMut.isPending} onClick={() => { if (statusTarget) statusMut.mutate({ id: statusTarget.id, status: newStatus }) }}>Atualizar Status</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
