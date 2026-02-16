import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface QuickReminderButtonProps {
    className?: string
}

export function QuickReminderButton({ className }: QuickReminderButtonProps) {
    const [open, setOpen] = useState(false)
    const [titulo, setTitulo] = useState('')
    const [due_at, setDue_at] = useState('')
    const qc = useQueryClient()

    const createMut = useMutation({
        mutationFn: () =>
            api.post('/central/items', {
                tipo: 'lembrete',
                titulo: titulo.trim(),
                due_at: due_at || undefined,
                visibilidade: 'privado',
            }),
        onSuccess: () => {
            toast.success('Lembrete criado')
            qc.invalidateQueries({ queryKey: ['central-items'] })
            qc.invalidateQueries({ queryKey: ['central-summary'] })
            setOpen(false)
            setTitulo('')
            setDue_at('')
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message ?? 'Erro ao criar lembrete')
        },
    })

    const handleSubmit = () => {
        if (!titulo.trim()) {
            toast.error('Informe o título do lembrete')
            return
        }
        createMut.mutate()
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={className}
                title="Lembrete rápido"
                aria-label="Criar lembrete rápido"
            >
                <Clock className="h-5 w-5 text-surface-500 hover:text-surface-700 transition-colors" />
            </button>
            <Modal
                open={open}
                onOpenChange={setOpen}
                title="Lembrete rápido"
                description="Crie um lembrete para você. Ele aparecerá na Central."
            >
                <div className="space-y-4">
                    <Input
                        label="O quê?"
                        value={titulo}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitulo(e.target.value)}
                        placeholder="Ex.: Ligar para o cliente X"
                        autoFocus
                    />
                    <Input
                        label="Quando?"
                        type="datetime-local"
                        value={due_at}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDue_at(e.target.value)}
                    />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} loading={createMut.isPending} disabled={!titulo.trim()}>
                        Criar lembrete
                    </Button>
                </div>
            </Modal>
        </>
    )
}
