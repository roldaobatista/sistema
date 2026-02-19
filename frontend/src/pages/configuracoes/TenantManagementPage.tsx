import React, { useState, useCallback, useRef, useEffect } from 'react'
import { AxiosError } from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Building2, Plus, Search, Users, MapPin, Mail, Phone, FileText,
    Edit, Trash2, UserPlus, UserMinus, X, AlertTriangle,
    CheckCircle2, XCircle, Clock, RefreshCw, Loader2, ExternalLink,
    ChevronLeft, ChevronRight, Calendar,
} from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useDebounce } from '@/hooks/useDebounce'
import { useViaCep } from '@/hooks/useViaCep'
import { useCnpjLookup } from '@/hooks/useCnpjLookup'
import { useIbgeStates, useIbgeCities } from '@/hooks/useIbge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface Tenant {
    id: number
    name: string
    trade_name: string | null
    document: string | null
    email: string | null
    phone: string | null
    website: string | null
    status: string
    address_city: string | null
    address_state: string | null
    users_count?: number
    branches_count?: number
    created_at?: string
    updated_at?: string
}

interface TenantDetail extends Tenant {
    users: Array<{ id: number; name: string; email: string }>
    branches: Array<{ id: number; tenant_id: number; name: string; code: string | null }>
    state_registration: string | null
    city_registration: string | null
    address_street: string | null
    address_number: string | null
    address_complement: string | null
    address_neighborhood: string | null
    address_zip: string | null
    full_address: string | null
    created_at: string
    updated_at: string
}

interface TenantStats {
    total: number
    active: number
    trial: number
    inactive: number
}

interface TenantForm {
    name: string
    trade_name: string
    document: string
    email: string
    phone: string
    status: string
    website: string
    state_registration: string
    city_registration: string
    address_street: string
    address_number: string
    address_complement: string
    address_neighborhood: string
    address_city: string
    address_state: string
    address_zip: string
}

interface InviteForm {
    name: string
    email: string
    role: string
}

interface RoleOption {
    name: string
    display_name: string
}

const emptyForm: TenantForm = {
    name: '', trade_name: '', document: '', email: '', phone: '', status: 'active',
    website: '', state_registration: '', city_registration: '',
    address_street: '', address_number: '', address_complement: '',
    address_neighborhood: '', address_city: '', address_state: '', address_zip: '',
}

const statusConfig: Record<string, { label: string; variant: 'success' | 'danger' | 'warning'; icon: typeof CheckCircle2 }> = {
    active: { label: 'Ativo', variant: 'success', icon: CheckCircle2 },
    inactive: { label: 'Inativo', variant: 'danger', icon: XCircle },
    trial: { label: 'Teste', variant: 'warning', icon: Clock },
}

function formatDocument(value: string): string {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 11) {
        return digits
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    }
    return digits
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function maskPhone(value: string): string {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 10) {
        return digits
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4})(\d)/, '$1-$2')
    }
    return digits
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
}

function formatCep(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    return digits.replace(/(\d{5})(\d)/, '$1-$2')
}

function isFormDirty(form: TenantForm): boolean {
    return Object.entries(form).some(([k, v]) => k !== 'status' && v !== '' && v !== emptyForm[k as keyof TenantForm])
}

