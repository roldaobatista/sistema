import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Search, Plus, Zap, Clock, Globe, ChevronLeft, ChevronRight,
    Play, Pause, Trash2, FileText, AlertTriangle, CheckCircle2
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/pageheader'
import { useAuthStore } from '@/stores/auth-store'

const tabs = ['rules', 'webhooks', 'reports'] as const
type Tab = typeof tabs[number]
const tabLabels: Record<Tab, string> = {
    rules: 'Regras de Automação', webhooks: 'Webhooks', reports: 'Relatórios Agendados'
}

export default function AutomationPage() {
    const { hasPermission } = useAuthStore()

    const [tab, setTab] = useState<Tab>('rules')
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const queryClient = useQueryClient()

    const { data: rulesData, isLoading: loadingRules } = useQuery({
        queryKey: ['automation-rules', search, page],
        queryFn: () => api.get('/automation/rules', { params: { search: search || undefined, page, per_page: 20 } }).then(r => r.data),
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

    const toggleRule = useMutation({
        mutationFn: (id: number) => api.patch(`/automation/rules/${id}/toggle`),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
            queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
        },
        onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao alterar regra') },
    })

    const deleteRule = useMutation({
        mutationFn: (id: number) => api.delete(`/automation/rules/${id}`),
        onSuccess: () => { toast.success('Regra removida com sucesso'); queryClient.invalidateQueries({ queryKey: ['automation-rules'] }) },
        onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover regra') },
    })
    const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover esta regra?')) deleteRule.mutate(id) }

    const rules = rulesData?.data ?? []
    const webhooks = webhooksData?.data ?? []
    const reports = reportsData?.data ?? []

    return (
        <div className="space-y-5">
            <PageHeader title="Automação" subtitle="Regras no-code, webhooks e relatórios agendados" />

            <div className="flex gap-1 rounded-xl border border-default bg-surface-50 p-1">
                {tabs.map(t => (
                    <button key={t} onClick={() => { setTab(t); setPage(1) }}
                        className={cn('flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                            tab === t ? 'bg-surface-0 text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'
                        )}>{tabLabels[t]}</button>
                ))}
            </div>

            {/* RULES */}
            {tab === 'rules' && (
                <>
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                        <input type="text" placeholder="Buscar regra..." value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                            className="w-full rounded-lg border border-default bg-surface-0 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                    </div>
                    <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-subtle bg-surface-50">
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Nome</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Evento</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Ação</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Execuções</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Ações</th>
                            </tr></thead>
                            <tbody className="divide-y divide-subtle">
                                {loadingRules && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                                {!loadingRules && rules.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Nenhuma regra criada</td></tr>}
                                {rules.map((r: any) => (
                                    <tr key={r.id} className="transition-colors hover:bg-surface-50/50">
                                        <td className="px-4 py-3 font-medium text-surface-900">{r.name}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-brand-600">{r.trigger_event}</td>
                                        <td className="px-4 py-3 text-xs text-surface-600">{r.action_type}</td>
                                        <td className="px-4 py-3 text-surface-600">{r.execution_count ?? 0}</td>
                                        <td className="px-4 py-3">
                                            <button onClick={() => toggleRule.mutate(r.id)} className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                                                r.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
                                            )}>{r.is_active ? 'Ativa' : 'Inativa'}</button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button className="rounded-lg bg-surface-100 px-2.5 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-200">
                                                <Zap size={12} className="inline mr-1" />Editar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* WEBHOOKS */}
            {tab === 'webhooks' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Nome</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">URL</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Eventos</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Ãšltimo Trigger</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingWebhooks && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingWebhooks && webhooks.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Nenhum webhook</td></tr>}
                            {webhooks.map((w: any) => (
                                <tr key={w.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-medium text-surface-900">{w.name}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-surface-500 max-w-[200px] truncate">{w.url}</td>
                                    <td className="px-4 py-3 text-xs text-surface-600">{Array.isArray(w.events) ? w.events.join(', ') : w.events}</td>
                                    <td className="px-4 py-3 text-surface-600">{w.last_triggered_at ? new Date(w.last_triggered_at).toLocaleString('pt-BR') : 'â€”'}</td>
                                    <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
                                        w.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-600'
                                    )}>{w.is_active ? 'Ativo' : 'Inativo'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* REPORTS */}
            {tab === 'reports' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Nome</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Tipo</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Frequência</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Destinatários</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Ãšltimo Envio</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingReports && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingReports && reports.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Nenhum relatório agendado</td></tr>}
                            {reports.map((r: any) => (
                                <tr key={r.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-medium text-surface-900">{r.name}</td>
                                    <td className="px-4 py-3 text-xs text-surface-600">{r.report_type}</td>
                                    <td className="px-4 py-3"><span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{r.frequency}</span></td>
                                    <td className="px-4 py-3 text-xs text-surface-600 max-w-[200px] truncate">{Array.isArray(r.recipients) ? r.recipients.join(', ') : r.recipients}</td>
                                    <td className="px-4 py-3 text-surface-600">{r.last_sent_at ? new Date(r.last_sent_at).toLocaleString('pt-BR') : 'â€”'}</td>
                                    <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
                                        r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-600'
                                    )}>{r.is_active ? 'Ativo' : 'Inativo'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
