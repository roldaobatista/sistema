import { useEffect , useState , useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useUpdateOwner } from '@/hooks/useInmetro'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'

const schema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    trade_name: z.string().optional(),
    phone: z.string().optional(),
    phone2: z.string().optional(),
    email: z.string().email('E-mail inválido').optional().or(z.literal('')),
    notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface InmetroOwnerEditModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    owner: any
}

export function InmetroOwnerEditModal({ open, onOpenChange, owner }: InmetroOwnerEditModalProps) {

    const updateOwnerMutation = useUpdateOwner()
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: '',
            trade_name: '',
            phone: '',
            phone2: '',
            email: '',
            notes: '',
        },
    })

    useEffect(() => {
        if (owner) {
            reset({
                name: owner.name || '',
                trade_name: owner.trade_name || '',
                phone: owner.phone || '',
                phone2: owner.phone2 || '',
                email: owner.email || '',
                notes: owner.notes || '',
            })
        }
    }, [owner, reset])

    const onSubmit = (data: FormData) => {
        updateOwnerMutation.mutate(
            { id: owner.id, data },
            {
                onSuccess: () => {
                    toast.success('Proprietário atualizado com sucesso!')
                    onOpenChange(false)
                },
                onError: (error: any) => {
                    toast.error('Erro ao atualizar proprietário: ' + (error.response?.data?.message || error.message))
                },
            }
        )
    }

    return (
        <Modal open={open} onOpenChange={onOpenChange} title="Editar Proprietário" description="Atualize os dados do lead/proprietário do INMETRO." size="md">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2">
                        <label htmlFor="name" className="text-sm font-medium text-surface-700">Razão Social / Nome <span className="text-red-500">*</span></label>
                        <Input id="name" {...register('name')} placeholder="Nome completo" />
                        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-1.5 col-span-2">
                        <label htmlFor="trade_name" className="text-sm font-medium text-surface-700">Nome Fantasia</label>
                        <Input id="trade_name" {...register('trade_name')} placeholder="Nome comercial" />
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="phone" className="text-sm font-medium text-surface-700">Telefone</label>
                        <Input id="phone" {...register('phone')} placeholder="(00) 0000-0000" />
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="phone2" className="text-sm font-medium text-surface-700">Tel. Secundário</label>
                        <Input id="phone2" {...register('phone2')} placeholder="(00) 0000-0000" />
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="email" className="text-sm font-medium text-surface-700">E-mail</label>
                        <Input id="email" {...register('email')} placeholder="email@exemplo.com" />
                        {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-1.5 col-span-2">
                        <label htmlFor="notes" className="text-sm font-medium text-surface-700">Observações</label>
                        <Textarea id="notes" {...register('notes')} placeholder="Notas internas..." rows={3} />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={updateOwnerMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
                    >
                        {updateOwnerMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Salvar Alterações
                    </button>
                </div>
            </form>
        </Modal>
    )
}
