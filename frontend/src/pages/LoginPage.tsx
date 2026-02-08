import { useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react'

export function LoginPage() {
    const { login, isLoading } = useAuthStore()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        try {
            await login(email, password)
        } catch (err: unknown) {
            if (err && typeof err === 'object' && 'response' in err) {
                const axiosErr = err as { response?: { data?: { message?: string } } }
                setError(axiosErr.response?.data?.message || 'Credenciais inválidas.')
            } else {
                setError('Erro ao conectar com o servidor.')
            }
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-surface-50 to-brand-100 p-4">
            {/* Background pattern */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-30">
                <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-200 blur-3xl" />
                <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-brand-300 blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Card */}
                <div className="rounded-2xl border border-surface-200 bg-white p-8 shadow-elevated">
                    {/* Logo */}
                    <div className="mb-8 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg">
                            <span className="text-xl font-bold">OS</span>
                        </div>
                        <h1 className="text-2xl font-bold text-surface-900">
                            Sistema OS
                        </h1>
                        <p className="mt-1 text-sm text-surface-500">
                            Entre com suas credenciais para acessar
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-surface-700">
                                E-mail
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                required
                                autoFocus
                                className={cn(
                                    'w-full rounded-lg border border-surface-300 bg-white px-4 py-2.5 text-sm text-surface-900',
                                    'placeholder:text-surface-400',
                                    'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                                    'transition-all duration-200'
                                )}
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-surface-700">
                                Senha
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className={cn(
                                        'w-full rounded-lg border border-surface-300 bg-white px-4 py-2.5 pr-10 text-sm text-surface-900',
                                        'placeholder:text-surface-400',
                                        'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                                        'transition-all duration-200'
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={cn(
                                'flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white',
                                'hover:bg-brand-700 active:bg-brand-800',
                                'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2',
                                'disabled:cursor-not-allowed disabled:opacity-60',
                                'transition-all duration-200'
                            )}
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <LogIn className="h-4 w-4" />
                            )}
                            {isLoading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p className="mt-6 text-center text-xs text-surface-400">
                    Sistema de Ordem de Serviço © 2026
                </p>
            </div>
        </div>
    )
}
