import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    History, Search, Filter, Eye, X, ArrowRight, User, Calendar
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'

const actionConfig: Record<string, { label: string; variant: any }> = {
    created: { label: 'Criado', variant: 'success' },
    updated: { label: 'Atualizado', variant: 'warning' },
    deleted: { label: 'Excluído', variant: 'danger' },
    login: { label: 'Login', variant: 'info' },
    logout: { label: 'Logout', variant: 'default' },
    status_changed: { label: 'Status', variant: 'brand' },
}

const fmtDate = (d: string) => new Date(d).toLocaleString('pt-BR')

export function AuditLogsPage() {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [selectedLog, setSelectedLog] = useState<any>(null)
    const [filters, setFilters] = useState({ user_id: '', action: '', date_from: '', date_to: '' })

    const { data: res, isLoading } = useQuery({
        queryKey: ['audit-logs', page, search, filters],
        queryFn: () => api.get('/audit-logs', {
            params: {
                page, search: search || undefined,
                ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
            }
        }),
    })

    const logs = res?.data?.data ?? []
    const meta = res?.data ?? {}

    const renderDiff = (oldVal: any, newVal: any) => {
        if (!oldVal && !newVal) return <p className="text-sm text-surface-500 italic">Sem alterações registradas.</p>

        const allKeys = new Set([...Object.keys(oldVal || {}), ...Object.keys(newVal || {})])
        const changes: string[] = []

        allKeys.forEach(key => {
            const v1 = oldVal?.[key]
            const v2 = newVal?.[key]
            if (JSON.stringify(v1) !== JSON.stringify(v2)) {
                changes.push(key)
            }
        })

        if (changes.length === 0) return <p className="text-sm text-surface-500 italic">Nenhuma mudança identificada.</p>

        return (
            <div className="space-y-3">
                {changes.map(key => (
                    <div key={key} className="grid grid-cols-2 gap-4 rounded-lg border border-surface-200 p-3 text-sm">
                        <div>
                            <span className="mb-1 block text-xs font-semibold uppercase text-surface-500">{key} (Antes)</span>
                            <pre className="whitespace-pre-wrap rounded bg-red-50 p-2 text-red-700 font-mono text-xs">
                                {JSON.stringify(oldVal?.[key] ?? null, null, 2)}
                            </pre>
                        </div>
                        <div>
                            <span className="mb-1 block text-xs font-semibold uppercase text-surface-500">{key} (Depois)</span>
                            <pre className="whitespace-pre-wrap rounded bg-emerald-50 p-2 text-emerald-700 font-mono text-xs">
                                {JSON.stringify(newVal?.[key] ?? null, null, 2)}
                            </pre>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Logs de Auditoria</h1>
                    <p className="mt-1 text-sm text-surface-500">Rastreabilidade e histórico de alterações</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 rounded-xl border border-surface-200 bg-white p-4 shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar em descrições e valores..."
                        className="w-full rounded-lg border border-surface-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none"
                    />
                </div>
                <select
                    value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
                    className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                >
                    <option value="">Todas as ações</option>
                    {Object.entries(actionConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <Input type="date" value={filters.date_from} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} className="w-auto" />
                <Input type="date" value={filters.date_to} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} className="w-auto" />
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-surface-200 bg-surface-50">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Data</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Usuário</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Ação</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Recurso</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Descrição</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Detalhes</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                        {isLoading ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-surface-500">Carregando...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-surface-500">Nenhum registro encontrado</td></tr>
                        ) : logs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-surface-50 transition-colors">
                                <td className="px-4 py-3 text-sm text-surface-500 whitespace-nowrap">
                                    {fmtDate(log.created_at)}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-100 text-xs font-bold text-surface-600">
                                            {log.user?.name?.charAt(0) ?? '?'}
                                        </div>
                                        <span className="text-sm font-medium text-surface-900">{log.user?.name ?? 'Sistema'}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <Badge variant={actionConfig[log.action]?.variant}>{actionConfig[log.action]?.label ?? log.action}</Badge>
                                </td>
                                <td className="px-4 py-3 text-sm text-surface-600">
                                    {log.auditable_type?.split('\\').pop()} #{log.auditable_id}
                                </td>
                                <td className="px-4 py-3 text-sm text-surface-900 max-w-xs truncate" title={log.description}>
                                    {log.description}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {/* Pagination (Simple) */}
                <div className="flex items-center justify-between border-t border-surface-200 px-4 py-3">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                    <span className="text-sm text-surface-600">Página {meta.current_page} de {meta.last_page}</span>
                    <Button variant="outline" size="sm" disabled={page >= (meta.last_page || 1)} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                </div>
            </div>

            {/* Detail Modal */}
            <Modal open={!!selectedLog} onOpenChange={() => setSelectedLog(null)} title="Detalhes da Auditoria" size="lg">
                {selectedLog && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4 rounded-lg bg-surface-50 p-4 text-sm">
                            <div><span className="text-surface-500">Usuário:</span> <span className="font-medium">{selectedLog.user?.name ?? 'Sistema'}</span></div>
                            <div><span className="text-surface-500">Data:</span> <span className="font-medium">{fmtDate(selectedLog.created_at)}</span></div>
                            <div><span className="text-surface-500">Ação:</span> <Badge className="ml-2" variant={actionConfig[selectedLog.action]?.variant}>{actionConfig[selectedLog.action]?.label}</Badge></div>
                            <div><span className="text-surface-500">IP:</span> <span className="font-medium font-mono">{selectedLog.ip_address}</span></div>
                            <div className="col-span-2"><span className="text-surface-500">Agent:</span> <span className="text-xs text-surface-700 truncate block" title={selectedLog.user_agent}>{selectedLog.user_agent}</span></div>
                        </div>

                        <div>
                            <h4 className="mb-3 text-sm font-semibold text-surface-900 flex items-center gap-2">
                                <History className="h-4 w-4" /> Alterações
                            </h4>
                            {renderDiff(selectedLog.old_values, selectedLog.new_values)}
                        </div>

                        <div className="flex justify-end pt-4 border-t border-surface-100">
                            <Button variant="outline" onClick={() => setSelectedLog(null)}>Fechar</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
