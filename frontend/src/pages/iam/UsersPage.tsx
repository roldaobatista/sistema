import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Search, Trash2, UserCheck, UserX, KeyRound, Download, CheckSquare, Square, Monitor, LogOut, Users, UserPlus, UserMinus, AlertCircle, History } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/pageheader'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth-store'

interface Role {
    id: number
    name: string
    display_name?: string | null
    label?: string
}

interface User {
    id: number
    name: string
    email: string
    phone: string | null
    is_active: boolean
    roles: Role[]
    branch_id?: number | null
    last_login_at: string | null
    created_at: string | null
}

interface UserFormData {
    name: string
    email: string
    phone: string
    password: string
    roles: number[]
    is_active: boolean
    branch_id: number | null
}

interface Branch {
    id: number
    name: string
}

export function UsersPage() {
    const queryClient = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canView = hasPermission('iam.user.view')
    const canCreate = hasPermission('iam.user.create')
    const canUpdate = hasPermission('iam.user.update')
    const canDelete = hasPermission('iam.user.delete')
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [formData, setFormData] = useState<UserFormData>({
        name: '', email: '', phone: '', password: '', roles: [], is_active: true, branch_id: null,
    })
    const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
    const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null)
    const [newPassword, setNewPassword] = useState('')
    const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
    const [roleFilter, setRoleFilter] = useState('')
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null)
    const [sessionsUser, setSessionsUser] = useState<User | null>(null)
    const [auditTrailUser, setAuditTrailUser] = useState<User | null>(null)

    const debouncedSearch = useCallback(
        (() => {
            let timer: ReturnType<typeof setTimeout>
            return (val: string) => {
                clearTimeout(timer)
                timer = setTimeout(() => { setSearch(val); setPage(1) }, 300)
            }
        })(),
        []
    )

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['users', page, search, statusFilter, roleFilter],
        queryFn: () => api.get('/users', { params: { page, search, per_page: 20, ...(statusFilter !== 'all' && { is_active: statusFilter === 'active' ? 1 : 0 }), ...(roleFilter && { role: roleFilter }) } }).then(r => r.data),
    })

    const users: User[] = data?.data ?? []
    const lastPage = data?.last_page ?? 1
    const totalUsers = data?.total ?? 0

    const { data: rolesData } = useQuery({
        queryKey: ['roles'],
        queryFn: () => api.get('/roles').then(r => r.data),
    })
    const roles: Role[] = rolesData?.data ?? rolesData ?? []

    const { data: branchesData } = useQuery({
        queryKey: ['branches'],
        queryFn: () => api.get('/branches').then(r => r.data),
    })
    const branches: Branch[] = branchesData?.data ?? branchesData ?? []

    const { data: statsData } = useQuery({
        queryKey: ['users-stats'],
        queryFn: () => api.get('/users/stats').then(r => r.data),
        enabled: canView,
    })

    const saveMutation = useMutation({
        mutationFn: (data: UserFormData) => {
            const payload = { ...data } as Record<string, unknown>
            if (editingUser && (!data.password || data.password.trim() === '')) {
                delete payload.password
            }
            return editingUser
                ? api.put(`/users/${editingUser.id}`, payload)
                : api.post('/users', payload)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            closeForm()
            toast.success(editingUser ? 'Usuário atualizado com sucesso!' : 'Usuário criado com sucesso!')
        },
        onError: (err: any) => {
            setFormErrors(err.response?.data?.errors ?? {})
            toast.error(err.response?.data?.message ?? 'Erro ao salvar usuário.')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/users/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            setDeleteConfirmUser(null)
            toast.success('Usuário excluído com sucesso!')
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message ?? 'Erro ao excluir usuário.')
        },
    })

    const toggleMutation = useMutation({
        mutationFn: (id: number) => api.post(`/users/${id}/toggle-active`),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            const isActive = data.data.is_active
            toast.success(`Usuário ${isActive ? 'ativado' : 'desativado'} com sucesso!`)
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message ?? 'Erro ao alterar status do usuário.')
        },
    })

    const resetPasswordMutation = useMutation({
        mutationFn: ({ userId, password, password_confirmation }: { userId: number; password: string; password_confirmation: string }) =>
            api.post(`/users/${userId}/reset-password`, { password, password_confirmation }),
        onSuccess: () => {
            setResetPasswordUser(null)
            setNewPassword('')
            setNewPasswordConfirmation('')
            toast.success('Senha redefinida com sucesso!')
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message ?? 'Erro ao redefinir senha.')
        },
    })

    const bulkToggleMutation = useMutation({
        mutationFn: (data: { user_ids: number[]; is_active: boolean }) =>
            api.post('/users/bulk-toggle-active', data),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            setSelectedIds([])
            toast.success(res.data?.message ?? 'Status alterado com sucesso!')
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message ?? 'Erro ao alterar status em lote.')
        },
    })

    const sessionsQuery = useQuery({
        queryKey: ['user-sessions', sessionsUser?.id],
        queryFn: () => api.get(`/users/${sessionsUser!.id}/sessions`).then(r => r.data),
        enabled: !!sessionsUser,
    })

    const revokeSessionMutation = useMutation({
        mutationFn: ({ userId, tokenId }: { userId: number; tokenId: number }) =>
            api.delete(`/users/${userId}/sessions/${tokenId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user-sessions', sessionsUser?.id] })
            toast.success('Sessão revogada com sucesso!')
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message ?? 'Erro ao revogar sessão.')
        },
    })

    const forceLogoutMutation = useMutation({
        mutationFn: (userId: number) => api.post(`/users/${userId}/force-logout`),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['user-sessions'] })
            toast.success(res.data?.message ?? 'Sessões revogadas com sucesso!')
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message ?? 'Erro ao revogar sessões.')
        },
    })

    const handleExportCsv = () => {
        api.get('/users/export', { responseType: 'blob' }).then((res) => {
            const url = URL.createObjectURL(res.data)
            const link = document.createElement('a')
            link.href = url
            link.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`
            link.click()
            URL.revokeObjectURL(url)
        }).catch(() => toast.error('Erro ao exportar CSV.'))
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === users.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(users.map(u => u.id))
        }
    }

    const toggleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const openCreate = () => {
        setEditingUser(null)
        setFormData({ name: '', email: '', phone: '', password: '', roles: [], is_active: true, branch_id: null })
        setFormErrors({})
        setShowForm(true)
    }

    const openEdit = (user: User) => {
        setEditingUser(user)
        setFormData({
            name: user.name,
            email: user.email,
            phone: user.phone ?? '',
            password: '',
            roles: user.roles.map(r => r.id),
            is_active: user.is_active,
            branch_id: user.branch_id ?? null,
        })
        setFormErrors({})
        setShowForm(true)
    }

    const closeForm = () => {
        setShowForm(false)
        setEditingUser(null)
        setFormData({ name: '', email: '', phone: '', password: '', roles: [], is_active: true, branch_id: null })
        setFormErrors({})
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        saveMutation.mutate(formData)
    }

    const toggleRole = (roleId: number) => {
        setFormData(prev => ({
            ...prev,
            roles: prev.roles.includes(roleId)
                ? prev.roles.filter(r => r !== roleId)
                : [...prev.roles, roleId],
        }))
    }

    return (
        <div className="space-y-5">
            <PageHeader
                title="Usuários"
                subtitle="Gerencie os usuários do sistema"
                count={totalUsers}
                actions={[
                    ...(canView ? [{ label: 'Exportar CSV', onClick: handleExportCsv, icon: <Download className="h-4 w-4" />, variant: 'outline' as const }] : []),
                    ...(canCreate ? [{ label: 'Novo Usuário', onClick: openCreate, icon: <Plus className="h-4 w-4" /> }] : []),
                ]}
            />

            {canView && statsData && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-brand-50 p-2.5"><Users className="h-5 w-5 text-brand-600" /></div>
                            <div>
                                <p className="text-2xl font-bold text-surface-900">{statsData.total}</p>
                                <p className="text-xs text-surface-500">Total de usuários</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-emerald-50 p-2.5"><UserPlus className="h-5 w-5 text-emerald-600" /></div>
                            <div>
                                <p className="text-2xl font-bold text-emerald-700">{statsData.active}</p>
                                <p className="text-xs text-surface-500">Ativos</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-red-50 p-2.5"><UserMinus className="h-5 w-5 text-red-600" /></div>
                            <div>
                                <p className="text-2xl font-bold text-red-700">{statsData.inactive}</p>
                                <p className="text-xs text-surface-500">Inativos</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-amber-50 p-2.5"><AlertCircle className="h-5 w-5 text-amber-600" /></div>
                            <div>
                                <p className="text-2xl font-bold text-amber-700">{statsData.never_logged}</p>
                                <p className="text-xs text-surface-500">Nunca logaram</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1 rounded-lg border border-default bg-surface-50 p-1">
                    {([['all', 'Todos'], ['active', 'Ativos'], ['inactive', 'Inativos']] as const).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => { setStatusFilter(key); setPage(1); setSelectedIds([]) }}
                            className={cn(
                                'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                                statusFilter === key
                                    ? 'bg-surface-0 text-surface-900 shadow-sm'
                                    : 'text-surface-500 hover:text-surface-700'
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={roleFilter}
                        onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm text-surface-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                    >
                        <option value="">Todas as roles</option>
                        {roles.map(r => (
                            <option key={r.id} value={r.name}>{r.display_name || r.label || r.name}</option>
                        ))}
                    </select>
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => { setSearchInput(e.target.value); debouncedSearch(e.target.value) }}
                            placeholder="Buscar por nome ou email..."
                            className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                        />
                    </div>
                </div>
            </div>

            {selectedIds.length > 0 && canUpdate && (
                <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5">
                        <span className="text-sm font-medium text-brand-700">
                        {selectedIds.length} selecionado(s)
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => bulkToggleMutation.mutate({ user_ids: selectedIds, is_active: true })}
                            loading={bulkToggleMutation.isPending}
                        >
                            <UserCheck className="h-3.5 w-3.5 mr-1" /> Ativar
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => bulkToggleMutation.mutate({ user_ids: selectedIds, is_active: false })}
                            loading={bulkToggleMutation.isPending}
                        >
                            <UserX className="h-3.5 w-3.5 mr-1" /> Desativar
                        </Button>
                    </div>
                    <button
                        onClick={() => setSelectedIds([])}
                        className="ml-auto text-xs text-surface-500 hover:text-surface-700"
                    >
                        Limpar seleção
                    </button>
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            {canUpdate && (
                                <th className="w-10 px-3 py-2.5">
                                    <button onClick={toggleSelectAll} className="text-surface-400 hover:text-surface-600">
                                        {selectedIds.length === users.length && users.length > 0
                                            ? <CheckSquare className="h-4 w-4 text-brand-500" />
                                            : <Square className="h-4 w-4" />}
                                    </button>
                                </th>
                            )}
                            <th className="px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Nome</th>
                            <th className="px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500">E-mail</th>
                            <th className="px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Roles</th>
                            <th className="px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Status</th>
                            <th className="px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500 hidden lg:table-cell">Último Login</th>
                            <th className="px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-surface-500 hidden xl:table-cell">Criado em</th>
                            <th className="px-3.5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-surface-500">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading ? (
                            <>{[...Array(5)].map((_, i) => (
                                <tr key={`sk-${i}`} className="animate-pulse">
                                    {canUpdate && <td className="w-10 px-3 py-4"><div className="h-4 w-4 rounded bg-surface-200" /></td>}
                                    <td className="px-4 py-4"><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-full bg-surface-200" /><div className="space-y-1.5"><div className="h-3.5 w-28 rounded bg-surface-200" /><div className="h-3 w-16 rounded bg-surface-200" /></div></div></td>
                                    <td className="px-4 py-4"><div className="h-3.5 w-36 rounded bg-surface-200" /></td>
                                    <td className="px-4 py-4"><div className="h-5 w-16 rounded bg-surface-200" /></td>
                                    <td className="px-4 py-4"><div className="h-5 w-14 rounded bg-surface-200" /></td>
                                    <td className="px-4 py-4 hidden lg:table-cell"><div className="h-3.5 w-24 rounded bg-surface-200" /></td>
                                    <td className="px-4 py-4 hidden xl:table-cell"><div className="h-3.5 w-20 rounded bg-surface-200" /></td>
                                    <td className="px-4 py-4"><div className="h-6 w-20 rounded bg-surface-200 ml-auto" /></td>
                                </tr>
                            ))}</>
                        ) : isError ? (
                            <tr><td colSpan={canUpdate ? 8 : 7} className="px-4 py-12 text-center">
                                <p className="text-sm text-red-500">Erro ao carregar usuários.</p>
                                <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>Tentar novamente</Button>
                            </td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={canUpdate ? 8 : 7} className="px-4 py-12 text-center text-sm text-surface-500">Nenhum usuário encontrado</td></tr>
                        ) : users.map((user) => (
                            <tr key={user.id} className="hover:bg-surface-50 transition-colors duration-100">
                                {canUpdate && (
                                    <td className="w-10 px-3 py-3">
                                        <button onClick={() => toggleSelect(user.id)} className="text-surface-400 hover:text-surface-600">
                                            {selectedIds.includes(user.id)
                                                ? <CheckSquare className="h-4 w-4 text-brand-500" />
                                                : <Square className="h-4 w-4" />}
                                        </button>
                                    </td>
                                )}
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-bold">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-surface-900">{user.name}</p>
                                            <p className="text-xs text-surface-500">{user.phone ?? '—'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-surface-600">{user.email}</td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                        {user.roles.map(role => (
                                            <Badge key={role.id} variant="brand">{role.display_name || role.label || role.name}</Badge>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <Badge variant={user.is_active ? 'success' : 'danger'} dot>
                                        {user.is_active ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                </td>
                                <td className="px-4 py-3 hidden lg:table-cell">
                                    <span className="text-xs text-surface-500">
                                        {user.last_login_at
                                            ? new Date(user.last_login_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                                            : 'Nunca'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 hidden xl:table-cell">
                                    <span className="text-xs text-surface-500">
                                        {user.created_at
                                            ? new Date(user.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                            : '—'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                        {canUpdate && (
                                            <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                                                Editar
                                            </Button>
                                        )}
                                        {canUpdate && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleMutation.mutate(user.id)}
                                                title={user.is_active ? 'Desativar' : 'Ativar'}
                                            >
                                                {user.is_active ? <UserX className="h-4 w-4 text-red-500" /> : <UserCheck className="h-4 w-4 text-emerald-500" />}
                                            </Button>
                                        )}
                                        {canUpdate && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => { setResetPasswordUser(user); setNewPassword('') }}
                                                title="Redefinir Senha"
                                            >
                                                <KeyRound className="h-4 w-4 text-amber-500" />
                                            </Button>
                                        )}
                                        {canUpdate && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSessionsUser(user)}
                                                title="Sessões Ativas"
                                            >
                                                <Monitor className="h-4 w-4 text-blue-500" />
                                            </Button>
                                        )}
                                        {canUpdate && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setAuditTrailUser(user)}
                                                title="Histórico de Ações"
                                            >
                                                <History className="h-4 w-4 text-purple-500" />
                                            </Button>
                                        )}
                                        {canUpdate && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => forceLogoutMutation.mutate(user.id)}
                                                title="Encerrar Todas as Sessões"
                                                loading={forceLogoutMutation.isPending}
                                            >
                                                <LogOut className="h-4 w-4 text-orange-500" />
                                            </Button>
                                        )}
                                        {canDelete && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setDeleteConfirmUser(user)}
                                            >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Paginação */}
                {lastPage > 1 && (
                    <div className="flex items-center justify-between border-t border-subtle px-4 py-3">
                        <p className="text-sm text-surface-500">
                            Mostrando página {page} de {lastPage} ({totalUsers} usuários)
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                            >
                                Anterior
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= lastPage}
                                onClick={() => setPage(p => p + 1)}
                            >
                                Próximo
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <Modal
                open={showForm}
                onOpenChange={setShowForm}
                title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            label="Nome"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            error={formErrors.name?.[0]}
                            required
                        />
                        <Input
                            label="E-mail"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            error={formErrors.email?.[0]}
                            required
                        />
                        <Input
                            label="Telefone"
                            value={formData.phone}
                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="(00) 00000-0000"
                        />
                        <Input
                            label={editingUser ? 'Nova Senha (deixe vazio para manter)' : 'Senha'}
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                            error={formErrors.password?.[0]}
                            required={!editingUser}
                        />
                    </div>

                    {branches.length > 0 && (
                        <div>
                            <label className="mb-1 block text-sm font-medium text-surface-700">Filial</label>
                            <select
                                value={formData.branch_id ?? ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, branch_id: e.target.value ? Number(e.target.value) : null }))}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm text-surface-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                            >
                                <option value="">Sem filial</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Roles */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-surface-700">Roles</label>
                        <div className="flex flex-wrap gap-2">
                            {roles.map((role: any) => (
                                <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => toggleRole(role.id)}
                                    className={cn(
                                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                                        formData.roles.includes(role.id)
                                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                                            : 'border-default text-surface-600 hover:border-surface-400'
                                    )}
                                >
                                    {role.display_name || role.label || role.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                            className={cn(
                                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                                formData.is_active ? 'bg-brand-500' : 'bg-surface-400'
                            )}
                        >
                            <span className={cn(
                                'inline-block h-4 w-4 transform rounded-full bg-surface-0 transition-transform',
                                formData.is_active ? 'translate-x-6' : 'translate-x-1'
                            )} />
                        </button>
                        <span className="text-sm font-medium text-surface-700">
                            {formData.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" type="button" onClick={closeForm}>
                            Cancelar
                        </Button>
                        <Button type="submit" loading={saveMutation.isPending}>
                            {editingUser ? 'Salvar' : 'Criar Usuário'}
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                open={!!resetPasswordUser}
                onOpenChange={(open) => { if (!open) { setResetPasswordUser(null); setNewPassword(''); setNewPasswordConfirmation('') } }}
                title={`Redefinir Senha: ${resetPasswordUser?.name ?? ''}`}
                size="sm"
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        if (resetPasswordUser) {
                            resetPasswordMutation.mutate({ userId: resetPasswordUser.id, password: newPassword, password_confirmation: newPasswordConfirmation })
                        }
                    }}
                    className="space-y-4"
                >
                    <Input
                        label="Nova Senha"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        required
                    />
                    <Input
                        label="Confirmar Senha"
                        type="password"
                        value={newPasswordConfirmation}
                        onChange={(e) => setNewPasswordConfirmation(e.target.value)}
                        placeholder="Repita a nova senha"
                        required
                    />
                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" type="button" onClick={() => { setResetPasswordUser(null); setNewPassword(''); setNewPasswordConfirmation('') }}>
                            Cancelar
                        </Button>
                        <Button type="submit" loading={resetPasswordMutation.isPending}>
                            Redefinir Senha
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                open={!!deleteConfirmUser}
                onOpenChange={(open) => { if (!open) setDeleteConfirmUser(null) }}
                title="Confirmar Exclusão"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">
                        Tem certeza que deseja excluir o usuário <strong>{deleteConfirmUser?.name}</strong>?
                        Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" onClick={() => setDeleteConfirmUser(null)}>
                            Cancelar
                        </Button>
                        <Button
                            variant="danger"
                            loading={deleteMutation.isPending}
                            onClick={() => deleteConfirmUser && deleteMutation.mutate(deleteConfirmUser.id)}
                        >
                            Excluir
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                open={!!sessionsUser}
                onOpenChange={(open) => { if (!open) setSessionsUser(null) }}
                title={`Sessões Ativas: ${sessionsUser?.name ?? ''}`}
                size="lg"
            >
                <div className="space-y-3">
                    {sessionsQuery.isLoading ? (
                        <p className="text-center text-sm text-surface-500 py-6">Carregando sessões...</p>
                    ) : sessionsQuery.isError ? (
                        <p className="text-center text-sm text-red-500 py-6">Erro ao carregar sessões.</p>
                    ) : (sessionsQuery.data?.data ?? []).length === 0 ? (
                        <p className="text-center text-sm text-surface-500 py-6">Nenhuma sessão ativa.</p>
                    ) : (
                        (sessionsQuery.data?.data ?? []).map((session: any) => (
                            <div key={session.id} className="flex items-center justify-between rounded-lg border border-default bg-surface-50 px-4 py-3">
                                <div>
                                    <p className="text-sm font-medium text-surface-800">{session.name ?? 'Token'}</p>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
                                        {session.last_used_at && (
                                            <span>
                                                Último uso: {new Date(session.last_used_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                        {session.expires_at && (
                                            <span>
                                                Expira: {new Date(session.expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => revokeSessionMutation.mutate({ userId: sessionsUser!.id, tokenId: session.id })}
                                    loading={revokeSessionMutation.isPending}
                                    title="Revogar Sessão"
                                >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            </div>
                        ))
                    )}
                </div>
                <div className="flex justify-end border-t border-subtle pt-4">
                    <Button variant="outline" onClick={() => setSessionsUser(null)}>
                        Fechar
                    </Button>
                </div>
            </Modal>

            <AuditTrailModal user={auditTrailUser} onClose={() => setAuditTrailUser(null)} />
        </div>
    )
}

function AuditTrailModal({ user, onClose }: { user: User | null; onClose: () => void }) {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['user-audit-trail', user?.id],
        queryFn: () => api.get(`/users/${user!.id}/audit-trail`).then(r => r.data),
        enabled: !!user,
    })
    const entries: any[] = data?.data ?? data ?? []

    const actionColors: Record<string, string> = {
        created: 'bg-emerald-100 text-emerald-700',
        updated: 'bg-blue-100 text-blue-700',
        deleted: 'bg-red-100 text-red-700',
        login: 'bg-purple-100 text-purple-700',
        logout: 'bg-orange-100 text-orange-700',
        status_changed: 'bg-amber-100 text-amber-700',
    }

    const actionLabels: Record<string, string> = {
        created: 'Criado',
        updated: 'Atualizado',
        deleted: 'Excluído',
        login: 'Login',
        logout: 'Logout',
        status_changed: 'Status',
    }

    return (
        <Modal
            open={!!user}
            onOpenChange={(open) => { if (!open) onClose() }}
            title={`Histórico: ${user?.name ?? ''}`}
            size="lg"
        >
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {isLoading ? (
                    <div className="space-y-3 py-2">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="flex gap-3 animate-pulse">
                                <div className="h-6 w-16 rounded bg-surface-200" />
                                <div className="flex-1 space-y-1">
                                    <div className="h-4 w-3/4 rounded bg-surface-200" />
                                    <div className="h-3 w-1/3 rounded bg-surface-200" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : isError ? (
                    <p className="text-center text-sm text-red-500 py-6">Erro ao carregar histórico.</p>
                ) : entries.length === 0 ? (
                    <div className="text-center py-8">
                        <History className="h-8 w-8 text-surface-300 mx-auto mb-2" />
                        <p className="text-sm text-surface-500">Nenhum registro de atividade encontrado.</p>
                    </div>
                ) : (
                    entries.map((entry: any, idx: number) => (
                        <div key={entry.id ?? idx} className="flex items-start gap-3 rounded-lg border border-default bg-surface-50 px-4 py-3">
                            <span className={cn('mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase', actionColors[entry.action] ?? 'bg-surface-200 text-surface-700')}>
                                {actionLabels[entry.action] ?? entry.action}
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-surface-800">{entry.description}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
                                    {entry.created_at && (
                                        <span>
                                            {new Date(entry.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                    {entry.ip_address && <span>IP: {entry.ip_address}</span>}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className="flex justify-end border-t border-subtle pt-4">
                <Button variant="outline" onClick={onClose}>
                    Fechar
                </Button>
            </div>
        </Modal>
    )
}
