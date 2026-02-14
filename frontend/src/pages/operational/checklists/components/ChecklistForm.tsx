import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Check, Loader2, Upload, X, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

function PhotoUploadField({
    itemId,
    workOrderId,
    value,
    onChange,
}: {
    itemId: string
    workOrderId?: number
    value?: string
    onChange: (url: string | null) => void
}) {
    const [uploading, setUploading] = useState(false)
    const [preview, setPreview] = useState<string | null>(null)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            toast.error('Apenas imagens são permitidas')
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Tamanho máximo: 5MB')
            return
        }

        // Preview local
        const reader = new FileReader()
        reader.onload = () => setPreview(reader.result as string)
        reader.readAsDataURL(file)

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('entity_type', 'checklist')
            formData.append('entity_id', itemId)

            if (workOrderId) {
                formData.append('work_order_id', String(workOrderId))
                const response = await api.post('/tech/sync/photo', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                })
                onChange(response.data?.url ?? response.data?.path)
            } else {
                // Sem OS vinculada: salvar como base64 inline
                onChange(`data:${file.type};base64,${btoa(await file.text())}`)
            }
            toast.success('Foto enviada com sucesso')
        } catch (error: any) {
            toast.error(error?.response?.data?.message ?? 'Erro ao enviar foto')
            setPreview(null)
            onChange(null)
        } finally {
            setUploading(false)
        }
    }

    const handleRemove = () => {
        setPreview(null)
        onChange(null)
    }

    return (
        <div className="space-y-2">
            {(preview || value) ? (
                <div className="relative inline-block">
                    <img
                        src={preview || value}
                        alt="Foto do checklist"
                        className="h-32 w-auto rounded-lg border border-surface-200 object-cover"
                    />
                    <button
                        type="button"
                        onClick={handleRemove}
                        title="Remover foto"
                        aria-label="Remover foto"
                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-sm hover:bg-red-600"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            ) : (
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-surface-200 p-4 text-sm text-surface-500 transition-colors hover:border-brand-300 hover:bg-brand-50/50">
                    {uploading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                    ) : (
                        <ImageIcon className="h-5 w-5" />
                    )}
                    {uploading ? 'Enviando...' : 'Clique para tirar ou selecionar foto'}
                    <input
                        type="file"
                        accept="image/*"

                        className="hidden"
                        onChange={handleFileChange}
                        disabled={uploading}
                    />
                </label>
            )}
        </div>
    )
}

interface ChecklistItem {
    id: string
    label: string
    type: 'text' | 'boolean' | 'photo' | 'select'
    required: boolean
    options?: string[]
}

interface Checklist {
    id: number
    name: string
    description: string
    items: ChecklistItem[]
}

interface ChecklistFormProps {
    checklist: Checklist
    workOrderId?: number
    onSuccess?: () => void
}

export function ChecklistForm({ checklist, workOrderId, onSuccess }: ChecklistFormProps) {
  const { user } = useAuthStore()
  const hasPermission = (p: string) => user?.all_permissions?.includes(p) ?? false
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Dynamic schema generation based on items
    const generateSchema = () => {
        const shape: Record<string, z.ZodTypeAny> = {}
  const [searchTerm, setSearchTerm] = useState('')
        checklist.items.forEach(item => {
            shape[item.id] = item.required
                ? z.string().min(1, 'Este campo é obrigatório')
                : z.string().optional()
        })
        return z.object(shape)
    }

    const FormSchema = generateSchema()
    type FormValues = z.infer<typeof FormSchema>

    const form = useForm<FormValues>({
        resolver: zodResolver(FormSchema),
    })

    const onSubmit = async (data: FormValues) => {
        setIsSubmitting(true)
        try {
            await api.post('/checklist-submissions', {
                checklist_id: checklist.id,
                work_order_id: workOrderId,
                responses: data,
                completed_at: new Date().toISOString()
            })
            toast.success('Checklist enviado com sucesso!')
            onSuccess?.()
        } catch (error) {
            toast.error('Erro ao enviar checklist')
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>{checklist.name}</CardTitle>
                {checklist.description && <p className="text-sm text-muted-foreground">{checklist.description}</p>}
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {checklist.items.map((item) => (
                        <div key={item.id} className="space-y-2 p-4 border rounded-md bg-muted/10">
                            <Label className="text-base font-medium">
                                {item.label} {item.required && <span className="text-red-500">*</span>}
                            </Label>

                            {item.type === 'text' && (
                                <Textarea {...form.register(item.id as keyof FormValues)} placeholder="Sua resposta..." />
                            )}

                            {item.type === 'boolean' && (
                                <RadioGroup
                                    onValueChange={(val) => form.setValue(item.id as keyof FormValues, val as FormValues[keyof FormValues])}
                                    className="flex space-x-4"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="true" id={`${item.id}-yes`} />
                                        <Label htmlFor={`${item.id}-yes`}>Sim</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="false" id={`${item.id}-no`} />
                                        <Label htmlFor={`${item.id}-no`}>Não</Label>
                                    </div>
                                </RadioGroup>
                            )}

                            {item.type === 'select' && item.options && (
                                <RadioGroup onValueChange={(val) => form.setValue(item.id as keyof FormValues, val as FormValues[keyof FormValues])}>
                                    {item.options.map((opt, idx) => (
                                        <div key={idx} className="flex items-center space-x-2">
                                            <RadioGroupItem value={opt} id={`${item.id}-${idx}`} />
                                            <Label htmlFor={`${item.id}-${idx}`}>{opt}</Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            )}

                            {item.type === 'photo' && (
                                <PhotoUploadField
                                    itemId={item.id}
                                    workOrderId={workOrderId}
                                    value={form.watch(item.id as keyof FormValues) as string | undefined}
                                    onChange={(url) => form.setValue(item.id as keyof FormValues, (url ?? '') as FormValues[keyof FormValues])}
                                />
                            )}

                            {form.formState.errors[item.id] && (
                                <p className="text-sm text-red-500">{(form.formState.errors[item.id] as any)?.message}</p>
                            )}
                        </div>
                    ))}

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        Finalizar Checklist
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
