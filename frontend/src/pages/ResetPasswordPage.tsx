import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { KeyRound, ArrowLeft, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'

export function ResetPasswordPage() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token') ?? ''
    const emailParam = searchParams.get('email') ?? ''

    const [email, setEmail] = useState(emailParam)
    const [password, setPassword] = useState('')
    const [passwordConfirmation, setPasswordConfirmation] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (password !== passwordConfirmation) {
            setError('As senhas não conferem.')
            return
        }

        setIsLoading(true)

        try {
            const { data } = await api.post('/reset-password', {
                token,
                email,
                password,
                password_confirmation: passwordConfirmation,
            })
            setSuccess(true)
            toast.success(data.message ?? 'Senha redefinida com sucesso!')
        } catch (err: any) {
            const msg = err.response?.data?.message ?? 'Erro ao redefinir senha.'
            setError(msg)
            toast.error(msg)
        } finally {
            setIsLoading(false)
        }
    }

    if (!token) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-surface-50 p-4">
                <div className="w-full max-w-sm text-center space-y-4">
                    <p className="text-sm text-red-600">Link de redefinição inválido. Solicite um novo link.</p>
                    <Link
                        to="/esqueci-senha"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-500"
                    >
                        Solicitar novo link
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-surface-50 p-4">
            <div className="w-full max-w-sm">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-sm">
                        K
                    </div>
                    <h1 className="text-[15px] font-semibold tabular-nums text-surface-900 tracking-tight">KALIBRIUM</h1>
                </div>

                <div className="rounded-xl border border-default bg-surface-0 p-7 shadow-elevated">
                    {success ? (
                        <div className="text-center space-y-4">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                                <CheckCircle className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-surface-900">Senha redefinida!</h2>
                                <p className="mt-1 text-[13px] text-surface-500">
                                    Sua senha foi alterada com sucesso. Faça login com a nova senha.
                                </p>
                            </div>
                            <Link
                                to="/login"
                                className={cn(
                                    'flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm',
                                    'hover:bg-brand-500 transition-colors'
                                )}
                            >
                                Ir para o Login
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="mb-6">
                                <h2 className="text-lg font-semibold text-surface-900 tracking-tight">
                                    Redefinir senha
                                </h2>
                                <p className="mt-0.5 text-[13px] text-surface-500">
                                    Escolha uma nova senha segura para sua conta.
                                </p>
                            </div>

                            {error && (
                                <div className="mb-4 rounded-lg border border-red-200/50 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label htmlFor="reset-email" className="block text-[13px] font-medium text-surface-700">E-mail</label>
                                    <input
                                        id="reset-email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        placeholder="seu@email.com"
                                        className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm text-surface-900 focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-[13px] font-medium text-surface-700">Nova Senha</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Mínimo 8 caracteres, maiúscula e número"
                                            required
                                            minLength={8}
                                            className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 pr-9 text-sm text-surface-900 focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                                        >
                                            {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-[13px] font-medium text-surface-700">Confirmar Senha</label>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={passwordConfirmation}
                                        onChange={(e) => setPasswordConfirmation(e.target.value)}
                                        placeholder="Repita a nova senha"
                                        required
                                        className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm text-surface-900 focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className={cn(
                                        'flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm',
                                        'hover:bg-brand-500 active:bg-brand-700',
                                        'disabled:cursor-not-allowed disabled:opacity-40',
                                        'transition-colors duration-150'
                                    )}
                                >
                                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                                    {isLoading ? 'Redefinindo...' : 'Redefinir Senha'}
                                </button>
                            </form>
                        </>
                    )}

                    <div className="mt-5 text-center">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:text-brand-500 transition-colors"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Voltar ao login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
