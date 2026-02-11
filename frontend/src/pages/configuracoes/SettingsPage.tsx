import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Settings, History, Save, Search,
    User, Calendar, ArrowRight, Shield,
    MessageSquare, Mail, Building2, GitBranch,
    ChevronDown, ChevronUp, Download, CheckCircle2,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'

type Tab = 'settings' | 'audit'

const actionLabels: Record<string, { label: string; variant: any }> = {
    created: { label: 'Criado', variant: 'success' },
    updated: { label: 'Atualizado', variant: 'info' },
    deleted: { label: 'Excluído', variant: 'danger' },
    login: { label: 'Login', variant: 'default' },
    logout: { label: 'Logout', variant: 'default' },
    status_changed: { label: 'Status Alterado', variant: 'warning' },
}

const settingGroups: Record<string, { label: string; icon: any }> = {
    general: { label: 'Empresa', icon: Building2 },
    os: { label: 'Ordens de Serviço', icon: Settings },
    quotes: { label: 'Orçamentos', icon: Settings },
    financial: { label: 'Financeiro', icon: Shield },
    notification: { label: 'Notificações', icon: Settings },
    whatsapp: { label: 'WhatsApp / Evolution API', icon: MessageSquare },
    smtp: { label: 'E-mail / SMTP', icon: Mail },
    crm: { label: 'CRM', icon: GitBranch },
}
interface SettingItem {
    id?: number; key: string; value: string; type: string; group: string
}

