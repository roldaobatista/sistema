import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Send, ArrowLeft, AlertTriangle, Clock, Zap, Shield } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const serviceCallSchema = z.object({
    description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    equipment_id: z.string().optional(),
})

type ServiceCallFormData = z.infer<typeof serviceCallSchema>

const priorityOptions = [
    { value: 'low', label: 'Baixa', desc: 'Pode aguardar', icon: Shield, color: 'border-surface-300 bg-surface-50 text-surface-600' },
    { value: 'normal', label: 'Normal', desc: 'Prazo padrão', icon: Clock, color: 'border-sky-300 bg-sky-50 text-sky-600' },
    { value: 'high', label: 'Alta', desc: 'Prioridade elevada', icon: AlertTriangle, color: 'border-amber-300 bg-amber-50 text-amber-600' },
    { value: 'urgent', label: 'Urgente', desc: 'Atenção imediata', icon: Zap, color: 'border-red-300 bg-red-50 text-red-600' },
]

export function PortalServiceCallPage() {

  // MVP: Data fetching
  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: ['portal-service-call'],
    queryFn: () => api.get('/portal-service-call').then(r => r.data?.data ?? r.data ?? []),
  })

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/portal-service-call/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['portal-service-call'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }

  // MVP: Search
  const [searchTerm, setSearchTerm] = useState('')

  // MVP: Loading/Error/Empty states
  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (isError) return <div className="flex flex-col items-center justify-center p-8 text-red-500"><AlertCircle className="h-8 w-8 mb-2" /><p>Erro ao carregar dados</p><button onClick={() => refetch()} className="mt-2 text-blue-500 underline">Tentar novamente</button></div>
  if (!items || (Array.isArray(items) && items.length === 0)) return <div className="flex flex-col items-center justify-center p-8 text-gray-400"><Inbox className="h-12 w-12 mb-2" /><p>Nenhum registro encontrado</p></div>
  const { hasPermission } = useAuthStore()

    const navigate = useNavigate()

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<ServiceCallFormData>({
        resolver: zodResolver(serviceCallSchema),
        defaultValues: { priority: 'normal' }
    })

    const selectedPriority = watch('priority')

    const onSubmit = async (data: ServiceCallFormData) => {
        try {
            const payload: Record<string, any> = { ...data }
            if (!payload.equipment_id) {
                delete payload.equipment_id
            }
            await api.post('/portal/service-calls', payload)
            toast.success('Chamado aberto com sucesso!')
            navigate('/portal/os')
        } catch (error: any) {
            if (error?.response?.status === 422) {
                toast.error(error.response.data?.message || 'Verifique os campos do formulário')
            } else if (error?.response?.status === 403) {
                toast.error('Sem permissão para abrir chamado')
            } else {
                toast.error(error?.response?.data?.message || 'Erro ao abrir chamado')
            }
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-5">
            <div>
                <button onClick={() => navigate('/portal')} className="flex items-center gap-1.5 text-[13px] text-surface-500 hover:text-brand-600 transition-colors mb-4">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Abrir Novo Chamado</h1>
                <p className="mt-0.5 text-[13px] text-surface-500">Descreva o problema e nossa equipe entrará em contato</p>
            </div>

            <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="p-6 space-y-5">
                        {/* Description */}
                        <div>
                            <label htmlFor="description" className="block text-sm font-semibold text-surface-700 mb-2">
                                Descrição do Problema
                            </label>
                            <textarea
                                id="description"
                                rows={5}
                                placeholder="Descreva detalhadamente o que está acontecendo..."
                                className="w-full rounded-lg border border-surface-300 px-4 py-3 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 resize-none"
                                {...register('description')}
                            />
                            {errors.description && (
                                <p className="mt-1.5 text-xs text-red-600">{errors.description.message}</p>
                            )}
                        </div>

                        {/* Priority cards */}
                        <div>
                            <label className="block text-sm font-semibold text-surface-700 mb-3">Prioridade</label>
                            <div className="grid grid-cols-2 gap-3">
                                {priorityOptions.map(opt => {
                                    const Icon = opt.icon
                                    const isSelected = selectedPriority === opt.value
                                    return (
                                        <button key={opt.value} type="button"
                                            onClick={() => setValue('priority', opt.value as any)}
                                            className={cn(
                                                'rounded-lg border-2 p-3.5 text-left transition-all',
                                                isSelected ? opt.color + ' ring-2 ring-offset-1 ring-current' : 'border-default bg-surface-0 hover:bg-surface-50'
                                            )}>
                                            <div className="flex items-center gap-2">
                                                <Icon className={cn('h-4 w-4', isSelected ? '' : 'text-surface-400')} />
                                                <span className={cn('text-sm font-semibold', isSelected ? '' : 'text-surface-700')}>{opt.label}</span>
                                            </div>
                                            <p className={cn('text-xs mt-1', isSelected ? 'opacity-80' : 'text-surface-400')}>{opt.desc}</p>
                                        </button>
                                    )
                                })}
                            </div>
                            <input type="hidden" {...register('priority')} />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-subtle bg-surface-50 px-6 py-4 flex items-center justify-end gap-3 rounded-b-xl">
                        <button type="button" onClick={() => navigate('/portal')}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-surface-600 hover:bg-surface-100 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={isSubmitting}
                            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50">
                            {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
                            Enviar Chamado
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
