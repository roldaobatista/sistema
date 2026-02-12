import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    User, Mail, Phone, Shield, Building2, Key, Save, CheckCircle, Eye, EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/stores/auth-store'

export function ProfilePage() {
    const qc = useQueryClient()
    const { setUser } = useAuthStore()
    const [showPassword, setShowPassword] = useState(false)
    const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', new_password_confirmation: '' })
    const [saved, setSaved] = useState(false)
    const [pwSaved, setPwSaved] = useState(false)

    const { data: res, isLoading } = useQuery({
        queryKey: ['profile'],
        queryFn: () => api.get('/profile'),
    })
    const profile = res?.data

    const [form, setForm] = useState<{ name: string; email: string; phone: string }>({
        name: '', email: '', phone: '',
    })

    const isFormLoaded = form.name !== '' || form.email !== ''

    if (profile && !isFormLoaded) {
        setForm({ name: profile.name ?? '', email: profile.email ?? '', phone: profile.phone ?? '' })
    }

    const updateMut = useMutation({
        mutationFn: (data: typeof form) => api.put('/profile', data),
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ['profile'] })
            if (res.data?.user) setUser(res.data.user)
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        },
        onError: (err: any) => {
            if (err.response?.status === 422 && err.response?.data?.errors) {
                const firstError = Object.values(err.response.data.errors).flat()[0]
                toast.error(String(firstError) || 'Erro de validação.')
            } else {
                toast.error(err.response?.data?.message ?? 'Erro ao atualizar perfil.')
            }
        },
    })

    const passwordMut = useMutation({
        mutationFn: (data: typeof passwordForm) => api.post('/profile/change-password', data),
        onSuccess: () => {
            toast.success('Senha alterada com sucesso!')
            setPwSaved(true)
            setPasswordForm({ current_password: '', new_password: '', new_password_confirmation: '' })
            setTimeout(() => setPwSaved(false), 3000)
        },
        onError: (err: any) => {
            if (err.response?.status === 422 && err.response?.data?.errors) {
                const firstError = Object.values(err.response.data.errors).flat()[0]
                toast.error(String(firstError) || 'Erro de validação.')
            } else {
                toast.error(err.response?.data?.message ?? 'Erro ao alterar senha.')
            }
        },
    })

    const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(f => ({ ...f, [key]: e.target.value }))

    const setPw = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setPasswordForm(f => ({ ...f, [key]: e.target.value }))

    if (isLoading || !profile) {
        return (
            <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
                <div className="flex items-center gap-4">
                    <div className="skeleton h-16 w-16 rounded-2xl" />
                    <div>
                        <div className="skeleton h-7 w-40" />
                        <div className="skeleton mt-2 h-4 w-56" />
                    </div>
                </div>
                <div className="skeleton h-56 rounded-xl" />
                <div className="skeleton h-48 rounded-xl" />
                <div className="skeleton h-36 rounded-xl" />
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-bold text-white shadow-lg">
                    {profile.name?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">{profile.name}</h1>
                    <p className="text-[13px] text-surface-500">{profile.email}</p>
                    <div className="mt-1 flex items-center gap-2">
                        {profile.roles?.map((r: string) => (
                            <Badge key={r} variant="brand">{r}</Badge>
                        ))}
                    </div>
                </div>
            </div>

            {/* Dados pessoais */}
            <div className="animate-slide-up rounded-xl border border-default bg-surface-0 p-6 shadow-card hover:shadow-elevated transition-shadow duration-200">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-surface-900">
                    <User className="h-5 w-5 text-brand-500" />
                    Dados Pessoais
                </h2>
                <form onSubmit={e => { e.preventDefault(); updateMut.mutate(form) }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Nome" value={form.name} onChange={set('name')} required />
                        <Input label="Telefone" value={form.phone} onChange={set('phone')} />
                    </div>
                    <Input label="E-mail" type="email" value={form.email} onChange={set('email')} required />
                    <div className="flex items-center justify-between">
                        {saved && (
                            <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                                <CheckCircle className="h-4 w-4" /> Salvo com sucesso
                            </span>
                        )}
                        <div className="ml-auto" />
                        <Button type="submit" loading={updateMut.isPending} icon={<Save className="h-4 w-4" />}>
                            Salvar Alterações
                        </Button>
                    </div>
                </form>
            </div>

            {/* Alterar Senha */}
            <div className="animate-slide-up stagger-2 rounded-xl border border-default bg-surface-0 p-6 shadow-card hover:shadow-elevated transition-shadow duration-200">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-surface-900">
                    <Key className="h-5 w-5 text-brand-500" />
                    Alterar Senha
                </h2>
                <form onSubmit={e => { e.preventDefault(); passwordMut.mutate(passwordForm) }} className="space-y-4">
                    <Input
                        label="Senha Atual"
                        type={showPassword ? 'text' : 'password'}
                        value={passwordForm.current_password}
                        onChange={setPw('current_password')}
                        required
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Nova Senha"
                            type={showPassword ? 'text' : 'password'}
                            value={passwordForm.new_password}
                            onChange={setPw('new_password')}
                            required
                        />
                        <Input
                            label="Confirmar Nova Senha"
                            type={showPassword ? 'text' : 'password'}
                            value={passwordForm.new_password_confirmation}
                            onChange={setPw('new_password_confirmation')}
                            required
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700"
                        >
                            {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            {showPassword ? 'Ocultar senhas' : 'Mostrar senhas'}
                        </button>
                        <div className="flex items-center gap-3">
                            {pwSaved && (
                                <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                                    <CheckCircle className="h-4 w-4" /> Senha alterada
                                </span>
                            )}
                            <Button type="submit" loading={passwordMut.isPending} icon={<Save className="h-4 w-4" />}>
                                Alterar Senha
                            </Button>
                        </div>
                    </div>
                    {passwordMut.isError && (
                        <p className="text-sm text-red-600">
                            {(passwordMut.error as any)?.response?.data?.message || 'Erro ao alterar senha'}
                        </p>
                    )}
                </form>
            </div>

            {/* Info card */}
            <div className="animate-slide-up stagger-3 rounded-xl border border-default bg-surface-0 p-6 shadow-card hover:shadow-elevated transition-shadow duration-200">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-surface-900">
                    <Shield className="h-5 w-5 text-brand-500" />
                    Informações da Conta
                </h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-surface-500">Tenant</span>
                        <p className="mt-0.5 flex items-center gap-1.5 font-medium text-surface-800">
                            <Building2 className="h-3.5 w-3.5 text-brand-500" />
                            {profile.tenant?.name ?? '—'}
                        </p>
                    </div>
                    <div>
                        <span className="text-surface-500">Permissões</span>
                        <p className="mt-0.5 font-medium text-surface-800">{profile.permissions?.length ?? 0} atribuídas</p>
                    </div>
                    <div>
                        <span className="text-surface-500">Membro desde</span>
                        <p className="mt-0.5 font-medium text-surface-800">
                            {profile.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '—'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