const defaultSettings: SettingItem[] = [
    // Empresa
    { key: 'company_name', value: '', type: 'string', group: 'general' },
    { key: 'company_phone', value: '', type: 'string', group: 'general' },
    { key: 'company_email', value: '', type: 'string', group: 'general' },
    { key: 'company_document', value: '', type: 'string', group: 'general' },
    { key: 'company_logo_url', value: '', type: 'string', group: 'general' },
    { key: 'company_address', value: '', type: 'string', group: 'general' },
    // OS
    { key: 'default_warranty_days', value: '90', type: 'integer', group: 'os' },
    { key: 'auto_generate_os_number', value: 'true', type: 'boolean', group: 'os' },
    { key: 'require_approval_above', value: '500', type: 'integer', group: 'os' },
    { key: 'os_number_prefix', value: 'OS-', type: 'string', group: 'os' },
    // Orcamentos
    { key: 'quote_sequence_start', value: '1', type: 'integer', group: 'quotes' },
    // Financeiro
    { key: 'default_payment_method', value: 'pix', type: 'string', group: 'financial' },
    { key: 'late_fee_percentage', value: '2', type: 'integer', group: 'financial' },
    { key: 'auto_generate_invoice', value: 'true', type: 'boolean', group: 'financial' },
    // Notificacoes
    { key: 'notify_overdue', value: 'true', type: 'boolean', group: 'notification' },
    { key: 'notify_os_completed', value: 'true', type: 'boolean', group: 'notification' },
    { key: 'notify_new_deal', value: 'true', type: 'boolean', group: 'notification' },
    // WhatsApp
    { key: 'evolution_api_url', value: '', type: 'string', group: 'whatsapp' },
    { key: 'evolution_api_key', value: '', type: 'string', group: 'whatsapp' },
    { key: 'evolution_instance', value: '', type: 'string', group: 'whatsapp' },
    { key: 'whatsapp_enabled', value: 'false', type: 'boolean', group: 'whatsapp' },
    // SMTP
    { key: 'smtp_host', value: '', type: 'string', group: 'smtp' },
    { key: 'smtp_port', value: '587', type: 'integer', group: 'smtp' },
    { key: 'smtp_user', value: '', type: 'string', group: 'smtp' },
    { key: 'smtp_password', value: '', type: 'string', group: 'smtp' },
    { key: 'smtp_encryption', value: 'tls', type: 'string', group: 'smtp' },
    { key: 'smtp_from_name', value: '', type: 'string', group: 'smtp' },
    { key: 'smtp_from_email', value: '', type: 'string', group: 'smtp' },
    // CRM
    { key: 'crm_default_pipeline', value: 'Vendas', type: 'string', group: 'crm' },
    { key: 'crm_auto_create_activity', value: 'true', type: 'boolean', group: 'crm' },
    { key: 'crm_deal_rot_days', value: '14', type: 'integer', group: 'crm' },
    { key: 'crm_enable_scoring', value: 'true', type: 'boolean', group: 'crm' },
]
const settingLabels: Record<string, string> = {
    company_name: 'Nome da Empresa',
    company_phone: 'Telefone',
    company_email: 'E-mail',
    company_document: 'CNPJ/CPF',
    company_logo_url: 'URL do Logo',
    company_address: 'Endereço Completo',
    default_warranty_days: 'Dias de Garantia Padrão',
    auto_generate_os_number: 'Gerar Número OS Automaticamente',
    require_approval_above: 'Exigir Aprovação Acima de (R$)',
    os_number_prefix: 'Prefixo da Numeração OS',
    quote_sequence_start: 'Início da Sequência dos Orçamentos',
    default_payment_method: 'Forma de Pagamento Padrão',
    late_fee_percentage: 'Multa por Atraso (%)',
    auto_generate_invoice: 'Gerar Fatura Automaticamente ao Concluir OS',
    notify_overdue: 'Notificar Vencimentos',
    notify_os_completed: 'Notificar OS Concluída',
    notify_new_deal: 'Notificar Novo Negócio CRM',
    evolution_api_url: 'URL da Evolution API',
    evolution_api_key: 'API Key',
    evolution_instance: 'Nome da Instância',
    whatsapp_enabled: 'WhatsApp Ativo',
    smtp_host: 'Servidor SMTP',
    smtp_port: 'Porta',
    smtp_user: 'Usuário',
    smtp_password: 'Senha',
    smtp_encryption: 'Criptografia (tls/ssl)',
    smtp_from_name: 'Nome do Remetente',
    smtp_from_email: 'E-mail do Remetente',
    crm_default_pipeline: 'Pipeline Padrão',
    crm_auto_create_activity: 'Criar Atividade Automática em Novo Negócio',
    crm_deal_rot_days: 'Dias Sem Atividade para "Rot" do Negócio',
    crm_enable_scoring: 'Ativar Lead Scoring',
}
export function SettingsPage() {
    const qc = useQueryClient()
    const [tab, setTab] = useState<Tab>('settings')
    const [actionFilter, setActionFilter] = useState('')
    const [entityFilter, setEntityFilter] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [expandedLog, setExpandedLog] = useState<number | null>(null)

    // Settings
    const { data: settingsRes } = useQuery({
        queryKey: ['settings'],
        queryFn: () => api.get('/settings'),
        enabled: tab === 'settings',
    })
    const serverSettings = settingsRes?.data ?? []

    const mergedSettings = defaultSettings.map(d => {
        const existing = serverSettings.find((s: SettingItem) => s.key === d.key)
        return existing ? { ...d, ...existing } : d
    })

    const [localSettings, setLocalSettings] = useState<Record<string, string>>({})
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    const getVal = (key: string) => localSettings[key] ?? mergedSettings.find(s => s.key === key)?.value ?? ''

    const setVal = (key: string, value: string) => setLocalSettings(p => ({ ...p, [key]: value }))

    const saveMut = useMutation({
        mutationFn: () => {
            const settings = mergedSettings.map(s => ({
                key: s.key, value: localSettings[s.key] ?? s.value, type: s.type, group: s.group,
            }))
            return api.put('/settings', { settings })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['settings'] })
            setLocalSettings({})
            setSuccessMessage('Configurações salvas com sucesso!')
            setTimeout(() => setSuccessMessage(null), 4000)
        },
    })

    // Audit
    const { data: auditRes } = useQuery({
        queryKey: ['audit-logs', actionFilter, entityFilter, dateFrom, dateTo],
        queryFn: () => api.get('/audit-logs', {
            params: {
                action: actionFilter || undefined,
                auditable_type: entityFilter || undefined,
                from: dateFrom || undefined,
                to: dateTo || undefined,
                per_page: 50,
            },
        }),
        enabled: tab === 'audit',
    })
    const auditLogs = auditRes?.data?.data ?? []

    const grouped = Object.entries(settingGroups).map(([group, cfg]) => ({
        group, label: cfg.label,
        items: mergedSettings.filter(s => s.group === group),
    })).filter(g => g.items.length > 0)

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Configurações</h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Parametrizações do sistema e logs de auditoria</p>
                </div>
                {tab === 'settings' && (
                    <Button icon={<Save className="h-4 w-4" />} onClick={() => saveMut.mutate()} loading={saveMut.isPending}>
                        Salvar
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex rounded-lg border border-surface-200 bg-surface-50 p-0.5 w-fit">
                {([{ key: 'settings' as const, label: 'Configurações', icon: Settings }, { key: 'audit' as const, label: 'Auditoria', icon: History }]).map(t => {
                    const Icon = t.icon
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                                tab === t.key ? 'bg-white text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700')}>
                            <Icon className="h-3.5 w-3.5" />{t.label}
                        </button>
                    )
                })}
            </div>

            {/* Settings Tab */}
            {tab === 'settings' && (
                <div className="space-y-5">
                    {grouped.map(g => (
                        <div key={g.group} className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-700">
                                {(() => { const GIcon = settingGroups[g.group]?.icon ?? Shield; return <GIcon className="h-4 w-4 text-brand-500" /> })()}
                                {settingGroups[g.group]?.label ?? g.group}
                            </h3>
                            <div className="space-y-4">
                                {g.items.map(s => (
                                    <div key={s.key} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                                        <label className="text-sm font-medium text-surface-600">{settingLabels[s.key] ?? s.key}</label>
                                        {s.type === 'boolean' ? (
                                            <button onClick={() => setVal(s.key, getVal(s.key) === 'true' ? 'false' : 'true')}
                                                aria-label={settingLabels[s.key] ?? s.key}
                                                className={cn('relative h-6 w-11 rounded-full transition-colors',
                                                    getVal(s.key) === 'true' ? 'bg-brand-500' : 'bg-surface-300')}>
                                                <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow',
                                                    getVal(s.key) === 'true' && 'translate-x-5')} />
                                            </button>
                                        ) : (
                                            <input value={getVal(s.key)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal(s.key, e.target.value)}
                                                type={s.type === 'integer' ? 'number' : 'text'}
                                                aria-label={settingLabels[s.key] ?? s.key}
                                                className="w-full max-w-xs rounded-lg border border-default bg-surface-50 px-3.5 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Audit Tab */}
            {tab === 'audit' && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <select value={actionFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setActionFilter(e.target.value)}
                            aria-label="Filtrar por ação"
                            className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                            <option value="">Todas ações</option>
                            {Object.entries(actionLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <select value={entityFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEntityFilter(e.target.value)}
                            aria-label="Filtrar por entidade"
                            className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                            <option value="">Todas entidades</option>
                            <option value="WorkOrder">Ordem de Serviço</option>
                            <option value="Quote">Orçamento</option>
                            <option value="Customer">Cliente</option>
                            <option value="CrmDeal">Negócio CRM</option>
                            <option value="Equipment">Equipamento</option>
                            <option value="Tenant">Empresa</option>
                            <option value="User">Usuário</option>
                        </select>
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-surface-400" />
                            <input type="date" value={dateFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)}
                                aria-label="Data início auditoria"
                                className="rounded-lg border border-default bg-surface-50 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
                            <ArrowRight className="h-3.5 w-3.5 text-surface-400" />
                            <input type="date" value={dateTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value)}
                                aria-label="Data fim auditoria"
                                className="rounded-lg border border-default bg-surface-50 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
                        </div>
                        <button onClick={() => {
                            const rows = auditLogs.map((l: any) => `${l.created_at},${l.user?.name ?? ''},${l.action},"${l.description}",${l.ip_address ?? ''}`)
                            const csv = `Data,Usu\u00e1rio,A\u00e7\u00e3o,Descri\u00e7\u00e3o,IP\n${rows.join('\n')}`
                            const blob = new Blob([csv], { type: 'text/csv' })
                            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'audit_logs.csv'; a.click()
                        }} className="inline-flex items-center gap-1.5 rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 transition-colors duration-100"
                            title="Exportar CSV">
                            <Download className="h-3.5 w-3.5" /> CSV
                        </button>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-subtle bg-surface-50">
                                    <th className="w-8 px-2 py-3" />
                                    <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Data</th>
                                    <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Usuário</th>
                                    <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Ação</th>
                                    <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Descrição</th>
                                    <th className="hidden px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600 md:table-cell">Entidade</th>
                                    <th className="hidden px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600 md:table-cell">IP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {auditLogs.length === 0 ? (
                                    <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-surface-500">Nenhum registro</td></tr>
                                ) : auditLogs.map((log: any) => {
                                    const hasChanges = log.old_values || log.new_values
                                    const isExpanded = expandedLog === log.id
                                    const entityName = log.auditable_type?.split('\\').pop() ?? ''
                                    return (
                                        <>
                                            <tr key={log.id} className={cn('hover:bg-surface-50 transition-colors duration-100', hasChanges && 'cursor-pointer')}
                                                onClick={() => hasChanges && setExpandedLog(isExpanded ? null : log.id)}>
                                                <td className="px-2 py-3 text-center">
                                                    {hasChanges && (isExpanded
                                                        ? <ChevronUp className="h-3.5 w-3.5 text-surface-400 mx-auto" />
                                                        : <ChevronDown className="h-3.5 w-3.5 text-surface-400 mx-auto" />)}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-surface-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                                                <td className="px-4 py-3 text-[13px] font-medium text-surface-900">{log.user?.name ?? '\u2014'}</td>
                                                <td className="px-4 py-3">
                                                    <Badge variant={actionLabels[log.action]?.variant ?? 'default'}>
                                                        {actionLabels[log.action]?.label ?? log.action}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-[13px] text-surface-600">{log.description}</td>
                                                <td className="hidden px-4 py-3 text-xs text-surface-400 md:table-cell">
                                                    {entityName && <span className="rounded bg-surface-100 px-1.5 py-0.5 text-xs font-medium">{entityName}</span>}
                                                </td>
                                                <td className="hidden px-4 py-3 text-xs text-surface-400 md:table-cell">{log.ip_address}</td>
                                            </tr>
                                            {isExpanded && hasChanges && (
                                                <tr key={`${log.id}-diff`}>
                                                    <td colSpan={7} className="px-6 py-4 bg-surface-50">
                                                        <div className="rounded-lg border border-default bg-surface-0 p-4">
                                                            <h4 className="text-xs font-semibold text-surface-700 mb-3">Alterações</h4>
                                                            <div className="space-y-2 text-xs font-mono">
                                                                {Object.keys({ ...(log.old_values ?? {}), ...(log.new_values ?? {}) }).map((key: string) => {
                                                                    const oldVal = log.old_values?.[key]
                                                                    const newVal = log.new_values?.[key]
                                                                    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return null
                                                                    return (
                                                                        <div key={key} className="flex items-start gap-2">
                                                                            <span className="font-semibold text-surface-600 min-w-[120px]">{key}:</span>
                                                                            <div className="flex flex-col gap-0.5">
                                                                                {oldVal !== undefined && (
                                                                                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700 line-through">
                                                                                        {typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)}
                                                                                    </span>
                                                                                )}
                                                                                {newVal !== undefined && (
                                                                                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                                                                                        {typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Success Toast */}
            {successMessage && (
                <div className="fixed bottom-6 right-6 z-[70] flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm text-white shadow-xl animate-slide-up">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    <span>{successMessage}</span>
                </div>
            )}
        </div>
    )
}


