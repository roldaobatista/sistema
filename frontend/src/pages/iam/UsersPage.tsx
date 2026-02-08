import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, MoreHorizontal, UserCheck, UserX, KeyRound, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'

interface User {
    id: number
    name: string
    email: string
    phone: string | null
    is_active: boolean
    roles: { id: number; name: string }[]
    created_at: string
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
    const [search, setSearch] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [formData, setFormData] = useState<UserFormData>({
        name: '', email: '', phone: '', password: '', roles: [], is_active: true,
    })
    const [formErrors, setFormErrors] = useState<Record<string, string>>({})

    // Queries
    const { data: usersResponse, isLoading } = useQuery({
        queryKey: ['users', search],
        queryFn: () => api.get('/users', { params: { search, per_page: 50 } }),
    })

    const { data: rolesResponse } = useQuery({
        queryKey: ['roles'],
        queryFn: () => api.get('/roles'),
    })

    const users: User[] = usersResponse?.data?.data ?? []
    const roles = rolesResponse?.data ?? []

    // Mutations
    const saveMutation = useMutation({
        mutationFn: (data: UserFormData) =>
            editingUser
                ? api.put(`/users/${editingUser.id}`, data)
                : api.post('/users', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            closeForm()
        },
        onError: (err: any) => {
            setFormErrors(err.response?.data?.errors ?? {})
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/users/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    })

    const toggleMutation = useMutation({
        mutationFn: (id: number) => api.post(`/users/${id}/toggle-active`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Usuários</h1>
                    <p className="mt-1 text-sm text-surface-500">Gerencie os usuários do sistema</p>
                </div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                    Novo Usuário
                </Button>
            </div>

            {/* Search */}
            <div className="max-w-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por nome ou email..."
                        className="w-full rounded-lg border border-surface-300 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-surface-200 bg-surface-50">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">Nome</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">E-mail</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">Roles</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">Status</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-600">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                        {isLoading ? (
                            <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-surface-500">Carregando...</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-surface-500">Nenhum usuário encontrado</td></tr>
                        ) : users.map((user) => (
                            <tr key={user.id} className="hover:bg-surface-50 transition-colors">
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
                                        <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                                            Editar
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleMutation.mutate(user.id)}
                                            title={user.is_active ? 'Desativar' : 'Ativar'}
                                        >
                                            {user.is_active ? <UserX className="h-4 w-4 text-red-500" /> : <UserCheck className="h-4 w-4 text-emerald-500" />}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => { if (confirm('Excluir este usuário?')) deleteMutation.mutate(user.id) }}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
                                            : 'border-surface-300 bg-white text-surface-600 hover:border-surface-400'
                                    )}
                                >
                                    {role.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-surface-200 pt-4">
                        <Button variant="outline" type="button" onClick={closeForm}>
                            Cancelar
                        </Button>
                        <Button type="submit" loading={saveMutation.isPending}>
                            {editingUser ? 'Salvar' : 'Criar Usuário'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
