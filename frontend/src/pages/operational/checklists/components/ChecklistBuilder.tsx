import { useState , useMemo } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, GripVertical , Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const checklistSchema = z.object({
    name: z.string().min(3, 'Nome é obrigatório'),
    description: z.string().optional(),
    is_active: z.boolean().default(true),
    items: z.array(z.object({
        id: z.string(),
        label: z.string().min(1, 'Texto da pergunta é obrigatório'),
        type: z.enum(['text', 'boolean', 'photo', 'select']),
        required: z.boolean().default(false),
        options: z.array(z.string()).optional(), // Para selects
    })).min(1, 'Adicione pelo menos um item ao checklist'),
})

type ChecklistFormInput = z.input<typeof checklistSchema>
type ChecklistFormValues = z.output<typeof checklistSchema>

export function ChecklistBuilder({ onSuccess }: { onSuccess?: () => void }) {

  // MVP: Data fetching
  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: ['checklist-builder'],
    queryFn: () => api.get('/checklist-builder').then(r => r.data?.data ?? r.data ?? []),
  })

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/checklist-builder/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['checklist-builder'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }

  // MVP: Loading/Error/Empty states
  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (isError) return <div className="flex flex-col items-center justify-center p-8 text-red-500"><AlertCircle className="h-8 w-8 mb-2" /><p>Erro ao carregar dados</p><button onClick={() => refetch()} className="mt-2 text-blue-500 underline">Tentar novamente</button></div>
  if (!items || (Array.isArray(items) && items.length === 0)) return <div className="flex flex-col items-center justify-center p-8 text-gray-400"><Inbox className="h-12 w-12 mb-2" /><p>Nenhum registro encontrado</p></div>
  const { user } = useAuthStore()
  const hasPermission = (p: string) => user?.all_permissions?.includes(p) ?? false
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<ChecklistFormInput, unknown, ChecklistFormValues>({
  const [searchTerm, setSearchTerm] = useState('')
        resolver: zodResolver(checklistSchema),
        defaultValues: {
            name: '',
            description: '',
            is_active: true,
            items: [{ id: crypto.randomUUID(), label: '', type: 'boolean', required: true }],
        },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'items',
    })

    const onSubmit = async (data: ChecklistFormValues) => {
        setIsSubmitting(true)
        try {
            await api.post('/checklists', data)
            toast.success('Checklist criado com sucesso!')
            form.reset()
            onSuccess?.()
        } catch (error) {
            toast.error('Erro ao criar checklist')
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Card className="w-full max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle>Criar Novo Checklist</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome do Checklist</Label>
                            <Input id="name" {...form.register('name')} placeholder="Ex: Checklist Pré-Visita" />
                            {form.formState.errors.name && <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>}
                        </div>

                        <div className="flex items-center space-x-2 pt-8">
                            <Switch
                                id="is_active"
                                checked={form.watch('is_active') ?? true}
                                onCheckedChange={(checked) => form.setValue('is_active', checked)}
                            />
                            <Label htmlFor="is_active">Ativo</Label>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Descrição (Opcional)</Label>
                        <Textarea id="description" {...form.register('description')} placeholder="Instruções para o técnico..." />
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium">Itens do Checklist</h3>
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ id: crypto.randomUUID(), label: '', type: 'boolean', required: true })}>
                                <Plus className="w-4 h-4 mr-2" /> Adicionar Item
                            </Button>
                        </div>

                        {fields.map((field, index) => (
                            <Card key={field.id} className="p-4 bg-muted/50 relative group">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20"
                                    onClick={() => remove(index)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                                    <div className="md:col-span-1 flex items-center justify-center pt-3">
                                        <GripVertical className="w-5 h-5 text-muted-foreground cursor-move" />
                                        <span className="ml-2 text-sm font-medium text-muted-foreground">{index + 1}</span>
                                    </div>

                                    <div className="md:col-span-6 space-y-2">
                                        <Label>Pergunta / Instrução</Label>
                                        <Input {...form.register(`items.${index}.label`)} placeholder="Ex: Verificar temperatura ambiente" />
                                        {form.formState.errors.items?.[index]?.label && (
                                            <p className="text-xs text-red-500">{form.formState.errors.items[index]?.label?.message}</p>
                                        )}
                                    </div>

                                    <div className="md:col-span-3 space-y-2">
                                        <Label>Tipo de Resposta</Label>
                                        <Select
                                            onValueChange={(value) => form.setValue(`items.${index}.type`, value as ChecklistFormInput['items'][number]['type'])}
                                            defaultValue={field.type}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="boolean">Sim / Não</SelectItem>
                                                <SelectItem value="text">Texto Livre</SelectItem>
                                                <SelectItem value="photo">Foto Obrigatória</SelectItem>
                                                <SelectItem value="select">Seleção Múltipla</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="md:col-span-2 flex items-center space-x-2 pt-8">
                                        <Switch
                                            checked={form.watch(`items.${index}.required`) ?? false}
                                            onCheckedChange={(checked) => form.setValue(`items.${index}.required`, checked)}
                                        />
                                        <Label className="text-xs">Obrigatório</Label>
                                    </div>
                                </div>
                            </Card>
                        ))}
                        {form.formState.errors.items && <p className="text-sm text-red-500">{form.formState.errors.items.message}</p>}
                    </div>

                    <div className="flex justify-end space-x-2">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Salvando...' : 'Salvar Checklist'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
