import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { toast } from 'sonner'
import { FileText, Plus, Edit, CheckCircle2, Copy } from 'lucide-react'

interface CertificateTemplate {
    id: number
    name: string
    description: string | null
    layout_config: Record<string, any>
    is_default: boolean
    created_at: string
    updated_at: string
}

const defaultLayout = {
    show_readings: true,
    show_eccentricity: true,
    show_conformity: true,
    show_traceability: true,
    show_weights: true,
    logo_position: 'left',
    primary_color: '#059669',
    show_qr_code: true,
    footer_text: '',
}

export default function CertificateTemplatesPage() {
    const queryClient = useQueryClient()
    const [showDialog, setShowDialog] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [form, setForm] = useState({
        name: '',
        description: '',
        layout_config: { ...defaultLayout },
        is_default: false,
    })

    const { data, isLoading } = useQuery<CertificateTemplate[]>({
        queryKey: ['certificate-templates'],
        queryFn: () => api.get('/api/v1/certificate-templates').then(r => r.data.data ?? r.data),
    })

    const saveMutation = useMutation({
        mutationFn: (payload: typeof form) => {
            if (editingId) {
                return api.put(`/api/v1/certificate-templates/${editingId}`, payload)
            }
            return api.post('/api/v1/certificate-templates', payload)
        },
        onSuccess: () => {
            toast.success(editingId ? 'Template atualizado' : 'Template criado')
            queryClient.invalidateQueries({ queryKey: ['certificate-templates'] })
            closeDialog()
        },
        onError: () => toast.error('Erro ao salvar template'),
    })

    const closeDialog = () => {
        setShowDialog(false)
        setEditingId(null)
        setForm({ name: '', description: '', layout_config: { ...defaultLayout }, is_default: false })
    }

    const openEdit = (t: CertificateTemplate) => {
        setEditingId(t.id)
        setForm({
            name: t.name,
            description: t.description ?? '',
            layout_config: { ...defaultLayout, ...t.layout_config },
            is_default: t.is_default,
        })
        setShowDialog(true)
    }

    const templates = data ?? []

    const toggleConfig = (key: string) => {
        setForm(prev => ({
            ...prev,
            layout_config: {
                ...prev.layout_config,
                [key]: !prev.layout_config[key],
            },
        }))
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Templates de Certificado"
                subtitle="Gerencie layouts personalizados para certificados de calibração ISO 17025"
                action={
                    <button
                        onClick={() => { closeDialog(); setShowDialog(true) }}
                        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" /> Novo Template
                    </button>
                }
            />

            {isLoading ? (
                <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>
            ) : templates.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title="Nenhum template"
                    description="Crie templates personalizados para certificados de calibração."
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {templates.map(t => (
                        <div key={t.id} className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-semibold">{t.name}</h3>
                                    {t.description && (
                                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                                    )}
                                </div>
                                {t.is_default && (
                                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                        <CheckCircle2 className="h-3 w-3" /> Padrão
                                    </span>
                                )}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-1">
                                {t.layout_config?.show_readings && <ConfigBadge label="Leituras" />}
                                {t.layout_config?.show_eccentricity && <ConfigBadge label="Excentricidade" />}
                                {t.layout_config?.show_conformity && <ConfigBadge label="Conformidade" />}
                                {t.layout_config?.show_weights && <ConfigBadge label="Pesos Padrão" />}
                                {t.layout_config?.show_qr_code && <ConfigBadge label="QR Code" />}
                            </div>

                            <div className="mt-4 flex items-center gap-2">
                                <button
                                    onClick={() => openEdit(t)}
                                    className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
                                >
                                    <Edit className="h-3 w-3" /> Editar
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingId(null)
                                        setForm({
                                            name: `${t.name} (cópia)`,
                                            description: t.description ?? '',
                                            layout_config: { ...defaultLayout, ...t.layout_config },
                                            is_default: false,
                                        })
                                        setShowDialog(true)
                                    }}
                                    className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
                                >
                                    <Copy className="h-3 w-3" /> Duplicar
                                </button>
                            </div>

                            <div className="mt-3 text-xs text-muted-foreground">
                                Atualizado em {new Date(t.updated_at).toLocaleDateString('pt-BR')}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Dialog */}
            {showDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeDialog}>
                    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold">{editingId ? 'Editar Template' : 'Novo Template'}</h3>
                        <div className="mt-4 space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium">Nome</label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Ex: Certificado ISO Padrão"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium">Descrição</label>
                                <textarea
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                    value={form.description}
                                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                    rows={2}
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium">Seções do Certificado</label>
                                <div className="space-y-2">
                                    {[
                                        { key: 'show_readings', label: 'Tabela de Leituras/Resultados' },
                                        { key: 'show_eccentricity', label: 'Ensaio de Excentricidade' },
                                        { key: 'show_conformity', label: 'Declaração de Conformidade' },
                                        { key: 'show_traceability', label: 'Declaração de Rastreabilidade' },
                                        { key: 'show_weights', label: 'Padrões de Medição Utilizados' },
                                        { key: 'show_qr_code', label: 'QR Code de Verificação' },
                                    ].map(({ key, label }) => (
                                        <label key={key} className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={!!form.layout_config[key]}
                                                onChange={() => toggleConfig(key)}
                                                className="rounded border-muted"
                                            />
                                            {label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Cor Primária</label>
                                    <input
                                        type="color"
                                        className="h-10 w-full rounded-lg border bg-background"
                                        value={form.layout_config.primary_color ?? '#059669'}
                                        onChange={e => setForm(p => ({
                                            ...p,
                                            layout_config: { ...p.layout_config, primary_color: e.target.value },
                                        }))}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium">Posição Logo</label>
                                    <select
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                        value={form.layout_config.logo_position ?? 'left'}
                                        onChange={e => setForm(p => ({
                                            ...p,
                                            layout_config: { ...p.layout_config, logo_position: e.target.value },
                                        }))}
                                    >
                                        <option value="left">Esquerda</option>
                                        <option value="center">Centro</option>
                                        <option value="right">Direita</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">Texto do Rodapé</label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                    value={form.layout_config.footer_text ?? ''}
                                    onChange={e => setForm(p => ({
                                        ...p,
                                        layout_config: { ...p.layout_config, footer_text: e.target.value },
                                    }))}
                                    placeholder="Texto adicional no rodapé"
                                />
                            </div>

                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={form.is_default}
                                    onChange={e => setForm(p => ({ ...p, is_default: e.target.checked }))}
                                    className="rounded border-muted"
                                />
                                Definir como template padrão
                            </label>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={closeDialog} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                                Cancelar
                            </button>
                            <button
                                onClick={() => saveMutation.mutate(form)}
                                disabled={saveMutation.isPending || !form.name}
                                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                                {saveMutation.isPending ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function ConfigBadge({ label }: { label: string }) {
    return (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {label}
        </span>
    )
}
