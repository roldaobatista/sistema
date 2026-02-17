import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'

export function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [sent, setSent] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            await api.post('/forgot-password', { email })
            setSent(true)
            toast.success('Verifique seu e-mail.')
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? 'Erro ao enviar e-mail.')
        } finally {
            setIsLoading(false)
        }
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
                    {sent ? (
                        <div className="text-center space-y-4">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                                <CheckCircle className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-surface-900">E-mail enviado</h2>
                                <p className="mt-1 text-[13px] text-surface-500 leading-relaxed">
                                    Se o e-mail <strong>{email}</strong> estiver cadastrado, você receberá um link para redefinir sua senha.
                                </p>
                            </div>
                            <p className="text-xs text-surface-400">
                                Não recebeu? Verifique a caixa de spam ou tente novamente.
                            </p>
                            <button
                                onClick={() => { setSent(false); setEmail('') }}
                                className="text-sm font-medium text-brand-600 hover:text-brand-500"
                            >
                                Enviar novamente
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="mb-6">
                                <h2 className="text-lg font-semibold text-surface-900 tracking-tight">
                                    Esqueceu sua senha?
                                </h2>
                                <p className="mt-0.5 text-[13px] text-surface-500">
                                    Informe seu e-mail e enviaremos um link para redefinir sua senha.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label htmlFor="email" className="block text-[13px] font-medium text-surface-700">
                                        E-mail
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                                        <input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="seu@email.com"
                                            required
                                            autoFocus
                                            className={cn(
                                                'w-full rounded-md border border-default bg-surface-50 pl-10 pr-3 py-2 text-sm text-surface-900',
                                                'placeholder:text-surface-400',
                                                'focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15',
                                                'transition-all duration-150'
                                            )}
                                        />
                                    </div>
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
                                    {isLoading ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Mail className="h-3.5 w-3.5" />
                                    )}
                                    {isLoading ? 'Enviando...' : 'Enviar link'}
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
