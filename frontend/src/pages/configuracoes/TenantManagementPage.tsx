import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Building2, Plus, Search, Users, MapPin, Mail, Phone, FileText,
    MoreHorizontal, Edit, Trash2, UserPlus, UserMinus, X,
    CheckCircle2, XCircle, Clock,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

const statusConfig: Record<string, { label: string; variant: any; icon: any }> = {
    active: { label: 'Ativo', variant: 'success', icon: CheckCircle2 },
    inactive: { label: 'Inativo', variant: 'danger', icon: XCircle },
    trial: { label: 'Trial', variant: 'warning', icon: Clock },
}

export function TenantManagementPage() {
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [selectedTenant, setSelectedTenant] = useState<any>(null)
    const [detailTenant, setDetailTenant] = useState<any>(null)
    const [form, setForm] = useState({ name: '', document: '', email: '', phone: '', status: 'active' })
    const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: '' })

    const { data: tenantsRes, isLoading } = useQuery({
        queryKey: ['tenants'],
        queryFn: () => api.get('/tenants'),
    })
    const tenants = tenantsRes?.data ?? []

    const { data: statsRes } = useQuery({
        queryKey: ['tenants-stats'],
        queryFn: () => api.get('/tenants-stats'),
    })
    const stats = statsRes?.data ?? { total: 0, active: 0, trial: 0, inactive: 0 }

    const { data: detailRes } = useQuery({
        queryKey: ['tenants', detailTenant?.id],
        queryFn: () => api.get(`/tenants/${detailTenant.id}`),
        enabled: !!detailTenant,
    })
    const detail = detailRes?.data

    const saveMut = useMutation({
        mutationFn: (data: any) =>
            selectedTenant ? api.put(`/tenants/${selectedTenant.id}`, data) : api.post('/tenants', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tenants'] })
            qc.invalidateQueries({ queryKey: ['tenants-stats'] })
            setShowModal(false)
            setSelectedTenant(null)
        },
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/tenants/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tenants'] })
            qc.invalidateQueries({ queryKey: ['tenants-stats'] })
        },
    })

    const inviteMut = useMutation({
        mutationFn: (data: any) => api.post(`/tenants/${detailTenant.id}/invite`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tenants', detailTenant.id] })
            setShowInviteModal(false)
            setInviteForm({ name: '', email: '', role: '' })
        },
    })

    const removeUserMut = useMutation({
        mutationFn: (userId: number) => api.delete(`/tenants/${detailTenant.id}/users/${userId}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants', detailTenant.id] }),
    })

    const openCreate = () => { setSelectedTenant(null); setForm({ name: '', document: '', email: '', phone: '', status: 'active' }); setShowModal(true) }
    const openEdit = (t: any) => { setSelectedTenant(t); setForm({ name: t.name, document: t.document ?? '', email: t.email ?? '', phone: t.phone ?? '', status: t.status }); setShowModal(true) }

    const filtered = tenants.filter((t: any) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.document ?? '').includes(search))

    if (isLoading) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="h-8 w-48 rounded-lg skeleton" />
                <div className="grid gap-4 sm:grid-cols-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl skeleton" />)}
                </div>
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-xl skeleton" />)}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Gerenciamento de Empresas</h1>
                    <p className="mt-1 text-sm text-surface-500">Administre tenants, usuários e acessos</p>
                </div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nova Empresa</Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-4">
                {[
                    { label: 'Total', value: stats.total, color: 'text-surface-700', bg: 'bg-surface-50' },
                    { label: 'Ativas', value: stats.active, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                    { label: 'Trial', value: stats.trial, color: 'text-amber-700', bg: 'bg-amber-50' },
                    { label: 'Inativas', value: stats.inactive, color: 'text-red-700', bg: 'bg-red-50' },
                ].map((s, i) => (
                    <div key={i} className={cn('rounded-xl border border-surface-200 p-4 shadow-card', s.bg)}
                        style={{ animationDelay: `${i * 80}ms` }}>
                        <p className="text-xs font-medium text-surface-500">{s.label}</p>
                        <p className={cn('text-2xl font-bold mt-1', s.color)}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                <input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                    placeholder="Buscar por nome ou CNPJ..." aria-label="Buscar empresas"
                    className="w-full rounded-lg border border-surface-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
            </div>

            {/* Tenant List */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="rounded-xl border border-surface-200 bg-white p-12 text-center">
                        <Building2 className="mx-auto h-10 w-10 text-surface-300 mb-3" />
                        <p className="text-sm text-surface-500">Nenhuma empresa encontrada</p>
                    </div>
                ) : filtered.map((t: any, idx: number) => {
                    const sc = statusConfig[t.status] ?? statusConfig.active
                    const StatusIcon = sc.icon
                    return (
                        <div key={t.id}
                            className="rounded-xl border border-surface-200 bg-white p-4 shadow-card hover:shadow-elevated transition-all duration-200 cursor-pointer animate-slide-up"
                            style={{ animationDelay: `${idx * 50}ms` }}
                            onClick={() => setDetailTenant(t)}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 font-bold text-sm">
                                        {t.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-surface-900">{t.name}</h3>
                                        <div className="flex items-center gap-3 mt-0.5 text-xs text-surface-500">
                                            {t.document && <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{t.document}</span>}
                                            {t.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{t.email}</span>}
                                            {t.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{t.phone}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 text-xs text-surface-500">
                                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{t.users_count ?? 0}</span>
                                        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{t.branches_count ?? 0}</span>
                                    </div>
                                    <Badge variant={sc.variant} dot>{sc.label}</Badge>
                                    <div className="flex items-center gap-1">
                                        <button title="Editar empresa" onClick={e => { e.stopPropagation(); openEdit(t) }}
                                            className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors">
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button title="Excluir empresa" onClick={e => { e.stopPropagation(); if (confirm('Excluir esta empresa?')) deleteMut.mutate(t.id) }}
                                            className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-surface-900">{selectedTenant ? 'Editar Empresa' : 'Nova Empresa'}</h2>
                            <button onClick={() => setShowModal(false)} className="rounded-lg p-1 hover:bg-surface-100" aria-label="Fechar modal"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <Input label="Nome *" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, name: e.target.value }))} />
                            <Input label="CNPJ/CPF" value={form.document} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, document: e.target.value }))} />
                            <Input label="E-mail" type="email" value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, email: e.target.value }))} />
                            <Input label="Telefone" value={form.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, phone: e.target.value }))} />
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Status</label>
                                <select value={form.status} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, status: e.target.value }))}
                                    aria-label="Status da empresa"
                                    className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                                    <option value="active">Ativo</option>
                                    <option value="trial">Trial</option>
                                    <option value="inactive">Inativo</option>
                                </select>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                            <Button onClick={() => saveMut.mutate(form)} loading={saveMut.isPending}>
                                {selectedTenant ? 'Salvar' : 'Criar'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Panel */}
            {detailTenant && (
                <div className="fixed inset-0 z-50 flex items-end justify-end" onClick={() => setDetailTenant(null)}>
                    <div className="fixed inset-0 bg-black/30" />
                    <div className="relative h-full w-full max-w-lg bg-white shadow-xl animate-slide-up overflow-y-auto"
                        onClick={e => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white border-b border-surface-200 p-4 flex items-center justify-between z-10">
                            <h2 className="text-lg font-bold text-surface-900">{detailTenant.name}</h2>
                            <button onClick={() => setDetailTenant(null)} className="rounded-lg p-1 hover:bg-surface-100" aria-label="Fechar painel"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="p-5 space-y-6">
                            {/* Info */}
                            <div className="rounded-xl border border-surface-200 p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-surface-700">Informações</h3>
                                {detail && (
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div><span className="text-surface-500">CNPJ:</span> <span className="font-medium">{detail.document || '—'}</span></div>
                                        <div><span className="text-surface-500">E-mail:</span> <span className="font-medium">{detail.email || '—'}</span></div>
                                        <div><span className="text-surface-500">Telefone:</span> <span className="font-medium">{detail.phone || '—'}</span></div>
                                        <div><span className="text-surface-500">Status:</span> <Badge variant={statusConfig[detail.status]?.variant}>{statusConfig[detail.status]?.label}</Badge></div>
                                    </div>
                                )}
                            </div>

                            {/* Users */}
                            <div className="rounded-xl border border-surface-200 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-surface-700">
                                        Usuários ({detail?.users?.length ?? 0})
                                    </h3>
                                    <Button size="sm" variant="outline" icon={<UserPlus className="h-3.5 w-3.5" />}
                                        onClick={() => setShowInviteModal(true)}>
                                        Convidar
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {(detail?.users ?? []).map((u: any) => (
                                        <div key={u.id} className="flex items-center justify-between rounded-lg bg-surface-50 p-3">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                                                    {u.name?.charAt(0)?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-surface-900">{u.name}</p>
                                                    <p className="text-xs text-surface-500">{u.email}</p>
                                                </div>
                                            </div>
                                            <button title="Remover usuário" onClick={() => removeUserMut.mutate(u.id)}
                                                className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                                <UserMinus className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Branches */}
                            <div className="rounded-xl border border-surface-200 p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-surface-700">
                                    Filiais ({detail?.branches?.length ?? 0})
                                </h3>
                                <div className="space-y-2">
                                    {(detail?.branches ?? []).map((b: any) => (
                                        <div key={b.id} className="flex items-center gap-2 rounded-lg bg-surface-50 p-3 text-sm">
                                            <MapPin className="h-4 w-4 text-brand-500" />
                                            <span className="font-medium text-surface-900">{b.name}</span>
                                            {b.code && <span className="text-surface-400">({b.code})</span>}
                                        </div>
                                    ))}
                                    {(detail?.branches ?? []).length === 0 && (
                                        <p className="text-xs text-surface-400">Nenhuma filial</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setShowInviteModal(false)}>
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-scale-in" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold text-surface-900 mb-4">Convidar Usuário</h2>
                        <div className="space-y-4">
                            <Input label="Nome *" value={inviteForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteForm(f => ({ ...f, name: e.target.value }))} />
                            <Input label="E-mail *" type="email" value={inviteForm.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteForm(f => ({ ...f, email: e.target.value }))} />
                            <Input label="Papel (role)" value={inviteForm.role} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteForm(f => ({ ...f, role: e.target.value }))} placeholder="admin, technician..." />
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowInviteModal(false)}>Cancelar</Button>
                            <Button onClick={() => inviteMut.mutate(inviteForm)} loading={inviteMut.isPending}>Convidar</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
