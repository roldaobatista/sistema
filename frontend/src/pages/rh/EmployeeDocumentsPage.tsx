import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Trash2, Upload, Search, AlertTriangle, Download, Shield } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

interface EmployeeDocument {
    id: number; user?: { name: string }; user_id: number; category: string; name: string
    file_path: string; expiry_date: string | null; issued_date: string; issuer: string
    is_mandatory: boolean; status: 'valid' | 'expiring' | 'expired' | 'pending'; notes: string | null
}

const categoryLabels: Record<string, string> = {
    aso: 'ASO', nr: 'NR', contract: 'Contrato', license: 'Licença',
    certification: 'Certificação', id_doc: 'Documento ID', other: 'Outro',
}
const statusColors: Record<string, string> = {
    valid: 'bg-emerald-100 text-emerald-700', expiring: 'bg-amber-100 text-amber-700',
    expired: 'bg-red-100 text-red-700', pending: 'bg-surface-100 text-surface-600',
}
const statusLabels: Record<string, string> = { valid: 'Válido', expiring: 'Vencendo', expired: 'Vencido', pending: 'Pendente' }

const emptyForm = { user_id: '', category: 'aso', name: '', expiry_date: '', issued_date: '', issuer: '', is_mandatory: false, notes: '' }

export default function EmployeeDocumentsPage() {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const canManage = hasRole('super_admin') || hasPermission('hr.document.manage')
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [file, setFile] = useState<File | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<EmployeeDocument | null>(null)

    const { data: docsRes, isLoading } = useQuery({
        queryKey: ['employee-documents', categoryFilter, search],
        queryFn: () => api.get('/hr/documents', { params: { category: categoryFilter || undefined, search: search || undefined } }).then(r => r.data?.data ?? []),
    })
    const documents: EmployeeDocument[] = docsRes ?? []

    const { data: expiringRes } = useQuery({
        queryKey: ['employee-documents-expiring'],
        queryFn: () => api.get('/hr/documents/expiring').then(r => r.data?.data ?? []),
    })
    const expiringDocs: EmployeeDocument[] = expiringRes ?? []

    const { data: usersRes } = useQuery({
        queryKey: ['technicians-options'],
        queryFn: () => api.get('/technicians/options').then(r => r.data),
    })
    const users: { id: number; name: string }[] = usersRes ?? []

    const uploadMut = useMutation({
        mutationFn: (fd: FormData) => api.post('/hr/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['employee-documents'] });
                qc.invalidateQueries({ queryKey: ['employee-documents-expiring'] }); setShowModal(false); setForm(emptyForm); setFile(null); toast.success('Documento adicionado') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao enviar documento'),
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/hr/documents/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['employee-documents'] }); setDeleteTarget(null); toast.success('Documento excluído') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao excluir'),
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!file) { toast.error('Selecione um arquivo'); return }
        const fd = new FormData()
        fd.append('file', file); fd.append('user_id', form.user_id); fd.append('category', form.category)
        fd.append('name', form.name); fd.append('issued_date', form.issued_date); fd.append('issuer', form.issuer)
        fd.append('is_mandatory', form.is_mandatory ? '1' : '0')
        if (form.expiry_date) fd.append('expiry_date', form.expiry_date)
        if (form.notes) fd.append('notes', form.notes)
        uploadMut.mutate(fd)
    }

    const set = (key: string, value: any) => setForm(p => ({ ...p, [key]: value }))
    const fmtDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

    return (
        <div className="space-y-5">
            <PageHeader title="Documentos do Colaborador" subtitle="ASO, NR, contratos, certificações e licenças" />

            {expiringDocs.length > 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-amber-800">{expiringDocs.length} documento(s) vencendo ou vencido(s)</p>
                        <p className="text-xs text-amber-600 mt-0.5">
                            {expiringDocs.slice(0, 3).map(d => `${d.user?.name}: ${d.name}`).join(' · ')}
                            {expiringDocs.length > 3 && ` +${expiringDocs.length - 3} mais`}
                        </p>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                        <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                    </div>
                    <select aria-label="Filtrar por categoria" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none">
                        <option value="">Todas categorias</option>
                        {Object.entries(categoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                </div>
                {canManage && <Button onClick={() => { setForm(emptyForm); setFile(null); setShowModal(true) }} icon={<Plus className="h-4 w-4" />}>Novo Documento</Button>}
            </div>

            <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full text-sm">
                    <thead><tr className="border-b border-subtle bg-surface-50">
                        <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Colaborador</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Documento</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-surface-600">Categoria</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Emissor</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Validade</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-surface-600">Status</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-surface-600">Ações</th>
                    </tr></thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                        {!isLoading && documents.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-12 text-center">
                                <FileText className="mx-auto h-8 w-8 text-surface-300" />
                                <p className="mt-2 text-sm text-surface-400">Nenhum documento cadastrado</p>
                                {canManage && <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowModal(true)}>Adicionar</Button>}
                            </td></tr>
                        )}
                        {documents.map(d => (
                            <tr key={d.id} className={cn('transition-colors hover:bg-surface-50/50', d.status === 'expired' && 'bg-red-50/30', d.status === 'expiring' && 'bg-amber-50/30')}>
                                <td className="px-4 py-3 font-medium text-surface-900">{d.user?.name ?? '—'}</td>
                                <td className="px-4 py-3"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-surface-400" /><span>{d.name}</span>{d.is_mandatory && <span title="Obrigatório"><Shield className="h-3 w-3 text-red-500" /></span>}</div></td>
                                <td className="px-4 py-3 text-center"><span className="rounded-full bg-surface-100 px-2.5 py-0.5 text-xs font-medium text-surface-600">{categoryLabels[d.category] ?? d.category}</span></td>
                                <td className="px-4 py-3 text-sm text-surface-500">{d.issuer}</td>
                                <td className="px-4 py-3 text-xs">{fmtDate(d.expiry_date)}</td>
                                <td className="px-4 py-3 text-center"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusColors[d.status])}>{statusLabels[d.status]}</span></td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                        {d.file_path && <a href={d.file_path} target="_blank" rel="noopener noreferrer" title="Download" className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"><Download className="h-3.5 w-3.5" /></a>}
                                        {canManage && <button title="Excluir" onClick={() => setDeleteTarget(d)} className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal open={showModal && canManage} onOpenChange={setShowModal} title="Novo Documento" size="md">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Colaborador *</label>
                        <select aria-label="Selecionar colaborador" value={form.user_id} onChange={e => set('user_id', e.target.value)} required
                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                            <option value="">— Selecionar —</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Nome *" value={form.name} required onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('name', e.target.value)} />
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Categoria *</label>
                            <select aria-label="Categoria" value={form.category} onChange={e => set('category', e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                {Object.entries(categoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Emissão *" type="date" value={form.issued_date} required onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('issued_date', e.target.value)} />
                        <Input label="Validade" type="date" value={form.expiry_date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('expiry_date', e.target.value)} />
                    </div>
                    <Input label="Emissor *" value={form.issuer} required onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('issuer', e.target.value)} />
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Arquivo *</label>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-default bg-surface-50 px-4 py-3 text-sm text-surface-500 hover:border-brand-400 hover:bg-brand-50/30">
                            <Upload className="h-4 w-4" />{file ? file.name : 'Selecione (PDF, JPG, PNG)'}
                            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                        </label>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-surface-700">
                        <input type="checkbox" checked={form.is_mandatory} onChange={e => set('is_mandatory', e.target.checked)} className="h-4 w-4 rounded border-default text-brand-600 focus:ring-brand-500" />
                        Documento obrigatório
                    </label>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button type="submit" loading={uploadMut.isPending}>Enviar</Button>
                    </div>
                </form>
            </Modal>

            <Modal open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Excluir Documento" size="sm">
                <p className="text-sm text-surface-600">Excluir <strong>{deleteTarget?.name}</strong> de {deleteTarget?.user?.name}?</p>
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                    <Button className="bg-red-600 hover:bg-red-700" onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} loading={deleteMut.isPending}>Excluir</Button>
                </div>
            </Modal>
        </div>
    )
}
