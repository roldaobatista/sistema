import { useState, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Search, Plus, Zap, X, Pencil, Trash2, Star,
    ChevronLeft, ChevronRight, Power, Bell, Mail, MessageSquare,
    ClipboardList, FileText, Headphones, DollarSign, Gauge,
    Wrench, Package, Users, FileCheck, UserCheck, Truck, BarChart3,
    CheckCircle2, AlertTriangle, ArrowRight, Sparkles, Globe,
    type LucideIcon,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/pageheader'
import {
    TEMPLATES, CATEGORY_META, TRIGGER_EVENT_LABELS, ACTION_TYPE_LABELS,
    type AutomationTemplate, type TemplateCategory,
} from './automation-templates'

// =============================================================================
// Constants & Types
// =============================================================================

const TABS = ['templates', 'rules', 'webhooks', 'reports'] as const
type Tab = typeof TABS[number]
const TAB_LABELS: Record<Tab, string> = {
    templates: 'Modelos Prontos',
    rules: 'Minhas Regras',
    webhooks: 'Webhooks',
    reports: 'Relatórios Agendados',
}

const CATEGORY_ICONS: Record<TemplateCategory, LucideIcon> = {
    os: ClipboardList, orçamentos: FileText, chamados: Headphones,
    financeiro: DollarSign, equipamentos: Gauge, técnicos: Wrench,
    estoque: Package, clientes: Users, contratos: FileCheck,
    rh: UserCheck, frota: Truck,
}

const ALL_CATEGORIES: TemplateCategory[] = [
    'os', 'orçamentos', 'chamados', 'financeiro', 'equipamentos',
    'técnicos', 'estoque', 'clientes', 'contratos', 'rh', 'frota',
]

const ALL_TRIGGER_EVENTS = Object.keys(TRIGGER_EVENT_LABELS)
const ALL_ACTION_TYPES = Object.keys(ACTION_TYPE_LABELS)

const emptyWebhook = { name: '', url: '', events: '', secret: '', is_active: true }
const emptyReport = { name: '', report_type: 'work-orders', frequency: 'daily', recipients: '', is_active: true }

// =============================================================================
// Toggle Component
// =============================================================================

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); onChange(!checked) }}
            className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2',
                checked ? 'bg-emerald-500' : 'bg-surface-300',
                disabled && 'opacity-50 cursor-not-allowed',
            )}
        >
            <span className={cn(
                'pointer-events-none inline-block h-5 w-5 rounded-full bg-surface-0 shadow-sm ring-0 transition-transform duration-200',
                checked ? 'translate-x-5' : 'translate-x-0',
            )} />
        </button>
    )
}

// =============================================================================
// Main Component
// =============================================================================

