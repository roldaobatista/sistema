import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, LogIn, Loader2, Shield } from 'lucide-react'
import { toast } from 'sonner'

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
                const msg = axiosErr.response?.data?.message || 'Credenciais inválidas.'
                setError(msg)
                toast.error(msg)
            } else {
                setError('Erro ao conectar com o servidor.')
                toast.error('Erro ao conectar com o servidor.')
            }
        }
    }

    return (
        <div className="flex min-h-screen">
            {/* Left Panel — Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-b from-surface-900 via-surface-800 to-surface-950">
                {/* Grid */}
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

                {/* Brand accent glow */}
                <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-brand-500/8 blur-3xl" />
                <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-brand-600/5 blur-3xl" />

                <div className="relative z-10 flex flex-col justify-center px-16">
                    <div className="flex items-center gap-2.5 mb-10">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white font-bold text-sm">
                            K
                        </div>
                        <span className="text-[15px] font-semibold tabular-nums text-white tracking-tight">KALIBRIUM</span>
                    </div>

                    <h2 className="text-3xl font-bold text-white leading-tight tracking-tight mb-3">
                        Gestão completa<br />
                        <span className="text-brand-400">para sua empresa</span>
                    </h2>
                    <p className="text-sm text-surface-400 max-w-md leading-relaxed">
                        Ordens de serviço, financeiro, CRM, estoque e muito mais em uma plataforma integrada.
                    </p>

                    {/* Feature pills */}
                    <div className="flex flex-wrap gap-1.5 mt-8">
                        {['Ordens de Serviço', 'Financeiro', 'CRM', 'Estoque', 'Portal Cliente'].map(f => (
                            <span key={f} className="rounded-md border border-white/10 bg-surface-0/5 dark:bg-surface-800/5 px-2.5 py-1 text-[11px] font-medium text-white/60">
                                {f}
                            </span>
                        ))}
                    </div>

                    {/* Tolerance bar — brand signature */}
                    <div className="mt-12 flex gap-0.5 max-w-xs">
                        <div className="h-0.5 flex-[5] rounded-l-full bg-emerald-500/40" />
                        <div className="h-0.5 flex-[2] bg-amber-400/40" />
                        <div className="h-0.5 flex-[1] rounded-r-full bg-red-400/40" />
                    </div>
                </div>
            </div>

            {/* Right Panel — Form */}
            <div className="flex flex-1 items-center justify-center bg-surface-50 p-4 relative">
                <div className="relative w-full max-w-sm">
                    {/* Mobile branding */}
                    <div className="mb-8 text-center lg:hidden">
                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-sm">
                            K
                        </div>
                        <h1 className="text-[15px] font-semibold tabular-nums text-surface-900 tracking-tight">KALIBRIUM</h1>
                    </div>

                    {/* Card */}
                    <div className="rounded-xl border border-default bg-surface-0 p-7 shadow-elevated">
                        <div className="mb-6">
                            <h1 className="text-lg font-semibold text-surface-900 tracking-tight">
                                Bem-vindo de volta
                            </h1>
                            <p className="mt-0.5 text-[13px] text-surface-500">
                                Entre com suas credenciais para acessar
                            </p>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="mb-5 rounded-lg border border-red-200/50 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 flex items-center gap-2">
                                <Shield className="h-3.5 w-3.5 flex-shrink-0" /> {error}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label htmlFor="email" className="block text-[13px] font-medium text-surface-700">
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
                                        'w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm text-surface-900',
                                        'placeholder:text-surface-400',
                                        'focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15',
                                        'transition-all duration-150'
                                    )}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="password" className="block text-[13px] font-medium text-surface-700">
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
                                            'w-full rounded-md border border-default bg-surface-50 px-3 py-2 pr-9 text-sm text-surface-900',
                                            'placeholder:text-surface-400',
                                            'focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15',
                                            'transition-all duration-150'
                                        )}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Link
                                    to="/esqueci-senha"
                                    className="text-[12px] font-medium text-brand-600 hover:text-brand-500 transition-colors"
                                >
                                    Esqueceu sua senha?
                                </Link>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className={cn(
                                    'flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm',
                                    'hover:bg-brand-500 active:bg-brand-700',
                                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                                    'disabled:cursor-not-allowed disabled:opacity-40',
                                    'transition-colors duration-150'
                                )}
                            >
                                {isLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <LogIn className="h-3.5 w-3.5" />
                                )}
                                {isLoading ? 'Entrando...' : 'Entrar'}
                            </button>
                        </form>
                    </div>

                    {/* Footer */}
                    <p className="mt-5 text-center text-[11px] text-surface-400">
                        KALIBRIUM © 2026 — Gestão empresarial inteligente
                    </p>
                </div>
            </div>
        </div>
    )
}
