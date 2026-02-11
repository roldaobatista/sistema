import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Search, Trash2, UserCheck, UserX, KeyRound } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

interface Role {
    id: number
    name: string
}

interface User {
    id: number
    name: string
    email: string
    phone: string | null
    is_active: boolean
    roles: Role[]
}

interface UserFormData {
    name: string
    email: string
    phone: string
    password: string
    roles: number[]
    is_active: boolean
}

export function UsersPage() {
    const queryClient = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('iam.user.create')
    const canUpdate = hasPermission('iam.user.update')
    const canDelete = hasPermission('iam.user.delete')
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [formData, setFormData] = useState<UserFormData>({
        name: '', email: '', phone: '', password: '', roles: [], is_active: true,
    })
    const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
    const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null)
    const [newPassword, setNewPassword] = useState('')
    const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('')

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
        queryKey: ['users', page, search],
        queryFn: () => api.get('/users', { params: { page, search, per_page: 20 } }).then(r => r.data),
    })

    const users: User[] = data?.data ?? []
    const lastPage = data?.last_page ?? 1
    const totalUsers = data?.total ?? 0

    const { data: rolesData } = useQuery({
        queryKey: ['roles'],
        queryFn: () => api.get('/roles').then(r => r.data),
    })
    const roles: Role[] = rolesData?.data ?? rolesData ?? []

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

    const openCreate = () => {
        setEditingUser(null)
        setFormData({ name: '', email: '', phone: '', password: '', roles: [], is_active: true })
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
        })
        setFormErrors({})
        setShowForm(true)
    }

    const closeForm = () => {
        setShowForm(false)
        setEditingUser(null)
        setFormData({ name: '', email: '', phone: '', password: '', roles: [], is_active: true })
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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Usuários</h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Gerencie os usuários do sistema</p>
                </div>
                {canCreate && (
                    <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                        Novo Usuário
                    </Button>
                )}
            </div>

            {/* Search */}
            <div className="max-w-sm">
                <div className="relative">
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

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500">Nome</th>
                            <th className="px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500">E-mail</th>
                            <th className="px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500">Roles</th>
                            <th className="px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500">Status</th>
                            <th className="px-3.5 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-surface-500">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading ? (
                            <tr><td colSpan={5} className="px-4 py-12 text-center text-[13px] text-surface-500">Carregando...</td></tr>
                        ) : isError ? (
                            <tr><td colSpan={5} className="px-4 py-12 text-center">
                                <p className="text-sm text-red-500">Erro ao carregar usuários.</p>
                                <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>Tentar novamente</Button>
                            </td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-12 text-center text-[13px] text-surface-500">Nenhum usuário encontrado</td></tr>
                        ) : users.map((user) => (
                            <tr key={user.id} className="hover:bg-surface-50 transition-colors duration-100">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-bold">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-medium text-surface-900">{user.name}</p>
                                            <p className="text-xs text-surface-500">{user.phone ?? '—'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-[13px] text-surface-600">{user.email}</td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                        {user.roles.map(role => (
                                            <Badge key={role.id} variant="brand">{role.name}</Badge>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <Badge variant={user.is_active ? 'success' : 'danger'} dot>
                                        {user.is_active ? 'Ativo' : 'Inativo'}
                                    </Badge>
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
                                        {canDelete && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => { if (confirm('Excluir este usuário?')) deleteMutation.mutate(user.id) }}
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
                        <p className="text-[13px] text-surface-500">
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

            {/* Modal Form */}
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
                            error={formErrors.name}
                            required
                        />
                        <Input
                            label="E-mail"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            error={formErrors.email}
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
                            error={formErrors.password}
                            required={!editingUser}
                        />
                    </div>

                    {/* Roles */}
                    <div>
                        <label className="mb-2 block text-[13px] font-medium text-surface-700">Roles</label>
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
                                            : 'border-default bg-surface-50 text-surface-600 hover:border-surface-400'
                                    )}
                                >
                                    {role.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status Ativo */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                            className={cn(
                                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                                formData.is_active ? 'bg-brand-500' : 'bg-surface-300'
                            )}
                        >
                            <span className={cn(
                                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                                formData.is_active ? 'translate-x-6' : 'translate-x-1'
                            )} />
                        </button>
                        <span className="text-[13px] font-medium text-surface-700">
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

            {/* Modal Reset Password */}
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
        </div>
    )
}
