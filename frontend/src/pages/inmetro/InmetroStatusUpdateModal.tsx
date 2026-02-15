import { useEffect, useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useUpdateLeadStatus } from '@/hooks/useInmetro'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'

const schema = z.object({
    notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface InmetroStatusUpdateModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    ownerId: number | null
    newStatus: string | null
    currentStatusLabel?: string
    newStatusLabel?: string
    onSuccess?: () => void
}

export function InmetroStatusUpdateModal({
    open,
    onOpenChange,
    ownerId,
    newStatus,
    newStatusLabel,
    onSuccess
}: InmetroStatusUpdateModalProps) {
    const statusMutation = useUpdateLeadStatus()
    const {
        register,
        handleSubmit,
        reset,
    } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            notes: '',
        },
    })

    useEffect(() => {
        if (open) {
            reset({ notes: '' })
        }
    }, [open, reset])

    const onSubmit = (data: FormData) => {
        if (!ownerId || !newStatus) return

        statusMutation.mutate(
            { ownerId, lead_status: newStatus, notes: data.notes },
            {
                onSuccess: () => {
                    toast.success('Status atualizado com sucesso!')
                    onOpenChange(false)
                    if (onSuccess) onSuccess()
                },
                onError: (error: any) => {
                    toast.error('Erro ao atualizar status: ' + (error.response?.data?.message || error.message))
                },
            }
        )
    }

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title="Atualizar Status"
            description={`Alterar status para ${newStatusLabel || 'novo status'}. Você pode adicionar uma observação.`}
            size="sm"
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                    <label htmlFor="status-notes" className="text-sm font-medium text-surface-700">Observações (Opcional)</label>
                    <Textarea
                        id="status-notes"
                        {...register('notes')}
                        placeholder="Ex: Cliente pediu para retornar semana que vem..."
                        rows={4}
                    />
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
                        disabled={statusMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
                    >
                        {statusMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Confirmar Alteração
                    </button>
                </div>
            </form>
        </Modal>
    )
}