export default function AutomationPage() {
    const queryClient = useQueryClient()

    // Tab state
    const [tab, setTab] = useState<Tab>('templates')
    const [page, setPage] = useState(1)

    // Templates tab state
    const [templateSearch, setTemplateSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>('all')
    const [configTemplate, setConfigTemplate] = useState<AutomationTemplate | null>(null)
    const [configName, setConfigName] = useState('')

    // Rules tab state
    const [rulesSearch, setRulesSearch] = useState('')
    const [showRuleModal, setShowRuleModal] = useState(false)
    const [editingRule, setEditingRule] = useState<any>(null)
    const [ruleForm, setRuleForm] = useState({ name: '', trigger_event: 'os.created', action_type: 'send_notification', is_active: true })

    // Webhooks & Reports modals
    const [webhookModal, setWebhookModal] = useState(false)
    const [reportModal, setReportModal] = useState(false)
    const [editingWebhookId, setEditingWebhookId] = useState<number | null>(null)
    const [editingReportId, setEditingReportId] = useState<number | null>(null)
    const [webhookForm, setWebhookForm] = useState(emptyWebhook)
    const [reportForm, setReportForm] = useState(emptyReport)

    // Debounce template search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(templateSearch), 300)
        return () => clearTimeout(t)
    }, [templateSearch])

    // =========================================================================
    // API Queries
    // =========================================================================

    const { data: allRulesData } = useQuery({
        queryKey: ['automation-rules-all'],
        queryFn: () => api.get('/automation/rules', { params: { per_page: 500 } }).then(r => r.data),
    })

    const { data: rulesPageData, isLoading: loadingRules } = useQuery({
        queryKey: ['automation-rules', rulesSearch, page],
        queryFn: () => api.get('/automation/rules', { params: { search: rulesSearch || undefined, page, per_page: 20 } }).then(r => r.data),
        enabled: tab === 'rules',
    })

    const { data: webhooksData, isLoading: loadingWebhooks } = useQuery({
        queryKey: ['automation-webhooks', page],
        queryFn: () => api.get('/automation/webhooks', { params: { page, per_page: 20 } }).then(r => r.data),
        enabled: tab === 'webhooks',
    })

    const { data: reportsData, isLoading: loadingReports } = useQuery({
        queryKey: ['automation-reports', page],
        queryFn: () => api.get('/automation/reports', { params: { page, per_page: 20 } }).then(r => r.data),
        enabled: tab === 'reports',
    })

    // =========================================================================
    // Derived Data
    // =========================================================================

    const allRules: any[] = allRulesData?.data ?? []
    const rules: any[] = rulesPageData?.data ?? []
    const webhooks: any[] = webhooksData?.data ?? []
    const reports: any[] = reportsData?.data ?? []

    const activeTemplateMap = useMemo(() => {
        const map = new Map<string, any>()
        for (const rule of allRules) {
            const tid = typeof rule.conditions === 'object' ? rule.conditions?.template_id : null
            if (tid) map.set(tid, rule)
        }
        return map
    }, [allRules])

    const activeCount = useMemo(() => allRules.filter((r: any) => r.is_active).length, [allRules])
    const totalExecutions = useMemo(() => allRules.reduce((sum: number, r: any) => sum + (r.execution_count ?? 0), 0), [allRules])

    const filteredTemplates = useMemo(() => {
        const s = debouncedSearch.toLowerCase()
        return TEMPLATES.filter(t => {
            if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
            if (s) return t.name.toLowerCase().includes(s) || t.description.toLowerCase().includes(s)
            return true
        })
    }, [debouncedSearch, categoryFilter])

    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        for (const c of ALL_CATEGORIES) counts[c] = TEMPLATES.filter(t => t.category === c).length
        return counts
    }, [])

    // =========================================================================
    // Mutations
    // =========================================================================

    const invalidateRules = () => {
        queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
        queryClient.invalidateQueries({ queryKey: ['automation-rules-all'] })
    }

    const activateTemplateMut = useMutation({
        mutationFn: (data: { template: AutomationTemplate; name: string }) =>
            api.post('/automation/rules', {
                name: data.name,
                trigger_event: data.template.trigger_event,
                action_type: data.template.action_type,
                conditions: { template_id: data.template.id },
                action_config: {},
                is_active: true,
            }),
        onSuccess: () => { toast.success('Automação ativada com sucesso!'); setConfigTemplate(null); invalidateRules() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao ativar automação'),
    })

    const deactivateTemplateMut = useMutation({
        mutationFn: (ruleId: number) => api.delete(`/automation/rules/${ruleId}`),
        onSuccess: () => { toast.success('Automação desativada'); invalidateRules() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao desativar'),
    })

    const toggleRuleMut = useMutation({
        mutationFn: (id: number) => api.patch(`/automation/rules/${id}/toggle`),
        onSuccess: () => { toast.success('Status alterado'); invalidateRules() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao alterar status'),
    })

    const saveRuleMut = useMutation({
        mutationFn: (data: typeof ruleForm & { id?: number }) => {
            const payload = { ...data, conditions: {}, action_config: {} }
            return data.id ? api.put(`/automation/rules/${data.id}`, payload) : api.post('/automation/rules', payload)
        },
        onSuccess: () => { toast.success(editingRule ? 'Regra atualizada' : 'Regra criada'); setShowRuleModal(false); setEditingRule(null); invalidateRules() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao salvar regra'),
    })

    const deleteRuleMut = useMutation({
        mutationFn: (id: number) => api.delete(`/automation/rules/${id}`),
        onSuccess: () => { toast.success('Regra removida'); invalidateRules() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao remover'),
    })

    const saveWebhookMut = useMutation({
        mutationFn: (data: typeof webhookForm) => {
            const payload = { ...data, events: data.events.split(',').map(e => e.trim()).filter(Boolean) }
            return editingWebhookId ? api.put(`/automation/webhooks/${editingWebhookId}`, payload) : api.post('/automation/webhooks', payload)
        },
        onSuccess: () => { toast.success(editingWebhookId ? 'Webhook atualizado' : 'Webhook criado'); setWebhookModal(false); queryClient.invalidateQueries({ queryKey: ['automation-webhooks'] }) },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao salvar webhook'),
    })

    const deleteWebhookMut = useMutation({
        mutationFn: (id: number) => api.delete(`/automation/webhooks/${id}`),
        onSuccess: () => { toast.success('Webhook removido'); queryClient.invalidateQueries({ queryKey: ['automation-webhooks'] }) },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao remover'),
    })

    const saveReportMut = useMutation({
        mutationFn: (data: typeof reportForm) => {
            const payload = { ...data, recipients: data.recipients.split(',').map(e => e.trim()).filter(Boolean) }
            return editingReportId ? api.put(`/automation/reports/${editingReportId}`, payload) : api.post('/automation/reports', payload)
        },
        onSuccess: () => { toast.success(editingReportId ? 'Relatório atualizado' : 'Relatório criado'); setReportModal(false); setEditingReportId(null); setReportForm(emptyReport); queryClient.invalidateQueries({ queryKey: ['automation-reports'] }) },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao salvar relatório'),
    })

    const deleteReportMut = useMutation({
        mutationFn: (id: number) => api.delete(`/automation/reports/${id}`),
        onSuccess: () => { toast.success('Relatório removido'); queryClient.invalidateQueries({ queryKey: ['automation-reports'] }) },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao remover'),
    })

    // =========================================================================
    // Handlers
    // =========================================================================

    const handleTemplateToggle = (template: AutomationTemplate) => {
        const existingRule = activeTemplateMap.get(template.id)
        if (existingRule) {
            {
                deactivateTemplateMut.mutate(existingRule.id)
            }
        } else {
            setConfigName(template.name)
            setConfigTemplate(template)
        }
    }

    const handleActivateTemplate = () => {
        if (!configTemplate || !configName.trim()) return
        activateTemplateMut.mutate({ template: configTemplate, name: configName.trim() })
    }

    const openCreateRule = () => {
        setEditingRule(null)
        setRuleForm({ name: '', trigger_event: 'os.created', action_type: 'send_notification', is_active: true })
        setShowRuleModal(true)
    }

    const openEditRule = (r: any) => {
        setEditingRule(r)
        setRuleForm({
            name: r.name || '',
            trigger_event: r.trigger_event || 'os.created',
            action_type: r.action_type || 'send_notification',
            is_active: r.is_active ?? true,
        })
        setShowRuleModal(true)
    }

    const openEditWebhook = (w: any) => {
        setEditingWebhookId(w.id)
        setWebhookForm({ name: w.name || '', url: w.url || '', events: Array.isArray(w.events) ? w.events.join(', ') : w.events || '', secret: '', is_active: w.is_active ?? true })
        setWebhookModal(true)
    }

    const openEditReport = (r: any) => {
        setEditingReportId(r.id)
        setReportForm({ name: r.name || '', report_type: r.report_type || 'work-orders', frequency: r.frequency || 'daily', recipients: Array.isArray(r.recipients) ? r.recipients.join(', ') : r.recipients || '', is_active: r.is_active ?? true })
        setReportModal(true)
    }

    // =========================================================================
    // Render Helpers
    // =========================================================================

    const ActionIcon = ({ type }: { type: string }) => {
        switch (type) {
            case 'send_notification': return <Bell size={12} />
            case 'send_email': return <Mail size={12} />
            case 'send_whatsapp': return <MessageSquare size={12} />
            case 'create_alert': return <AlertTriangle size={12} />
            case 'create_task': return <CheckCircle2 size={12} />
            case 'create_chamado': return <Headphones size={12} />
            case 'send_report': return <BarChart3 size={12} />
            default: return <Zap size={12} />
        }
    }

    // =========================================================================
    // Render
    // =========================================================================

    return (
        <div className="space-y-5">
            <PageHeader
                title="Central de Automação"
                subtitle="Configure automações sem programação — ative modelos prontos ou crie suas próprias regras"
            />

            <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-default bg-surface-0 p-4 text-center shadow-card">
                    <div className="text-2xl font-bold text-brand-600">{TEMPLATES.length}</div>
                    <div className="text-xs text-surface-500 mt-0.5">Modelos Disponíveis</div>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 text-center shadow-card">
                    <div className="text-2xl font-bold text-emerald-600">{activeCount}</div>
                    <div className="text-xs text-surface-500 mt-0.5">Regras Ativas</div>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 text-center shadow-card">
                    <div className="text-2xl font-bold text-amber-600">{totalExecutions}</div>
                    <div className="text-xs text-surface-500 mt-0.5">Total de Execuções</div>
                </div>
            </div>

            <div className="flex gap-1 rounded-xl border border-default bg-surface-50 p-1">
                {TABS.map(t => (
                    <button
                        key={t}
                        onClick={() => { setTab(t); setPage(1) }}
                        className={cn(
                            'flex items-center gap-2 flex-1 justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all',
                            tab === t ? 'bg-surface-0 text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700',
                        )}
                    >
                        {t === 'templates' && <Sparkles size={15} />}
                        {t === 'rules' && <Zap size={15} />}
                        {t === 'webhooks' && <Globe size={15} />}
                        {t === 'reports' && <BarChart3 size={15} />}
                        {TAB_LABELS[t]}
                        {t === 'templates' && (
                            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">
                                {TEMPLATES.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {tab === 'templates' && (
                <>
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                        <input
                            type="text"
                            placeholder="Buscar automação por nome ou descrição..."
                            value={templateSearch}
                            onChange={e => setTemplateSearch(e.target.value)}
                            className="w-full rounded-lg border border-default bg-surface-0 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setCategoryFilter('all')}
                            className={cn(
                                'rounded-full px-3 py-1.5 text-xs font-medium transition-all border',
                                categoryFilter === 'all'
                                    ? 'bg-brand-600 text-white border-brand-600'
                                    : 'bg-surface-0 text-surface-600 border-default hover:border-brand-300',
                            )}
                        >
                            Todos ({TEMPLATES.length})
                        </button>
                        {ALL_CATEGORIES.map(cat => {
                            const meta = CATEGORY_META[cat]
                            const Icon = CATEGORY_ICONS[cat]
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}
                                    className={cn(
                                        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border',
                                        categoryFilter === cat
                                            ? cn(meta.bg, meta.color, meta.border)
                                            : 'bg-surface-0 text-surface-600 border-default hover:border-brand-300',
                                    )}
                                >
                                    <Icon size={12} />
                                    {meta.label} ({categoryCounts[cat]})
                                </button>
                            )
                        })}
                    </div>

                    {filteredTemplates.length === 0 ? (
                        <div className="rounded-xl border border-default bg-surface-0 p-12 text-center shadow-card">
                            <Search size={40} className="mx-auto text-surface-300" />
                            <p className="mt-3 text-sm text-surface-500">Nenhum modelo encontrado para esta busca.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filteredTemplates.map(template => {
                                const isActive = activeTemplateMap.has(template.id)
                                const meta = CATEGORY_META[template.category]
                                const Icon = CATEGORY_ICONS[template.category]

                                return (
                                    <div
                                        key={template.id}
                                        className={cn(
                                            'group relative rounded-xl border bg-surface-0 p-4 transition-all hover:shadow-elevated',
                                            isActive ? 'border-emerald-300 bg-emerald-50/30' : 'border-default hover:border-brand-200',
                                        )}
                                    >
                                        {template.recommended && (
                                            <div className="absolute -top-2 right-3">
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                                                    <Star size={10} className="fill-amber-500 text-amber-500" /> Recomendada
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <div className={cn('shrink-0 rounded-lg p-2', meta.bg)}>
                                                    <Icon size={18} className={meta.color} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-medium text-surface-900 text-sm leading-tight">{template.name}</h4>
                                                    <p className="text-xs text-surface-500 mt-1 line-clamp-2">{template.description}</p>
                                                </div>
                                            </div>
                                            <Toggle
                                                checked={isActive}
                                                onChange={() => handleTemplateToggle(template)}
                                                disabled={activateTemplateMut.isPending || deactivateTemplateMut.isPending}
                                            />
                                        </div>

                                        <div className="mt-3 flex items-center gap-1.5 text-xs">
                                            <span className="rounded bg-surface-100 px-1.5 py-0.5 text-surface-600 truncate max-w-[45%]">
                                                {template.trigger_label}
                                            </span>
                                            <ArrowRight size={10} className="text-surface-400 shrink-0" />
                                            <span className="flex items-center gap-1 rounded bg-surface-100 px-1.5 py-0.5 text-surface-600 truncate max-w-[45%]">
                                                <ActionIcon type={template.action_type} />
                                                {template.action_label}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-subtle">
                                            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', meta.bg, meta.color)}>
                                                {meta.label}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {isActive && (
                                                    <>
                                                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                                                            <Power size={10} /> Ativa
                                                        </span>
                                                        <button
                                                            onClick={() => {
                                                                const rule = activeTemplateMap.get(template.id)
                                                                if (rule) openEditRule(rule)
                                                            }}
                                                            className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                                                        >
                                                            Configurar
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            )}

            {tab === 'rules' && (
                <>
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                            <input
                                type="text"
                                placeholder="Buscar regra..."
                                value={rulesSearch}
                                onChange={e => { setRulesSearch(e.target.value); setPage(1) }}
                                className="w-full rounded-lg border border-default bg-surface-0 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                            />
                        </div>
                        <button
                            onClick={openCreateRule}
                            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                        >
                            <Plus size={16} /> Nova Regra Personalizada
                        </button>
                    </div>

                    <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-subtle bg-surface-50">
                                    <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Nome</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Quando acontece</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Ação</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Execuções</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                                    <th className="px-4 py-2.5 text-right font-semibold text-surface-600">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {loadingRules && (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>
                                )}
                                {!loadingRules && rules.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center">
                                            <Zap size={32} className="mx-auto text-surface-300" />
                                            <p className="mt-2 text-surface-500">Nenhuma regra criada ainda.</p>
                                            <p className="text-xs text-surface-400 mt-1">
                                                Vá até "Modelos Prontos" para ativar automações ou crie uma regra personalizada.
                                            </p>
                                        </td>
                                    </tr>
                                )}
                                {rules.map((r: any) => (
                                    <tr key={r.id} className="transition-colors hover:bg-surface-50/50">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-surface-900">{r.name}</span>
                                                {r.conditions?.template_id && (
                                                    <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-600">
                                                        modelo
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-surface-600">
                                            {TRIGGER_EVENT_LABELS[r.trigger_event] || r.trigger_event}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="flex items-center gap-1.5 text-xs text-surface-600">
                                                <ActionIcon type={r.action_type} />
                                                {ACTION_TYPE_LABELS[r.action_type] || r.action_type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-surface-600">{r.execution_count ?? 0}</td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => toggleRuleMut.mutate(r.id)}
                                                className={cn(
                                                    'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                                                    r.is_active
                                                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                        : 'bg-surface-100 text-surface-500 hover:bg-surface-200',
                                                )}
                                            >
                                                {r.is_active ? 'Ativa' : 'Inativa'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => openEditRule(r)}
                                                    className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-brand-600"
                                                    title="Editar"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => deleteRuleMut.mutate(r.id)}
                                                    className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginação */}
                    {(rulesPageData?.last_page ?? 1) > 1 && (
                        <div className="flex items-center justify-center gap-2">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                                className="rounded-lg border border-default p-2 text-surface-500 hover:bg-surface-50 disabled:opacity-40"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-sm text-surface-600">
                                Página {page} de {rulesPageData?.last_page ?? 1}
                            </span>
                            <button
                                disabled={page >= (rulesPageData?.last_page ?? 1)}
                                onClick={() => setPage(p => p + 1)}
                                className="rounded-lg border border-default p-2 text-surface-500 hover:bg-surface-50 disabled:opacity-40"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* ============================================================= */}
            {/* TAB: WEBHOOKS                                                 */}
            {/* ============================================================= */}
            {tab === 'webhooks' && (
                <>
                    <div className="flex justify-end">
                        <button
                            onClick={() => { setEditingWebhookId(null); setWebhookForm(emptyWebhook); setWebhookModal(true) }}
                            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                        >
                            <Plus size={16} /> Novo Webhook
                        </button>
                    </div>
                    <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-subtle bg-surface-50">
                                    <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Nome</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-surface-600">URL</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Eventos</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Último Disparo</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                                    <th className="px-4 py-2.5 text-right font-semibold text-surface-600">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {loadingWebhooks && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                                {!loadingWebhooks && webhooks.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Nenhum webhook configurado</td></tr>}
                                {webhooks.map((w: any) => (
                                    <tr key={w.id} className="transition-colors hover:bg-surface-50/50">
                                        <td className="px-4 py-3 font-medium text-surface-900">{w.name}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-surface-500 max-w-[200px] truncate">{w.url}</td>
                                        <td className="px-4 py-3 text-xs text-surface-600">{Array.isArray(w.events) ? w.events.join(', ') : w.events}</td>
                                        <td className="px-4 py-3 text-surface-600">{w.last_triggered_at ? new Date(w.last_triggered_at).toLocaleString('pt-BR') : '—'}</td>
                                        <td className="px-4 py-3">
                                            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', w.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-600')}>
                                                {w.is_active ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => openEditWebhook(w)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-brand-600"><Pencil size={14} /></button>
                                                <button onClick={() => deleteWebhookMut.mutate(w.id)} className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ============================================================= */}
            {/* TAB: RELATÓRIOS AGENDADOS                                     */}
            {/* ============================================================= */}
            {tab === 'reports' && (
                <>
                    <div className="flex justify-end">
                        <button
                            onClick={() => { setEditingReportId(null); setReportForm(emptyReport); setReportModal(true) }}
                            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                        >
                            <Plus size={16} /> Novo Relatório
                        </button>
                    </div>
                    <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-subtle bg-surface-50">
                                    <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Nome</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Tipo</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Frequência</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Destinatários</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Último Envio</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                                    <th className="px-4 py-2.5 text-right font-semibold text-surface-600">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {loadingReports && <tr><td colSpan={7} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                                {!loadingReports && reports.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-surface-400">Nenhum relatório agendado</td></tr>}
                                {reports.map((r: any) => (
                                    <tr key={r.id} className="transition-colors hover:bg-surface-50/50">
                                        <td className="px-4 py-3 font-medium text-surface-900">{r.name}</td>
                                        <td className="px-4 py-3 text-xs text-surface-600">{r.report_type}</td>
                                        <td className="px-4 py-3"><span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{r.frequency === 'daily' ? 'Diário' : r.frequency === 'weekly' ? 'Semanal' : r.frequency === 'monthly' ? 'Mensal' : r.frequency}</span></td>
                                        <td className="px-4 py-3 text-xs text-surface-600 max-w-[200px] truncate">{Array.isArray(r.recipients) ? r.recipients.join(', ') : r.recipients}</td>
                                        <td className="px-4 py-3 text-surface-600">{r.last_sent_at ? new Date(r.last_sent_at).toLocaleString('pt-BR') : '—'}</td>
                                        <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-600')}>{r.is_active ? 'Ativo' : 'Inativo'}</span></td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => openEditReport(r)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-brand-600"><Pencil size={14} /></button>
                                                <button onClick={() => deleteReportMut.mutate(r.id)} className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ============================================================= */}
            {/* MODAL: Ativar Modelo de Automação                             */}
            {/* ============================================================= */}
            {configTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfigTemplate(null)}>
                    <div className="w-full max-w-lg rounded-2xl border border-default bg-surface-0 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-surface-900">Ativar Automação</h3>
                            <button onClick={() => setConfigTemplate(null)} className="rounded-lg p-1 hover:bg-surface-100"><X size={18} /></button>
                        </div>

                        <div className={cn('rounded-xl p-4 mb-5', CATEGORY_META[configTemplate.category].bg)}>
                            <div className="flex items-start gap-3">
                                {(() => { const Icon = CATEGORY_ICONS[configTemplate.category]; return <Icon size={20} className={CATEGORY_META[configTemplate.category].color} /> })()}
                                <div>
                                    <h4 className="font-medium text-surface-900">{configTemplate.name}</h4>
                                    <p className="text-xs text-surface-600 mt-1">{configTemplate.description}</p>
                                    <div className="flex items-center gap-2 mt-3 text-xs text-surface-500">
                                        <span className="rounded bg-surface-0/60 dark:bg-surface-700/60 px-2 py-0.5">{configTemplate.trigger_label}</span>
                                        <ArrowRight size={10} />
                                        <span className="rounded bg-surface-0/60 dark:bg-surface-700/60 px-2 py-0.5">{configTemplate.action_label}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={e => { e.preventDefault(); handleActivateTemplate() }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">
                                    Nome da regra <span className="text-red-500">*</span>
                                </label>
                                <input
                                    required
                                    value={configName}
                                    onChange={e => setConfigName(e.target.value)}
                                    className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                    placeholder="Nome personalizado para esta automação"
                                />
                                <p className="text-xs text-surface-400 mt-1">Você pode personalizar o nome ou manter o padrão.</p>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setConfigTemplate(null)}
                                    className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={activateTemplateMut.isPending}
                                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                >
                                    <Power size={14} />
                                    {activateTemplateMut.isPending ? 'Ativando...' : 'Ativar Automação'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showRuleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowRuleModal(false); setEditingRule(null) }}>
                    <div className="w-full max-w-lg rounded-2xl border border-default bg-surface-0 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold text-surface-900">
                                {editingRule ? 'Editar Regra' : 'Nova Regra Personalizada'}
                            </h3>
                            <button onClick={() => { setShowRuleModal(false); setEditingRule(null) }} className="rounded-lg p-1 hover:bg-surface-100"><X size={18} /></button>
                        </div>
                        <form
                            onSubmit={e => {
                                e.preventDefault()
                                saveRuleMut.mutate(editingRule ? { ...ruleForm, id: editingRule.id } : ruleForm)
                            }}
                            className="space-y-4"
                        >
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">
                                    Nome da regra <span className="text-red-500">*</span>
                                </label>
                                <input
                                    required
                                    value={ruleForm.name}
                                    onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })}
                                    className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                    placeholder="Ex: Notificar quando OS for concluída"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">
                                    Quando acontecer... <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={ruleForm.trigger_event}
                                    onChange={e => setRuleForm({ ...ruleForm, trigger_event: e.target.value })}
                                    className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                >
                                    {ALL_TRIGGER_EVENTS.map(ev => (
                                        <option key={ev} value={ev}>{TRIGGER_EVENT_LABELS[ev]}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">
                                    Então fazer... <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={ruleForm.action_type}
                                    onChange={e => setRuleForm({ ...ruleForm, action_type: e.target.value })}
                                    className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                >
                                    {ALL_ACTION_TYPES.map(at => (
                                        <option key={at} value={at}>{ACTION_TYPE_LABELS[at]}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-50">
                                <Toggle
                                    checked={ruleForm.is_active}
                                    onChange={v => setRuleForm({ ...ruleForm, is_active: v })}
                                />
                                <span className="text-sm text-surface-700">
                                    {ruleForm.is_active ? 'Regra ativa — será executada automaticamente' : 'Regra inativa — não será executada'}
                                </span>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowRuleModal(false); setEditingRule(null) }}
                                    className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saveRuleMut.isPending}
                                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                                >
                                    {saveRuleMut.isPending ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {webhookModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setWebhookModal(false)}>
                    <div className="w-full max-w-lg rounded-2xl border border-default bg-surface-0 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold text-surface-900">{editingWebhookId ? 'Editar Webhook' : 'Novo Webhook'}</h3>
                            <button onClick={() => setWebhookModal(false)} className="rounded-lg p-1 hover:bg-surface-100"><X size={18} /></button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); saveWebhookMut.mutate(webhookForm) }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Nome *</label>
                                <input required value={webhookForm.name} onChange={e => setWebhookForm({ ...webhookForm, name: e.target.value })}
                                    className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="Meu Webhook" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">URL *</label>
                                <input required type="url" value={webhookForm.url} onChange={e => setWebhookForm({ ...webhookForm, url: e.target.value })}
                                    className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="https://..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Eventos (separados por vírgula)</label>
                                <input value={webhookForm.events} onChange={e => setWebhookForm({ ...webhookForm, events: e.target.value })}
                                    className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="os.created, os.completed" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Secret (opcional)</label>
                                <input value={webhookForm.secret} onChange={e => setWebhookForm({ ...webhookForm, secret: e.target.value })}
                                    className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="hmac-secret" />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setWebhookModal(false)} className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">Cancelar</button>
                                <button type="submit" disabled={saveWebhookMut.isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                                    {saveWebhookMut.isPending ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {reportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setReportModal(false)}>
                    <div className="w-full max-w-lg rounded-2xl border border-default bg-surface-0 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold text-surface-900">{editingReportId ? 'Editar Relatório' : 'Novo Relatório Agendado'}</h3>
                            <button onClick={() => setReportModal(false)} className="rounded-lg p-1 hover:bg-surface-100"><X size={18} /></button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); saveReportMut.mutate(reportForm) }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Nome *</label>
                                <input required value={reportForm.name} onChange={e => setReportForm({ ...reportForm, name: e.target.value })}
                                    className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="Relatório semanal de OS" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 mb-1">Tipo</label>
                                    <select value={reportForm.report_type} onChange={e => setReportForm({ ...reportForm, report_type: e.target.value })}
                                        className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100">
                                        <option value="work-orders">Ordens de Serviço</option>
                                        <option value="productivity">Produtividade</option>
                                        <option value="financial">Financeiro</option>
                                        <option value="commissions">Comissões</option>
                                        <option value="profitability">Lucratividade</option>
                                        <option value="quotes">Orçamentos</option>
                                        <option value="service-calls">Chamados</option>
                                        <option value="technician-cash">Caixa Técnico</option>
                                        <option value="crm">CRM</option>
                                        <option value="equipments">Equipamentos</option>
                                        <option value="suppliers">Fornecedores</option>
                                        <option value="stock">Estoque</option>
                                        <option value="customers">Clientes</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 mb-1">Frequência</label>
                                    <select value={reportForm.frequency} onChange={e => setReportForm({ ...reportForm, frequency: e.target.value })}
                                        className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100">
                                        <option value="daily">Diário</option>
                                        <option value="weekly">Semanal</option>
                                        <option value="monthly">Mensal</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Destinatários (e-mails separados por vírgula)</label>
                                <input value={reportForm.recipients} onChange={e => setReportForm({ ...reportForm, recipients: e.target.value })}
                                    className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="admin@empresa.com, gestor@empresa.com" />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setReportModal(false)} className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">Cancelar</button>
                                <button type="submit" disabled={saveReportMut.isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                                    {saveReportMut.isPending ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
