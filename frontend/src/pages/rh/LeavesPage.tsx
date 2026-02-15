import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Calendar, Plus, CheckCircle2, XCircle, Clock, Search,
    ChevronLeft, ChevronRight, FileText, Upload, Loader2
} from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

interface LeaveRequest {
    id: number
    user?: { name: string }
    type: string
    start_date: string
    end_date: string
    days_count: number
    reason: string
    document_path: string | null
    status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled'
    approved_by_user?: { name: string }
    rejection_reason: string | null
    created_at: string
}

const typeLabels: Record<string, string> = {
    vacation: 'Férias',
    medical: 'Médico',
    personal: 'Pessoal',
    maternity: 'Maternidade',
    paternity: 'Paternidade',
    bereavement: 'Luto',
    other: 'Outro',
}

const statusColors: Record<string, string> = {
    draft: 'bg-surface-100 text-surface-600',
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    cancelled: 'bg-surface-100 text-surface-500',
}
const statusLabels: Record<string, string> = {
    draft: 'Rascunho',
    pending: 'Pendente',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
    cancelled: 'Cancelado',
}

const emptyForm = { type: 'vacation', start_date: '', end_date: '', reason: '' }

export default function LeavesPage() {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const canApprove = hasRole('super_admin') || hasPermission('hr.leave.approve')
    const canCreate = hasRole('super_admin') || hasPermission('hr.leave.create')
    const [page, setPage] = useState(1)
    const [statusFilter, setStatusFilter] = useState<string>('pending')
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [docFile, setDocFile] = useState<File | null>(null)
    const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null)
    const [rejectReason, setRejectReason] = useState('')

    const { data: leavesRes, isLoading } = useQuery({
        queryKey: ['leaves', page, statusFilter, search],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/hr/leaves', {
            params: { page, per_page: 20, status: statusFilter || undefined, search: search || undefined },
        }).then(r => r.data),
    })

    const leaves: LeaveRequest[] = leavesRes?.data ?? []
    const lastPage = leavesRes?.meta?.last_page ?? 1

    const createMut = useMutation({
        mutationFn: (fd: FormData) => api.post('/hr/leaves', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['leaves'] })
            setShowModal(false)
            setForm(emptyForm)
            setDocFile(null)
            toast.success('Solicitação criada com sucesso')
        },
        onError: (err: any) => {
            if (err?.response?.status === 422) {
                toast.error('Verifique os campos obrigatórios')
            } else {
                toast.error(err?.response?.data?.message ?? 'Erro ao criar solicitação')
            }
        },
    })

    const approveMut = useMutation({
        mutationFn: (id: number) => api.post(`/hr/leaves/${id}/approve`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['leaves'] })
            toast.success('Solicitação aprovada')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao aprovar'),
    })

    const rejectMut = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason: string }) =>
            api.post(`/hr/leaves/${id}/reject`, { rejection_reason: reason }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['leaves'] })
            setRejectTarget(null)
            setRejectReason('')
            toast.success('Solicitação rejeitada')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao rejeitar'),
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const fd = new FormData()
        fd.append('type', form.type)
        fd.append('start_date', form.start_date)
        fd.append('end_date', form.end_date)
        fd.append('reason', form.reason)
        if (docFile) fd.append('document', docFile)
        createMut.mutate(fd)
    }

    const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

    return (
        <div className="space-y-5">
            <PageHeader title="Férias & Afastamentos" subtitle="Solicitações de férias, licenças e afastamentos" />

            {/* Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                            className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                        />
                    </div>
                    <div className="flex gap-1 rounded-lg border border-default bg-surface-50 p-0.5">
                        {['pending', 'approved', 'rejected', ''].map(s => (
                            <button
                                key={s}
                                onClick={() => { setStatusFilter(s); setPage(1) }}
                                className={cn(
                                    'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                                    statusFilter === s
                                        ? 'bg-surface-0 text-brand-700 shadow-sm'
                                        : 'text-surface-500 hover:text-surface-700'
                                )}
                            >
                                {s === '' ? 'Todos' : statusLabels[s]}
                            </button>
                        ))}
                    </div>
                </div>
                {canCreate && (
                    <Button onClick={() => { setForm(emptyForm); setDocFile(null); setShowModal(true) }}
                        icon={<Plus className="h-4 w-4" />}>
                        Nova Solicitação
                    </Button>
                )}
            </div>

            {/* Table */}
            <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Colaborador</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Tipo</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Período</th>
                            <th className="px-4 py-2.5 text-center font-semibold text-surface-600">Dias</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Motivo</th>
                            <th className="px-4 py-2.5 text-center font-semibold text-surface-600">Status</th>
                            {canApprove && <th className="px-4 py-2.5 text-right font-semibold text-surface-600">Ações</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading && (
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>
                        )}
                        {!isLoading && leaves.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center">
                                    <Calendar className="mx-auto h-8 w-8 text-surface-300" />
                                    <p className="mt-2 text-sm text-surface-400">Nenhuma solicitação encontrada</p>
                                </td>
                            </tr>
                        )}
                        {leaves.map(l => (
                            <tr key={l.id} className="transition-colors hover:bg-surface-50/50">
                                <td className="px-4 py-3 font-medium text-surface-900">{l.user?.name ?? '—'}</td>
                                <td className="px-4 py-3">
                                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                                        {typeLabels[l.type] ?? l.type}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-surface-600">
                                    {fmtDate(l.start_date)} → {fmtDate(l.end_date)}
                                </td>
                                <td className="px-4 py-3 text-center font-medium text-surface-900">{l.days_count}</td>
                                <td className="px-4 py-3 text-sm text-surface-600 max-w-xs truncate">{l.reason}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusColors[l.status])}>
                                        {statusLabels[l.status]}
                                    </span>
                                </td>
                                {canApprove && (
                                    <td className="px-4 py-3 text-right">
                                        {l.status === 'pending' && (
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    title="Aprovar"
                                                    onClick={() => approveMut.mutate(l.id)}
                                                    disabled={approveMut.isPending}
                                                    className="rounded-lg p-1.5 text-emerald-500 hover:bg-emerald-50"
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    title="Rejeitar"
                                                    onClick={() => { setRejectTarget(l); setRejectReason('') }}
                                                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {lastPage > 1 && (
                <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                        icon={<ChevronLeft className="h-4 w-4" />}>Anterior</Button>
                    <span className="text-xs text-surface-500">Página {page} de {lastPage}</span>
                    <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>
                        Próxima <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Create Modal */}
            <Modal open={showModal} onOpenChange={setShowModal} title="Nova Solicitação" size="md">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Tipo *</label>
                        <select
                            aria-label="Tipo de afastamento"
                            value={form.type}
                            onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                        >
                            {Object.entries(typeLabels).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Data Início *" type="date" value={form.start_date} required
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, start_date: e.target.value }))} />
                        <Input label="Data Fim *" type="date" value={form.end_date} required
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, end_date: e.target.value }))} />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Motivo *</label>
                        <textarea
                            value={form.reason}
                            onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                            required
                            rows={3}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                            placeholder="Descreva o motivo..."
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Documento (opcional)</label>
                        <div className="flex items-center gap-3">
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-surface-300 bg-surface-50 px-4 py-3 text-sm text-surface-500 hover:border-brand-400 hover:bg-brand-50/30">
                                <Upload className="h-4 w-4" />
                                {docFile ? docFile.name : 'Anexar atestado/documento'}
                                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={e => setDocFile(e.target.files?.[0] ?? null)} />
                            </label>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button type="submit" loading={createMut.isPending}>Enviar Solicitação</Button>
                    </div>
                </form>
            </Modal>

            {/* Reject Modal */}
            <Modal open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)} title="Rejeitar Solicitação" size="sm">
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">
                        Rejeitar solicitação de <strong>{rejectTarget?.user?.name}</strong>
                        ({typeLabels[rejectTarget?.type ?? ''] ?? rejectTarget?.type}):
                    </p>
                    <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        required
                        rows={3}
                        className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                        placeholder="Motivo da rejeição..."
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancelar</Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700"
                            disabled={!rejectReason.trim()}
                            loading={rejectMut.isPending}
                            onClick={() => rejectTarget && rejectMut.mutate({ id: rejectTarget.id, reason: rejectReason })}
                        >
                            Rejeitar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
