import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Trash2, Copy, Code, GripVertical, ToggleLeft, Eye } from 'lucide-react'
import { crmFeaturesApi } from '@/lib/crm-features-api'
import type { CrmWebForm } from '@/lib/crm-features-api'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/emptystate'
import { toast } from 'sonner'

const FIELD_TYPES = [
    { value: 'text', label: 'Texto' },
    { value: 'email', label: 'E-mail' },
    { value: 'phone', label: 'Telefone' },
    { value: 'number', label: 'Número' },
    { value: 'textarea', label: 'Texto Longo' },
    { value: 'select', label: 'Seleção' },
]

interface FormField {
    name: string
    type: string
    label: string
    required: boolean
}

const DEFAULT_FIELDS: FormField[] = [
    { name: 'name', type: 'text', label: 'Nome', required: true },
    { name: 'email', type: 'email', label: 'E-mail', required: true },
    { name: 'phone', type: 'phone', label: 'Telefone', required: false },
]

export function CrmWebFormsPage() {
    const qc = useQueryClient()
    const [showCreate, setShowCreate] = useState(false)
    const [embedModal, setEmbedModal] = useState<CrmWebForm | null>(null)
    const [formName, setFormName] = useState('')
    const [formDescription, setFormDescription] = useState('')
    const [fields, setFields] = useState<FormField[]>(DEFAULT_FIELDS)

    const { data: res, isLoading } = useQuery({
        queryKey: ['crm-web-forms'],
        queryFn: () => crmFeaturesApi.getWebForms(),
    })
    const forms: CrmWebForm[] = res?.data ?? []

    const createMut = useMutation({
        mutationFn: (data: Partial<CrmWebForm>) => crmFeaturesApi.createWebForm(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['crm-web-forms'] })
            resetForm()
            toast.success('Formulário criado com sucesso')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao criar formulário'),
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => crmFeaturesApi.deleteWebForm(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['crm-web-forms'] })
            toast.success('Formulário excluído')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao excluir formulário'),
    })

    const [deleteId, setDeleteId] = useState<number | null>(null)

    const resetForm = () => {
        setShowCreate(false)
        setFormName('')
        setFormDescription('')
        setFields(DEFAULT_FIELDS)
    }

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault()
        if (!formName.trim()) return toast.error('Informe o nome do formulário')
        if (fields.length === 0) return toast.error('Adicione ao menos um campo')
        createMut.mutate({
            name: formName,
            description: formDescription || null,
            fields,
            is_active: true,
        })
    }

    const addField = () => {
        setFields([...fields, { name: '', type: 'text', label: '', required: false }])
    }

    const updateField = (idx: number, key: keyof FormField, value: string | boolean) => {
        const next = [...fields]
        ;(next[idx] as any)[key] = value
        if (key === 'label' && typeof value === 'string') {
            next[idx].name = value.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
        }
        setFields(next)
    }

    const removeField = (idx: number) => {
        setFields(fields.filter((_, i) => i !== idx))
    }

    const getEmbedCode = (form: CrmWebForm) => {
        const baseUrl = window.location.origin
        return `<iframe src="${baseUrl}/forms/${form.slug}" width="100%" height="500" frameborder="0" style="border:none;border-radius:8px;"></iframe>`
    }

    const copyEmbedCode = (form: CrmWebForm) => {
        navigator.clipboard.writeText(getEmbedCode(form))
        toast.success('Código copiado para a área de transferência')
    }

    return (
        <div className='space-y-6'>
            <PageHeader
                title='Formulários Web'
                subtitle='Crie formulários de captura de leads para incorporar em seu site.'
                count={forms.length}
                icon={FileText}
            >
                <Button
                    size='sm'
                    onClick={() => setShowCreate(true)}
                    icon={<Plus className='h-4 w-4' />}
                >
                    Novo Formulário
                </Button>
            </PageHeader>

            {isLoading ? (
                <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className='rounded-xl border border-default bg-surface-0 p-6 shadow-card animate-pulse'>
                            <div className='h-4 bg-surface-100 rounded w-3/4 mb-3' />
                            <div className='h-3 bg-surface-100 rounded w-1/2 mb-4' />
                            <div className='h-8 bg-surface-100 rounded w-full' />
                        </div>
                    ))}
                </div>
            ) : forms.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title='Nenhum formulário criado'
                    message='Crie seu primeiro formulário de captura de leads.'
                    action={{ label: 'Novo Formulário', onClick: () => setShowCreate(true), icon: <Plus className='h-4 w-4' /> }}
                />
            ) : (
                <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                    {forms.map((form) => (
                        <div key={form.id} className='rounded-xl border border-default bg-surface-0 p-6 shadow-card relative group transition-shadow hover:shadow-md'>
                            <div className='flex items-start justify-between mb-3'>
                                <div className='flex-1 min-w-0'>
                                    <h3 className='font-bold text-surface-900 truncate'>{form.name}</h3>
                                    {form.description && (
                                        <p className='text-xs text-surface-500 mt-0.5 line-clamp-2'>{form.description}</p>
                                    )}
                                </div>
                                <Badge variant={form.is_active ? 'success' : 'secondary'}>
                                    {form.is_active ? 'Ativo' : 'Inativo'}
                                </Badge>
                            </div>

                            <div className='flex items-center gap-4 text-xs text-surface-500 mb-4'>
                                <span className='flex items-center gap-1'>
                                    <GripVertical className='h-3 w-3' />
                                    {form.fields?.length ?? 0} campos
                                </span>
                                <span className='flex items-center gap-1'>
                                    <Eye className='h-3 w-3' />
                                    {form.submissions_count} envios
                                </span>
                            </div>

                            <div className='flex flex-wrap gap-1 mb-4'>
                                {form.fields?.slice(0, 4).map((f) => (
                                    <Badge key={f.name} variant='outline' size='xs'>
                                        {f.label}
                                        {f.required && <span className='text-red-400'>*</span>}
                                    </Badge>
                                ))}
                                {(form.fields?.length ?? 0) > 4 && (
                                    <Badge variant='outline' size='xs'>+{(form.fields?.length ?? 0) - 4}</Badge>
                                )}
                            </div>

                            <div className='flex items-center gap-2 pt-3 border-t border-surface-100'>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    className='flex-1 h-7 text-xs'
                                    onClick={() => setEmbedModal(form)}
                                    icon={<Code className='h-3 w-3' />}
                                >
                                    Embed
                                </Button>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    className='flex-1 h-7 text-xs'
                                    onClick={() => copyEmbedCode(form)}
                                    icon={<Copy className='h-3 w-3' />}
                                >
                                    Copiar
                                </Button>
                                <Button
                                    size='icon'
                                    variant='ghost'
                                    className='h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50'
                                    onClick={() => setDeleteId(form.id)}
                                >
                                    <Trash2 className='h-3.5 w-3.5' />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal open={showCreate} onOpenChange={resetForm} title='Novo Formulário' size='lg'>
                <form onSubmit={handleCreate} className='space-y-4'>
                    <Input
                        label='Nome do Formulário *'
                        value={formName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)}
                        required
                        placeholder='Ex: Captação de Leads - Site'
                    />
                    <Input
                        label='Descrição'
                        value={formDescription}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormDescription(e.target.value)}
                        placeholder='Descrição opcional do formulário'
                    />

                    <div>
                        <div className='flex items-center justify-between mb-2'>
                            <label className='text-xs font-medium text-surface-700'>Campos do Formulário</label>
                            <Button type='button' size='sm' variant='outline' onClick={addField} icon={<Plus className='h-3 w-3' />}>
                                Adicionar Campo
                            </Button>
                        </div>
                        <div className='space-y-2 max-h-64 overflow-y-auto'>
                            {fields.map((field, idx) => (
                                <div key={idx} className='flex items-center gap-2 bg-surface-50 rounded-lg p-2'>
                                    <div className='flex-1'>
                                        <input
                                            type='text'
                                            value={field.label}
                                            onChange={(e) => updateField(idx, 'label', e.target.value)}
                                            placeholder='Rótulo do campo'
                                            className='w-full rounded-md border-default text-xs px-2 py-1.5 focus:ring-brand-500 focus:border-brand-500'
                                        />
                                    </div>
                                    <select
                                        value={field.type}
                                        onChange={(e) => updateField(idx, 'type', e.target.value)}
                                        className='rounded-md border-default text-xs px-2 py-1.5 w-28'
                                    >
                                        {FIELD_TYPES.map((t) => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                    <label className='flex items-center gap-1 text-xs text-surface-600 cursor-pointer whitespace-nowrap'>
                                        <input
                                            type='checkbox'
                                            checked={field.required}
                                            onChange={(e) => updateField(idx, 'required', e.target.checked)}
                                            className='rounded border-default'
                                        />
                                        Obrigatório
                                    </label>
                                    <Button
                                        type='button'
                                        size='icon'
                                        variant='ghost'
                                        className='h-7 w-7 text-red-500 shrink-0'
                                        onClick={() => removeField(idx)}
                                    >
                                        <Trash2 className='h-3 w-3' />
                                    </Button>
                                </div>
                            ))}
                        </div>
                        {fields.length === 0 && (
                            <p className='text-xs text-surface-400 text-center py-4'>Nenhum campo adicionado.</p>
                        )}
                    </div>

                    <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                        <Button variant='outline' type='button' onClick={resetForm}>Cancelar</Button>
                        <Button type='submit' loading={createMut.isPending}>Criar Formulário</Button>
                    </div>
                </form>
            </Modal>

            <Modal open={!!embedModal} onOpenChange={() => setEmbedModal(null)} title='Código de Incorporação'>
                {embedModal && (
                    <div className='space-y-4'>
                        <p className='text-sm text-surface-600'>
                            Copie o código abaixo e cole no HTML do seu site para exibir o formulário <strong>{embedModal.name}</strong>.
                        </p>
                        <div className='bg-surface-900 rounded-lg p-4 overflow-x-auto'>
                            <code className='text-xs text-emerald-400 font-mono whitespace-pre-wrap break-all'>
                                {getEmbedCode(embedModal)}
                            </code>
                        </div>
                        <div className='flex justify-end gap-2'>
                            <Button variant='outline' onClick={() => setEmbedModal(null)}>Fechar</Button>
                            <Button onClick={() => copyEmbedCode(embedModal)} icon={<Copy className='h-4 w-4' />}>
                                Copiar Código
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal open={!!deleteId} onOpenChange={() => setDeleteId(null)} title='Excluir Formulário'>
                <p className='text-sm text-surface-600 py-2'>
                    Deseja excluir este formulário? Todos os envios associados também serão removidos. Esta ação não pode ser desfeita.
                </p>
                <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                    <Button variant='outline' onClick={() => setDeleteId(null)}>Cancelar</Button>
                    <Button
                        className='bg-red-600 hover:bg-red-700 text-white'
                        loading={deleteMut.isPending}
                        onClick={() => { if (deleteId) deleteMut.mutate(deleteId); setDeleteId(null) }}
                    >
                        Excluir
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
