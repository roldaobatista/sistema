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
            {/* Left Panel — Premium Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#18181B] dark:bg-[#09090B]">
                {/* Animated gradient mesh */}
                <div className="absolute inset-0">
                    <div className="absolute -top-1/4 -left-1/4 h-[600px] w-[600px] rounded-full bg-brand-500/8 blur-[140px] animate-pulse-soft" />
                    <div className="absolute -bottom-1/4 -right-1/4 h-[500px] w-[500px] rounded-full bg-cta-500/6 blur-[120px] animate-pulse-soft" style={{ animationDelay: '1s' }} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-prix-500/4 blur-[100px] animate-pulse-soft" style={{ animationDelay: '2s' }} />
                </div>

                {/* Subtle grid */}
                <div className="absolute inset-0 opacity-[0.02]"
                    style={{ backgroundImage: 'radial-gradient(circle, #A1A1AA 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

                <div className="relative z-10 flex flex-col justify-center px-16 xl:px-20">
                    {/* Brand */}
                    <div className="flex items-center gap-3.5 mb-16">
                        <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)] prix-gradient text-white font-bold text-lg shadow-lg shadow-brand-500/25">
                            K
                        </div>
                        <span className="font-bold text-white text-xl tracking-tight">KALIBRIUM</span>
                    </div>

                    <h2 className="text-[3rem] xl:text-[3.5rem] leading-[1.05] font-extrabold text-white tracking-tight mb-5">
                        Gestão completa<br />
                        <span className="prix-gradient-text">para sua empresa</span>
                    </h2>
                    <p className="text-base text-zinc-400 max-w-md leading-relaxed">
                        Ordens de serviço, financeiro, CRM, estoque e muito mais em uma plataforma integrada e inteligente.
                    </p>

                    {/* Feature pills */}
                    <div className="flex flex-wrap gap-2.5 mt-12">
                        {['Ordens de Serviço', 'Financeiro', 'CRM', 'Estoque', 'Portal Cliente'].map(f => (
                            <span key={f} className="rounded-[var(--radius-pill)] border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-medium text-zinc-400 tracking-wide hover:bg-white/[0.06] hover:text-zinc-300 transition-colors duration-200">
                                {f}
                            </span>
                        ))}
                    </div>

                    {/* Signature bar */}
                    <div className="mt-16 flex gap-[3px] max-w-xs">
                        <div className="h-[3px] flex-[5] rounded-l-full bg-gradient-to-r from-brand-500/70 to-brand-500/40" />
                        <div className="h-[3px] flex-[2] bg-cta-500/50" />
                        <div className="h-[3px] flex-[1] rounded-r-full bg-prix-500/40" />
                    </div>
                </div>
            </div>

            {/* Right Panel — Form */}
            <div className="flex flex-1 items-center justify-center p-4 relative bg-background">
                <div className="relative w-full max-w-sm">
                    {/* Mobile branding */}
                    <div className="mb-10 text-center lg:hidden">
                        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)] prix-gradient text-white font-bold text-lg shadow-lg shadow-brand-500/25">
                            K
                        </div>
                        <h1 className="font-bold text-brand-600 dark:text-brand-400 text-lg tracking-tight">KALIBRIUM</h1>
                    </div>

                    {/* Card */}
                    <div className={cn(
                        "rounded-[var(--radius-xl)] border bg-white p-8 shadow-elevated",
                        "border-black/[0.04] dark:border-white/[0.08] dark:bg-[#111113] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_8px_40px_rgba(0,0,0,0.5)]"
                    )}>
                        <div className="mb-7">
                            <h1 className="text-2xl font-bold text-surface-900 dark:text-white tracking-tight">
                                Bem-vindo de volta
                            </h1>
                            <p className="mt-1.5 text-sm text-surface-500">
                                Entre com suas credenciais para acessar
                            </p>
                        </div>

                        {error && (
                            <div className="mb-6 rounded-[var(--radius-md)] border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/8 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-center gap-2.5">
                                <Shield className="h-4 w-4 flex-shrink-0" /> {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label htmlFor="email" className="block text-sm font-medium text-surface-700 dark:text-surface-300">
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
                                        'w-full rounded-[var(--radius-md)] border bg-white px-3.5 py-2.5 text-sm text-surface-900',
                                        'border-surface-200 dark:border-white/[0.08] dark:bg-[#0F0F12] dark:text-white',
                                        'placeholder:text-surface-400 dark:placeholder:text-zinc-600',
                                        'focus:border-prix-400 dark:focus:border-prix-400/50 focus:outline-none focus:ring-2 focus:ring-prix-500/15',
                                        'transition-all duration-150'
                                    )}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="password" className="block text-sm font-medium text-surface-700 dark:text-surface-300">
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
                                            'w-full rounded-[var(--radius-md)] border bg-white px-3.5 py-2.5 pr-10 text-sm text-surface-900',
                                            'border-surface-200 dark:border-white/[0.08] dark:bg-[#0F0F12] dark:text-white',
                                            'placeholder:text-surface-400 dark:placeholder:text-zinc-600',
                                            'focus:border-prix-400 dark:focus:border-prix-400/50 focus:outline-none focus:ring-2 focus:ring-prix-500/15',
                                            'transition-all duration-150'
                                        )}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Link
                                    to="/esqueci-senha"
                                    className="text-sm font-medium text-prix-500 hover:text-prix-600 dark:hover:text-prix-400 transition-colors"
                                >
                                    Esqueceu sua senha?
                                </Link>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className={cn(
                                    'flex w-full items-center justify-center gap-2.5 rounded-[var(--radius-pill)] prix-gradient px-5 py-3 text-sm font-bold text-white',
                                    'shadow-[0_1px_2px_rgba(0,0,0,0.1),0_2px_8px_rgba(37,99,235,0.2)]',
                                    'hover:brightness-110 hover:shadow-[0_2px_12px_rgba(37,99,235,0.3)] active:brightness-95',
                                    'dark:hover:shadow-[0_0_24px_rgba(96,165,250,0.25)]',
                                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-prix-500/50',
                                    'disabled:cursor-not-allowed disabled:opacity-40',
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

                    <p className="mt-6 text-center text-xs text-surface-400">
                        KALIBRIUM © 2026 — Gestão empresarial inteligente
                    </p>
                </div>
            </div>
        </div>
    )
}
