import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Plus, CheckCircle2, Circle, Play, Users, Search, Trash2, Pencil } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

interface Template {
    id: number; name: string; type: 'admission' | 'dismissal'; tasks: string[]; is_active: boolean
}
interface Checklist {
    id: number; user?: { name: string }; template?: { name: string }
    status: 'in_progress' | 'completed' | 'cancelled'; started_at: string; completed_at: string | null
    items?: ChecklistItem[]
}
interface ChecklistItem {
    id: number; title: string; description: string; is_completed: boolean
    completed_at: string | null; responsible?: { name: string }
}

const statusColors: Record<string, string> = {
    in_progress: 'bg-blue-100 text-blue-700', completed: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-surface-100 text-surface-500',
}
const statusLabels: Record<string, string> = { in_progress: 'Em Andamento', completed: 'Concluído', cancelled: 'Cancelado' }

export default function OnboardingPage() {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const canManage = hasRole('super_admin') || hasPermission('hr.onboarding.manage')
    const [tab, setTab] = useState<'checklists' | 'templates'>('checklists')
    const [showTemplateModal, setShowTemplateModal] = useState(false)
    const [showStartModal, setShowStartModal] = useState(false)
    const [tmplForm, setTmplForm] = useState({ name: '', type: 'admission' as 'admission' | 'dismissal', tasks: '' })
    const [startForm, setStartForm] = useState({ user_id: '', template_id: '' })

    const { data: templatesRes } = useQuery({
        queryKey: ['onboarding-templates'],
        queryFn: () => api.get('/hr/onboarding/templates').then(r => r.data?.data ?? []),
    })
    const templates: Template[] = templatesRes ?? []

    const { data: checklistsRes, isLoading } = useQuery({
        queryKey: ['onboarding-checklists'],
        queryFn: () => api.get('/hr/onboarding/checklists').then(r => r.data?.data ?? []),
    })
    const checklists: Checklist[] = checklistsRes ?? []

    const { data: usersRes } = useQuery({
        queryKey: ['technicians-options'],
        queryFn: () => api.get('/technicians/options').then(r => r.data),
    })
    const users: { id: number; name: string }[] = usersRes ?? []

    const createTmplMut = useMutation({
        mutationFn: (data: any) => api.post('/hr/onboarding/templates', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['onboarding-templates'] }); setShowTemplateModal(false); toast.success('Template criado') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao criar template'),
    })

    const startMut = useMutation({
        mutationFn: (data: any) => api.post('/hr/onboarding/start', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['onboarding-checklists'] }); setShowStartModal(false); toast.success('Onboarding iniciado') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao iniciar onboarding'),
    })

    const completeMut = useMutation({
        mutationFn: (itemId: number) => api.post(`/hr/onboarding/items/${itemId}/complete`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['onboarding-checklists'] }); toast.success('Tarefa concluída') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao concluir tarefa'),
    })

    const handleCreateTemplate = (e: React.FormEvent) => {
        e.preventDefault()
        const tasks = tmplForm.tasks.split('\n').map(t => t.trim()).filter(Boolean)
        createTmplMut.mutate({ name: tmplForm.name, type: tmplForm.type, tasks })
    }

    const handleStart = (e: React.FormEvent) => {
        e.preventDefault()
        startMut.mutate({ user_id: Number(startForm.user_id), template_id: Number(startForm.template_id) })
    }

    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'

    return (
        <div className="space-y-5">
            <PageHeader title="Onboarding / Offboarding" subtitle="Checklists de admissão e desligamento" />

            {/* Tabs + Actions */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex gap-1 rounded-lg border border-default bg-surface-50 p-0.5">
                    {(['checklists', 'templates'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={cn('rounded-md px-4 py-1.5 text-xs font-medium transition-all',
                                tab === t ? 'bg-surface-0 text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700')}>
                            {t === 'checklists' ? 'Checklists Ativos' : 'Templates'}
                        </button>
                    ))}
                </div>
                {canManage && (
                    <div className="flex gap-2">
                        {tab === 'templates' && (
                            <Button variant="outline" onClick={() => { setTmplForm({ name: '', type: 'admission', tasks: '' }); setShowTemplateModal(true) }}
                                icon={<Plus className="h-4 w-4" />}>Novo Template</Button>
                        )}
                        {tab === 'checklists' && templates.length > 0 && (
                            <Button onClick={() => { setStartForm({ user_id: '', template_id: '' }); setShowStartModal(true) }}
                                icon={<Play className="h-4 w-4" />}>Iniciar Onboarding</Button>
                        )}
                    </div>
                )}
            </div>

            {/* Templates Tab */}
            {tab === 'templates' && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {templates.length === 0 && (
                        <div className="col-span-full rounded-xl border border-dashed border-surface-300 bg-surface-50 py-12 text-center">
                            <ClipboardList className="mx-auto h-8 w-8 text-surface-300" />
                            <p className="mt-2 text-sm text-surface-400">Nenhum template criado</p>
                            {canManage && <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowTemplateModal(true)}>Criar Template</Button>}
                        </div>
                    )}
                    {templates.map(t => (
                        <div key={t.id} className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-semibold text-surface-900">{t.name}</h3>
                                    <span className={cn('mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
                                        t.type === 'admission' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700')}>
                                        {t.type === 'admission' ? 'Admissão' : 'Desligamento'}
                                    </span>
                                </div>
                                <span className="text-sm font-bold text-surface-500">{t.tasks?.length ?? 0} tarefas</span>
                            </div>
                            <ul className="mt-3 space-y-1.5">
                                {(t.tasks ?? []).slice(0, 5).map((task, i) => (
                                    <li key={i} className="flex items-center gap-2 text-xs text-surface-500">
                                        <Circle className="h-3 w-3 shrink-0 text-surface-300" /> {task}
                                    </li>
                                ))}
                                {(t.tasks?.length ?? 0) > 5 && (
                                    <li className="text-xs text-surface-400 pl-5">+{t.tasks.length - 5} mais</li>
                                )}
                            </ul>
                        </div>
                    ))}
                </div>
            )}

            {/* Checklists Tab */}
            {tab === 'checklists' && (
                <div className="space-y-4">
                    {isLoading && <p className="text-sm text-surface-400">Carregando...</p>}
                    {!isLoading && checklists.length === 0 && (
                        <div className="rounded-xl border border-dashed border-surface-300 bg-surface-50 py-12 text-center">
                            <Users className="mx-auto h-8 w-8 text-surface-300" />
                            <p className="mt-2 text-sm text-surface-400">Nenhum onboarding em andamento</p>
                        </div>
                    )}
                    {checklists.map(cl => {
                        const items = cl.items ?? []
                        const completed = items.filter(i => i.is_completed).length
                        const total = items.length
                        const pct = total > 0 ? Math.round((completed / total) * 100) : 0

                        return (
                            <div key={cl.id} className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h3 className="font-semibold text-surface-900">{cl.user?.name ?? '—'}</h3>
                                        <p className="text-xs text-surface-500">{cl.template?.name} · Início: {fmtDate(cl.started_at)}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold text-surface-700">{pct}%</span>
                                        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusColors[cl.status])}>
                                            {statusLabels[cl.status]}
                                        </span>
                                    </div>
                                </div>
                                {/* Progress bar */}
                                <Progress value={pct} className="h-2 mb-4" indicatorClassName={pct === 100 ? 'bg-emerald-500' : 'bg-brand-500'} />
                                {/* Items */}
                                <ul className="space-y-2">
                                    {items.map(item => (
                                        <li key={item.id} className="flex items-center justify-between rounded-lg border border-subtle p-3">
                                            <div className="flex items-center gap-3">
                                                {item.is_completed
                                                    ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                                                    : <Circle className="h-5 w-5 text-surface-300 shrink-0" />}
                                                <div>
                                                    <p className={cn('text-sm', item.is_completed && 'line-through text-surface-400')}>
                                                        {item.title}
                                                    </p>
                                                    {item.responsible && (
                                                        <p className="text-xs text-surface-400">Resp: {item.responsible.name}</p>
                                                    )}
                                                </div>
                                            </div>
                                            {!item.is_completed && canManage && (
                                                <Button variant="outline" size="sm" onClick={() => completeMut.mutate(item.id)}
                                                    loading={completeMut.isPending}>
                                                    Concluir
                                                </Button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create Template Modal */}
            <Modal open={showTemplateModal && canManage} onOpenChange={setShowTemplateModal} title="Novo Template" size="md">
                <form onSubmit={handleCreateTemplate} className="space-y-4">
                    <Input label="Nome *" value={tmplForm.name} required
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTmplForm(p => ({ ...p, name: e.target.value }))} />
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Tipo *</label>
                        <select aria-label="Tipo de template" value={tmplForm.type}
                            onChange={e => setTmplForm(p => ({ ...p, type: e.target.value as 'admission' | 'dismissal' }))}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                            <option value="admission">Admissão</option>
                            <option value="dismissal">Desligamento</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Tarefas * (uma por linha)</label>
                        <textarea value={tmplForm.tasks} onChange={e => setTmplForm(p => ({ ...p, tasks: e.target.value }))}
                            required rows={6} placeholder="Coletar documentos&#10;Criar conta corporativa&#10;Configurar equipamento&#10;..."
                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" type="button" onClick={() => setShowTemplateModal(false)}>Cancelar</Button>
                        <Button type="submit" loading={createTmplMut.isPending}>Criar Template</Button>
                    </div>
                </form>
            </Modal>

            {/* Start Onboarding Modal */}
            <Modal open={showStartModal && canManage} onOpenChange={setShowStartModal} title="Iniciar Onboarding" size="sm">
                <form onSubmit={handleStart} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Colaborador *</label>
                        <select aria-label="Selecionar colaborador" value={startForm.user_id}
                            onChange={e => setStartForm(p => ({ ...p, user_id: e.target.value }))} required
                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                            <option value="">— Selecionar —</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Template *</label>
                        <select aria-label="Selecionar template" value={startForm.template_id}
                            onChange={e => setStartForm(p => ({ ...p, template_id: e.target.value }))} required
                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                            <option value="">— Selecionar —</option>
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type === 'admission' ? 'Admissão' : 'Desligamento'})</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" type="button" onClick={() => setShowStartModal(false)}>Cancelar</Button>
                        <Button type="submit" loading={startMut.isPending}>Iniciar</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
