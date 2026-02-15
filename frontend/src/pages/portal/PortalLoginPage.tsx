import { useState , useMemo } from 'react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, LogIn } from 'lucide-react'
import { usePortalAuthStore } from '@/stores/portal-auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const loginSchema = z.object({
    email: z.string().email('E-mail inválido'),
    password: z.string().min(1, 'Senha é obrigatória'),
    tenant_id: z.string().min(1, 'ID da empresa é obrigatório'), // Simple input for now, could be improved
})

type LoginFormData = z.infer<typeof loginSchema>

export function PortalLoginPage() {

    const navigate = useNavigate()
    const login = usePortalAuthStore((state) => state.login)
    const [error, setError] = useState('')

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    })

    const onSubmit = async (data: LoginFormData) => {
        try {
            setError('')
            await login(data.email, data.password, parseInt(data.tenant_id))
            navigate('/portal')
        } catch (err: any) {
            setError('Credenciais inválidas ou conta inativa.')
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-50 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-card border border-surface-200">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 bg-brand-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                        PC
                    </div>
                    <h2 className="mt-6 text-3xl font-extrabold text-surface-900">Portal do Cliente</h2>
                    <p className="mt-2 text-[13px] text-surface-600">
                        Acesse suas ordens de serviço e faturas
                    </p>
                </div>

                <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="tenant_id" className="block text-[13px] font-medium text-surface-700">
                                Código da Empresa
                            </label>
                            <Input
                                id="tenant_id"
                                type="number"
                                {...register('tenant_id')}
                                error={errors.tenant_id?.message}
                                placeholder="Ex: 1"
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-[13px] font-medium text-surface-700">
                                E-mail
                            </label>
                            <Input
                                id="email"
                                type="email"
                                {...register('email')}
                                error={errors.email?.message}
                                placeholder="seu@email.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-[13px] font-medium text-surface-700">
                                Senha
                            </label>
                            <Input
                                id="password"
                                type="password"
                                {...register('password')}
                                error={errors.password?.message}
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-md bg-red-50 p-4">
                            <div className="flex">
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                                </div>
                            </div>
                        </div>
                    )}

                    <Button
                        type="submit"
                        className="w-full flex justify-center py-2.5"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <>
                                <LogIn className="h-4 w-4 mr-2" />
                                Entrar
                            </>
                        )}
                    </Button>
                </form>
            </div>
        </div>
    )
}