function isValidEmail(email: string): boolean {
    if (!email) return true
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidDocument(doc: string): boolean {
    if (!doc) return true
    const digits = doc.replace(/\D/g, '')
    return digits.length === 11 || digits.length === 14
}

function formatDateBr(dateStr: string | null | undefined): string {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const PER_PAGE = 20

export function TenantManagementPage() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const viaCep = useViaCep()
    const cnpjLookup = useCnpjLookup()
    const [search, setSearch] = useState('')
    const debouncedSearch = useDebounce(search, 350)
    const [statusFilter, setStatusFilter] = useState('')
    const [page, setPage] = useState(1)
    const [showModal, setShowModal] = useState(false)
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [showConfirmDelete, setShowConfirmDelete] = useState<Tenant | null>(null)
    const [deleteDependencies, setDeleteDependencies] = useState<Record<string, number> | null>(null)
    const [deleteMessage, setDeleteMessage] = useState<string | null>(null)
    const [showConfirmRemoveUser, setShowConfirmRemoveUser] = useState<{ id: number; name: string } | null>(null)
    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
    const [detailTenant, setDetailTenant] = useState<Tenant | null>(null)
    const [form, setForm] = useState<TenantForm>(emptyForm)
    const [inviteForm, setInviteForm] = useState<InviteForm>({ name: '', email: '', role: '' })
    const [editLoadingId, setEditLoadingId] = useState<number | null>(null)
    const [formErrors, setFormErrors] = useState<Partial<Record<keyof TenantForm, string>>>({})
    const formSnapshotRef = useRef<TenantForm>(emptyForm)

    const { data: ibgeStates = [] } = useIbgeStates()
    const { data: ibgeCities = [] } = useIbgeCities(form.address_state)

    const canCreate = hasPermission('platform.tenant.create')
    const canUpdate = hasPermission('platform.tenant.update')
    const canDelete = hasPermission('platform.tenant.delete')

    async function handleCepBlur() {
        const result = await viaCep.lookup(form.address_zip.replace(/\D/g, ''))
        if (result) {
            setForm(f => ({
                ...f,
                address_street: result.street || f.address_street,
                address_neighborhood: result.neighborhood || f.address_neighborhood,
                address_city: result.city || f.address_city,
                address_state: result.state || f.address_state,
            }))
        }
    }

    async function handleCnpjBlur() {
        const digits = form.document.replace(/\D/g, '')
        if (digits.length !== 14) return
        const result = await cnpjLookup.lookup(digits)
        if (result) {
            setForm(f => ({
                ...f,
                name: result.name || f.name,
                trade_name: result.trade_name || f.trade_name,
                email: result.email || f.email,
                phone: result.phone ? maskPhone(result.phone) : f.phone,
                state_registration: result.state_registration || f.state_registration,
                city_registration: result.city_registration || f.city_registration,
                address_zip: result.address_zip ? formatCep(result.address_zip) : f.address_zip,
                address_street: result.address_street || f.address_street,
                address_number: result.address_number || f.address_number,
                address_complement: result.address_complement || f.address_complement,
                address_neighborhood: result.address_neighborhood || f.address_neighborhood,
                address_city: result.address_city || f.address_city,
                address_state: result.address_state || f.address_state,
            }))
            toast.success('Dados preenchidos via consulta CNPJ')
        }
    }

    const saveMut = useMutation({
        mutationFn: (data: TenantForm) => {
            const payload = Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, v === '' ? null : v])
            ) as Record<string, unknown>
            if (payload.website && typeof payload.website === 'string') {
                const w = payload.website.trim()
                if (w && !/^https?:\/\//i.test(w)) payload.website = 'https://' + w.replace(/^\/+/, '')
            }
            return selectedTenant ? api.put(`/tenants/${selectedTenant.id}`, payload) : api.post('/tenants', payload)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tenants'] })
            qc.invalidateQueries({ queryKey: ['tenants-stats'] })
            if (selectedTenant?.id) {
                qc.invalidateQueries({ queryKey: ['tenants', selectedTenant.id] })
            }
            if (detailTenant?.id && selectedTenant?.id === detailTenant.id) {
                qc.invalidateQueries({ queryKey: ['tenants', detailTenant.id] })
            }
            setShowModal(false)
            setSelectedTenant(null)
            setFormErrors({})
            toast.success(selectedTenant ? 'Empresa atualizada com sucesso!' : 'Empresa criada com sucesso!')
        },
        onError: (err: AxiosError<any>) => {
            if (err.response?.status === 422 && err.response.data?.errors) {
                const serverErrors: Partial<Record<keyof TenantForm, string>> = {}
                for (const [key, msgs] of Object.entries(err.response.data.errors)) {
                    serverErrors[key as keyof TenantForm] = Array.isArray(msgs) ? msgs[0] : String(msgs)
                }
                setFormErrors(serverErrors)
                toast.error('Verifique os campos marcados.')
                return
            }
            toast.error(err.response?.data?.message ?? 'Erro ao salvar empresa.')
        },
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/tenants/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tenants'] })
            qc.invalidateQueries({ queryKey: ['tenants-stats'] })
            if (detailTenant && showConfirmDelete && detailTenant.id === showConfirmDelete.id) {
                setDetailTenant(null)
            }
            setShowConfirmDelete(null)
            setDeleteDependencies(null)
            setDeleteMessage(null)
            toast.success('Empresa excluída com sucesso!')
        },
        onError: (err: AxiosError<any>) => {
            const status = err.response?.status
            if ((status === 409 || status === 422) && err.response.data?.dependencies) {
                setDeleteDependencies(err.response.data.dependencies)
                setDeleteMessage(err.response.data.message)
            } else {
                setShowConfirmDelete(null)
                setDeleteDependencies(null)
                setDeleteMessage(null)
                toast.error(err.response?.data?.message ?? 'Erro ao excluir empresa.')
            }
        },
    })

    const inviteMut = useMutation({
        mutationFn: (data: InviteForm) => api.post(`/tenants/${detailTenant!.id}/invite`, data),
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ['tenants', detailTenant?.id] })
            setShowInviteModal(false)
            setInviteForm({ name: '', email: '', role: '' })
            toast.success(res.data?.message ?? 'Convite enviado com sucesso!')
        },
        onError: (err: AxiosError<any>) => {
            toast.error(err.response?.data?.message ?? 'Erro ao convidar usuário.')
        },
    })

    const removeUserMut = useMutation({
        mutationFn: (userId: number) => api.delete(`/tenants/${detailTenant!.id}/users/${userId}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tenants', detailTenant?.id] })
            qc.invalidateQueries({ queryKey: ['tenants'] })
            qc.invalidateQueries({ queryKey: ['tenants-stats'] })
            setShowConfirmRemoveUser(null)
            toast.success('Usuário removido com sucesso!')
        },
        onError: (err: AxiosError<any>) => {
            setShowConfirmRemoveUser(null)
            toast.error(err.response?.data?.message ?? 'Erro ao remover usuário.')
        },
    })

    const { data: tenantsRes, isLoading, isError, refetch } = useQuery({
        queryKey: ['tenants', debouncedSearch, statusFilter, page],
        queryFn: () => api.get('/tenants', {
            params: {
                search: debouncedSearch || undefined,
                status: statusFilter || undefined,
                per_page: PER_PAGE,
                page,
            },
        }),
    })
    const tenants: Tenant[] = tenantsRes?.data?.data ?? []
    const totalCount: number = tenantsRes?.data?.total ?? 0
    const lastPage: number = tenantsRes?.data?.last_page ?? 1

    const { data: statsRes } = useQuery({
        queryKey: ['tenants-stats'],
        queryFn: () => api.get('/tenants-stats'),
    })
    const stats: TenantStats = statsRes?.data ?? { total: 0, active: 0, trial: 0, inactive: 0 }

    const { data: detailRes } = useQuery({
        queryKey: ['tenants', detailTenant?.id],
        queryFn: () => api.get(`/tenants/${detailTenant!.id}`),
        enabled: !!detailTenant,
    })
    const detail: TenantDetail | undefined = detailRes?.data

    const { data: rolesRes } = useQuery({
        queryKey: ['tenant-roles', detailTenant?.id],
        queryFn: () => api.get(`/tenants/${detailTenant!.id}/roles`),
        enabled: !!detailTenant && showInviteModal,
    })
    const availableRoles: RoleOption[] = rolesRes?.data ?? []

    const openCreate = () => {
        setSelectedTenant(null)
        setForm(emptyForm)
        setFormErrors({})
        formSnapshotRef.current = emptyForm
        setShowModal(true)
    }

    const openEdit = async (t: Tenant) => {
        setEditLoadingId(t.id)
        setSelectedTenant(t)
        setFormErrors({})
        try {
            const res = await api.get(`/tenants/${t.id}`)
            const d = res.data as TenantDetail
            const loaded: TenantForm = {
                name: d.name ?? '',
                trade_name: d.trade_name ?? '',
                document: d.document ?? '',
                email: d.email ?? '',
                phone: d.phone ?? '',
                status: d.status ?? 'active',
                website: d.website ?? '',
                state_registration: d.state_registration ?? '',
                city_registration: d.city_registration ?? '',
                address_street: d.address_street ?? '',
                address_number: d.address_number ?? '',
                address_complement: d.address_complement ?? '',
                address_neighborhood: d.address_neighborhood ?? '',
                address_city: d.address_city ?? '',
                address_state: d.address_state ?? '',
                address_zip: d.address_zip ?? '',
            }
            setForm(loaded)
            formSnapshotRef.current = loaded
        } catch {
            const fallback: TenantForm = {
                name: t.name, trade_name: '', document: t.document ?? '',
                email: t.email ?? '', phone: t.phone ?? '', status: t.status,
                website: t.website ?? '', state_registration: '', city_registration: '',
                address_street: '', address_number: '', address_complement: '',
                address_neighborhood: '', address_city: t.address_city ?? '',
                address_state: t.address_state ?? '', address_zip: '',
            }
            setForm(fallback)
            formSnapshotRef.current = fallback
        } finally {
            setEditLoadingId(null)
        }
        setShowModal(true)
    }

    const validateForm = useCallback((): boolean => {
        const errors: Partial<Record<keyof TenantForm, string>> = {}
        if (!form.name.trim()) errors.name = 'Razão Social é obrigatória'
        if (form.email && !isValidEmail(form.email)) errors.email = 'E-mail inválido'
        if (form.document && !isValidDocument(form.document)) errors.document = 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos'
        setFormErrors(errors)
        return Object.keys(errors).length === 0
    }, [form.name, form.email, form.document])

    const tryCloseModal = useCallback(() => {
        const hasChanges = JSON.stringify(form) !== JSON.stringify(formSnapshotRef.current)
        if (hasChanges && isFormDirty(form)) {
            if (!window.confirm('Existem dados não salvos. Deseja sair sem salvar?')) return
        }
        setShowModal(false)
        setFormErrors({})
    }, [form])

    const handleSearch = (val: string) => { setSearch(val); setPage(1) }
    const handleStatusFilter = (val: string) => { setStatusFilter(val); setPage(1) }

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return
            if (showConfirmRemoveUser) { setShowConfirmRemoveUser(null); return }
            if (showConfirmDelete) { setShowConfirmDelete(null); setDeleteDependencies(null); setDeleteMessage(null); return }
            if (showInviteModal) { setShowInviteModal(false); return }
            if (showModal) { tryCloseModal(); return }
            if (detailTenant) { setDetailTenant(null); return }
        }
        document.addEventListener('keydown', handleEsc)
        return () => document.removeEventListener('keydown', handleEsc)
    }, [showConfirmRemoveUser, showConfirmDelete, showInviteModal, showModal, detailTenant, tryCloseModal])

    const depLabels: Record<string, string> = {
        users: 'Usuários',
        branches: 'Filiais',
        work_orders: 'Ordens de Serviço',
        customers: 'Clientes',
        quotes: 'Orçamentos',
        products: 'Produtos',
    }

    if (isLoading) {
        return (
            <div className="space-y-5 animate-fade-in">
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

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <XCircle className="h-12 w-12 text-red-400 mb-3" />
                <p className="text-sm font-medium text-surface-700">Erro ao carregar empresas</p>
                <p className="text-xs text-surface-400 mt-1">Não foi possível buscar os dados. Tente novamente.</p>
                <Button variant="outline" className="mt-4" icon={<RefreshCw className="h-4 w-4" />} onClick={() => refetch()}>Tentar Novamente</Button>
            </div>
        )
    }

    return (
        <div className="space-y-5 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Gerenciamento de Empresas</h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Administre tenants, usuários e acessos</p>
                </div>
                {canCreate && <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nova Empresa</Button>}
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-4">
                {[
                    { label: 'Total', value: stats.total, color: 'text-surface-700', bg: 'bg-surface-50', ring: 'ring-surface-300', filter: '' },
                    { label: 'Ativas', value: stats.active, color: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-400', filter: 'active' },
                    { label: 'Teste', value: stats.trial, color: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-400', filter: 'trial' },
                    { label: 'Inativas', value: stats.inactive, color: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-400', filter: 'inactive' },
                ].map((s, i) => (
                    <button key={i} type="button"
                        onClick={() => handleStatusFilter(s.filter)}
                        className={cn(
                            'rounded-xl border border-default p-4 shadow-card text-left transition-all duration-200 hover:shadow-elevated cursor-pointer',
                            s.bg,
                            statusFilter === s.filter && 'ring-2 ' + s.ring,
                        )}
                        style={{ animationDelay: `${i * 80}ms` }}>
                        <p className="text-xs font-medium text-surface-500">{s.label}</p>
                        <p className={cn('text-2xl font-bold mt-1', s.color)}>{s.value}</p>
                    </button>
                ))}
            </div>

            {/* Search + Status Filter */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                    <input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                        placeholder="Buscar por nome, CNPJ ou e-mail..." aria-label="Buscar empresas"
                        className="w-full rounded-lg border border-default bg-surface-50 pl-9 pr-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                </div>
                <select value={statusFilter} onChange={(e) => handleStatusFilter(e.target.value)}
                    aria-label="Filtrar por status"
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="">Todos os status</option>
                    <option value="active">Ativas</option>
                    <option value="trial">Teste</option>
                    <option value="inactive">Inativas</option>
                </select>
                {(search || statusFilter) && (
                    <button type="button" onClick={() => { setSearch(''); handleStatusFilter('') }}
                        className="text-xs text-surface-500 hover:text-surface-700 underline">
                        Limpar filtros
                    </button>
                )}
            </div>

            {/* Tenant List */}
            <div className="space-y-3">
                {tenants.length === 0 ? (
                    <div className="rounded-xl border border-default bg-surface-0 p-12 text-center">
                        <Building2 className="mx-auto h-10 w-10 text-surface-300 mb-3" />
                        <p className="text-sm font-medium text-surface-600 mb-1">Nenhuma empresa encontrada</p>
                        <p className="text-xs text-surface-400">
                            {search || statusFilter ? 'Tente ajustar os filtros de busca' : 'Comece cadastrando sua primeira empresa'}
                        </p>
                    </div>
                ) : tenants.map((t, idx) => {
                    const sc = statusConfig[t.status] ?? statusConfig.active
                    return (
                        <div key={t.id}
                            className="rounded-xl border border-default bg-surface-0 p-4 shadow-card hover:shadow-elevated transition-all duration-200 cursor-pointer animate-slide-up"
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
                                        {canUpdate && (
                                            <button title="Editar empresa" disabled={editLoadingId !== null}
                                                onClick={e => { e.stopPropagation(); openEdit(t) }}
                                                className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors disabled:opacity-50">
                                                {editLoadingId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit className="h-4 w-4" />}
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button title="Excluir empresa" disabled={deleteMut.isPending}
                                                onClick={e => { e.stopPropagation(); setShowConfirmDelete(t); setDeleteDependencies(null); setDeleteMessage(null) }}
                                                className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Pagination */}
            {totalCount > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-default bg-surface-0 px-4 py-3">
                    <p className="text-xs text-surface-500">
                        Mostrando {((page - 1) * PER_PAGE) + 1}—{Math.min(page * PER_PAGE, totalCount)} de {totalCount}
                    </p>
                    <div className="flex items-center gap-1">
                        <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                            className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            aria-label="Página anterior">
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="min-w-[3rem] text-center text-xs font-medium text-surface-700">{page} / {lastPage}</span>
                        <button type="button" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}
                            className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            aria-label="Próxima página">
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={tryCloseModal}>
                    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-surface-0 p-6 shadow-xl animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-sm font-semibold text-surface-900">{selectedTenant ? 'Editar Empresa' : 'Nova Empresa'}</h2>
                            <button onClick={tryCloseModal} className="rounded-lg p-1 hover:bg-surface-100" aria-label="Fechar modal"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="space-y-4">
                            {/* CNPJ/CPF com consulta automática */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative">
                                    <Input label="CNPJ/CPF" value={form.document}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setForm(f => ({ ...f, document: formatDocument(e.target.value) })); setFormErrors(p => ({ ...p, document: undefined })) }}
                                        onBlur={handleCnpjBlur}
                                        maxLength={18} placeholder="00.000.000/0000-00" />
                                    {cnpjLookup.loading && <Loader2 className="absolute right-2 top-8 h-4 w-4 animate-spin text-brand-500" />}
                                    {formErrors.document && <p className="text-xs text-red-500 mt-0.5">{formErrors.document}</p>}
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium text-surface-700 mb-1">Status</label>
                                    <select value={form.status} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, status: e.target.value }))}
                                        aria-label="Status da empresa"
                                        className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                                        <option value="active">Ativo</option>
                                        <option value="trial">Teste</option>
                                        <option value="inactive">Inativo</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Input label="Razão Social *" value={form.name}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setForm(f => ({ ...f, name: e.target.value })); setFormErrors(p => ({ ...p, name: undefined })) }} />
                                    {formErrors.name && <p className="text-xs text-red-500 mt-0.5">{formErrors.name}</p>}
                                </div>
                                <Input label="Nome Fantasia" value={form.trade_name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, trade_name: e.target.value }))} />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Input label="E-mail" type="email" value={form.email}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setForm(f => ({ ...f, email: e.target.value })); setFormErrors(p => ({ ...p, email: undefined })) }} />
                                    {formErrors.email && <p className="text-xs text-red-500 mt-0.5">{formErrors.email}</p>}
                                </div>
                                <Input label="Telefone" value={form.phone}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, phone: maskPhone(e.target.value) }))}
                                    maxLength={15} placeholder="(00) 00000-0000" />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <Input label="Website" value={form.website} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setForm(f => ({ ...f, website: e.target.value })); setFormErrors(p => ({ ...p, website: undefined })) }} placeholder="https://... ou www.exemplo.com" />
                                    {formErrors.website && <p className="text-xs text-red-500 mt-0.5">{formErrors.website}</p>}
                                </div>
                                <Input label="Insc. Estadual" value={form.state_registration} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, state_registration: e.target.value }))} />
                                <Input label="Insc. Municipal" value={form.city_registration} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, city_registration: e.target.value }))} />
                            </div>

                            {/* Endereço */}
                            <div className="border-t border-default pt-4 mt-2">
                                <p className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-3">Endereço</p>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="relative">
                                            <Input label="CEP" value={form.address_zip}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, address_zip: formatCep(e.target.value) }))}
                                                onBlur={handleCepBlur}
                                                maxLength={9} placeholder="00000-000" />
                                            {viaCep.loading && <Loader2 className="absolute right-2 top-8 h-4 w-4 animate-spin text-brand-500" />}
                                        </div>
                                        <div className="col-span-2">
                                            <Input label="Rua" value={form.address_street} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, address_street: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <Input label="Número" value={form.address_number} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, address_number: e.target.value }))} />
                                        <Input label="Complemento" value={form.address_complement} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, address_complement: e.target.value }))} />
                                        <Input label="Bairro" value={form.address_neighborhood} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, address_neighborhood: e.target.value }))} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="mb-1 block text-[13px] font-medium text-surface-700">UF</label>
                                            <select value={form.address_state}
                                                onChange={e => setForm(f => ({ ...f, address_state: e.target.value, address_city: '' }))}
                                                aria-label="UF"
                                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                                                <option value="">Selecione</option>
                                                {ibgeStates.map(s => <option key={s.abbr} value={s.abbr}>{s.abbr} — {s.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[13px] font-medium text-surface-700">Cidade</label>
                                            <select value={form.address_city}
                                                onChange={e => setForm(f => ({ ...f, address_city: e.target.value }))}
                                                aria-label="Cidade"
                                                disabled={!form.address_state}
                                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-50">
                                                <option value="">{form.address_state ? 'Selecione' : 'Selecione o UF primeiro'}</option>
                                                {ibgeCities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {cnpjLookup.loading && (
                                <div className="flex items-center gap-2 rounded-lg bg-brand-50 p-3 text-xs text-brand-700">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Consultando CNPJ na Receita Federal...
                                </div>
                            )}
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <Button variant="outline" onClick={tryCloseModal}>Cancelar</Button>
                            <Button onClick={() => { if (validateForm()) saveMut.mutate(form) }} loading={saveMut.isPending}>
                                {selectedTenant ? 'Salvar' : 'Criar'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Panel */}
            {detailTenant && (
                <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDetailTenant(null)}>
                    <div className="fixed inset-0 bg-black/30" />
                    <div className="relative h-full w-full max-w-lg bg-surface-0 shadow-xl animate-slide-in-right overflow-y-auto"
                        onClick={e => e.stopPropagation()}>
                        <div className="sticky top-0 bg-surface-0 border-b border-subtle p-4 flex items-center justify-between z-10">
                            <h2 className="text-sm font-semibold text-surface-900">{detailTenant.name}</h2>
                            <button onClick={() => setDetailTenant(null)} className="rounded-lg p-1 hover:bg-surface-100" aria-label="Fechar painel"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="p-5 space-y-5">
                            {/* Info */}
                            <div className="rounded-xl border border-default p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-surface-700">Informações</h3>
                                {detail && (
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div><span className="text-surface-500">CNPJ:</span> <span className="font-medium">{detail.document || '—'}</span></div>
                                        <div><span className="text-surface-500">E-mail:</span> <span className="font-medium">{detail.email || '—'}</span></div>
                                        <div><span className="text-surface-500">Telefone:</span> <span className="font-medium">{detail.phone || '—'}</span></div>
                                        <div><span className="text-surface-500">Status:</span> <Badge variant={statusConfig[detail.status]?.variant}>{statusConfig[detail.status]?.label}</Badge></div>
                                        {detail.trade_name && <div><span className="text-surface-500">Fantasia:</span> <span className="font-medium">{detail.trade_name}</span></div>}
                                        {detail.website && (
                                            <div><span className="text-surface-500">Website:</span>{' '}
                                                <a href={detail.website} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:underline inline-flex items-center gap-1">
                                                    {detail.website.replace(/^https?:\/\//, '')} <ExternalLink className="h-3 w-3" />
                                                </a>
                                            </div>
                                        )}
                                        {detail.state_registration && <div><span className="text-surface-500">Insc. Estadual:</span> <span className="font-medium">{detail.state_registration}</span></div>}
                                        {detail.city_registration && <div><span className="text-surface-500">Insc. Municipal:</span> <span className="font-medium">{detail.city_registration}</span></div>}
                                        {detail.full_address && (
                                            <div className="col-span-2">
                                                <span className="text-surface-500">Endereço:</span>{' '}
                                                <span className="font-medium">{detail.full_address}</span>
                                            </div>
                                        )}
                                        <div className="col-span-2 flex items-center gap-4 pt-2 border-t border-subtle text-xs text-surface-400">
                                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Criado em {formatDateBr(detail.created_at)}</span>
                                            <span>Atualizado em {formatDateBr(detail.updated_at)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Users */}
                            <div className="rounded-xl border border-default p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-surface-700">
                                        Usuários ({detail?.users?.length ?? 0})
                                    </h3>
                                    {canCreate && (
                                        <Button size="sm" variant="outline" icon={<UserPlus className="h-3.5 w-3.5" />}
                                            onClick={() => setShowInviteModal(true)}>
                                            Convidar
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {(detail?.users ?? []).map((u) => (
                                        <div key={u.id} className="flex items-center justify-between rounded-lg bg-surface-50 p-3">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                                                    {u.name?.charAt(0)?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-[13px] font-medium text-surface-900">{u.name}</p>
                                                    <p className="text-xs text-surface-500">{u.email}</p>
                                                </div>
                                            </div>
                                            {canUpdate && (
                                                <button title="Remover usuário" onClick={() => setShowConfirmRemoveUser(u)}
                                                    className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                                    <UserMinus className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {(detail?.users ?? []).length === 0 && (
                                        <p className="text-xs text-surface-400">Nenhum usuário vinculado</p>
                                    )}
                                </div>
                            </div>

                            {/* Branches */}
                            <div className="rounded-xl border border-default p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-surface-700">
                                    Filiais ({detail?.branches?.length ?? 0})
                                </h3>
                                <div className="space-y-2">
                                    {(detail?.branches ?? []).map((b) => (
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
                    <div className="w-full max-w-sm rounded-2xl bg-surface-0 p-6 shadow-xl animate-scale-in" onClick={e => e.stopPropagation()}>
                        <h2 className="text-sm font-semibold text-surface-900 mb-4">Convidar Usuário</h2>
                        <div className="space-y-4">
                            <Input label="Nome *" value={inviteForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteForm(f => ({ ...f, name: e.target.value }))} />
                            <Input label="E-mail *" type="email" value={inviteForm.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteForm(f => ({ ...f, email: e.target.value }))} />
                            <div>
                                <label className="block text-[13px] font-medium text-surface-700 mb-1">Papel (role)</label>
                                <select value={inviteForm.role}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInviteForm(f => ({ ...f, role: e.target.value }))}
                                    aria-label="Papel do usuário"
                                    className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                                    <option value="">Sem papel específico</option>
                                    {availableRoles.map(r => (
                                        <option key={r.name} value={r.name}>{r.display_name}</option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-xs text-surface-400">
                                Se o e-mail não existir, o usuário será criado e receberá um link para definir a senha.
                            </p>
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowInviteModal(false)}>Cancelar</Button>
                            <Button onClick={() => {
                                if (!isValidEmail(inviteForm.email)) {
                                    toast.error('Informe um e-mail válido.')
                                    return
                                }
                                inviteMut.mutate(inviteForm)
                            }} loading={inviteMut.isPending}
                                disabled={!inviteForm.name.trim() || !inviteForm.email.trim()}>Convidar</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {showConfirmDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => { setShowConfirmDelete(null); setDeleteDependencies(null); setDeleteMessage(null) }}>
                    <div className="w-full max-w-sm rounded-2xl bg-surface-0 p-6 shadow-xl animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-surface-900">Excluir Empresa</h2>
                                <p className="text-sm text-surface-500">Esta ação não pode ser desfeita.</p>
                            </div>
                        </div>

                        {deleteMessage && (
                            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-100 mb-4">
                                <p className="font-medium mb-1">Não é possível excluir:</p>
                                <p>{deleteMessage}</p>
                            </div>
                        )}

                        {deleteDependencies && (
                            <div className="space-y-2 mb-4">
                                <p className="text-xs font-medium text-surface-600 uppercase tracking-wide">Vínculos encontrados:</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(deleteDependencies).map(([key, count]) => (
                                        <div key={key} className="flex items-center justify-between rounded bg-surface-50 px-3 py-2 text-sm border border-default">
                                            <span className="text-surface-600">{depLabels[key] ?? key}</span>
                                            <Badge variant="neutral">{String(count)}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!deleteDependencies && (
                            <p className="text-sm text-surface-700 mb-5">
                                Tem certeza que deseja excluir a empresa <strong>{showConfirmDelete.name}</strong>?
                            </p>
                        )}

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => { setShowConfirmDelete(null); setDeleteDependencies(null); setDeleteMessage(null) }}>Cancelar</Button>
                            {deleteDependencies ? (
                                <Button variant="ghost" disabled className="text-surface-400 cursor-not-allowed">
                                    Resolva as pendências acima
                                </Button>
                            ) : (
                                <Button className="bg-red-600 hover:bg-red-700 text-white" loading={deleteMut.isPending}
                                    onClick={() => deleteMut.mutate(showConfirmDelete.id)}>Excluir</Button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Remove User Modal */}
            {showConfirmRemoveUser && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setShowConfirmRemoveUser(null)}>
                    <div className="w-full max-w-sm rounded-2xl bg-surface-0 p-6 shadow-xl animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                                <UserMinus className="h-5 w-5 text-amber-600" />
                            </div>
                            <h2 className="text-sm font-semibold text-surface-900">Remover Usuário</h2>
                        </div>
                        <p className="text-sm text-surface-700 mb-5">
                            Remover <strong>{showConfirmRemoveUser.name}</strong> desta empresa?
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowConfirmRemoveUser(null)}>Cancelar</Button>
                            <Button className="bg-red-600 hover:bg-red-700 text-white" loading={removeUserMut.isPending}
                                onClick={() => removeUserMut.mutate(showConfirmRemoveUser.id)}>Remover</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
