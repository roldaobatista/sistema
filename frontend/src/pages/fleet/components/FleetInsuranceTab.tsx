import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Plus, AlertTriangle, Calendar, DollarSign, Phone, Trash2, Eye } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function FleetInsuranceTab() {
    const queryClient = useQueryClient()
    const { data: insurances, isLoading } = useQuery({
        queryKey: ['fleet-insurances'],
        queryFn: () => api.get('/fleet/insurances').then(r => r.data)
    })

    const { data: alerts } = useQuery({
        queryKey: ['fleet-insurance-alerts'],
        queryFn: () => api.get('/fleet/insurances/alerts').then(r => r.data)
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/fleet/insurances/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fleet-insurances'] })
            toast.success('Seguro removido')
        },
        onError: () => toast.error('Erro ao remover seguro')
    })

    const statusMap: Record<string, { label: string; variant: any }> = {
        active: { label: 'Ativo', variant: 'success' },
        expired: { label: 'Vencido', variant: 'danger' },
        cancelled: { label: 'Cancelado', variant: 'secondary' },
        pending: { label: 'Pendente', variant: 'warning' },
    }

    const coverageLabels: Record<string, string> = {
        comprehensive: 'Compreensivo',
        third_party: 'Terceiros',
        total_loss: 'Perda Total',
    }

    return (
        <div className="space-y-6">
            {/* Alertas de Vencimento */}
            {alerts && (alerts.expired?.length > 0 || alerts.expiring_soon?.length > 0) && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
                        <AlertTriangle size={16} /> Alertas de Seguro
                    </div>
                    {alerts.expired?.map((ins: any) => (
                        <p key={ins.id} className="text-xs text-red-700">🔴 {ins.vehicle?.plate} — Seguro VENCIDO ({ins.insurer})</p>
                    ))}
                    {alerts.expiring_soon?.map((ins: any) => (
                        <p key={ins.id} className="text-xs text-amber-700">🟡 {ins.vehicle?.plate} — Vence em {new Date(ins.end_date).toLocaleDateString()} ({ins.insurer})</p>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-surface-700">Apólices de Seguro</h3>
                <Button size="sm" icon={<Plus size={14} />}>Nova Apólice</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading && [1, 2, 3].map(i => <div key={i} className="h-52 bg-surface-100 animate-pulse rounded-2xl" />)}
                {insurances?.data?.map((ins: any) => (
                    <div key={ins.id} className="group p-5 rounded-2xl border border-default bg-surface-0 hover:shadow-card transition-all space-y-4">
                        <div className="flex items-center justify-between">
                            <Badge variant={statusMap[ins.status]?.variant}>{statusMap[ins.status]?.label}</Badge>
                            <span className="text-[10px] text-surface-400 font-mono">#{ins.id}</span>
                        </div>

                        <div>
                            <h4 className="font-bold text-surface-900">{ins.insurer}</h4>
                            <p className="text-xs text-surface-500">{ins.vehicle?.plate} — {coverageLabels[ins.coverage_type] || ins.coverage_type}</p>
                            {ins.policy_number && <p className="text-[10px] text-surface-400 mt-1">Apólice: {ins.policy_number}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-3 py-3 border-y border-subtle">
                            <div>
                                <p className="text-[10px] uppercase text-surface-400 font-bold">Prêmio</p>
                                <p className="text-xs font-semibold text-brand-600 flex items-center gap-1">
                                    <DollarSign size={12} /> R$ {Number(ins.premium_value).toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase text-surface-400 font-bold">Vigência</p>
                                <p className="text-xs font-medium text-surface-700 flex items-center gap-1">
                                    <Calendar size={12} className="text-surface-400" />
                                    {new Date(ins.start_date).toLocaleDateString()} — {new Date(ins.end_date).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        {ins.broker_name && (
                            <div className="flex items-center gap-2 text-xs text-surface-600">
                                <Phone size={12} className="text-surface-400" />
                                {ins.broker_name} {ins.broker_phone && `• ${ins.broker_phone}`}
                            </div>
                        )}

                        <div className="flex gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="xs" variant="outline" icon={<Eye size={12} />} className="flex-1">Detalhes</Button>
                            <Button size="xs" variant="ghost" className="text-red-400" onClick={() => {
                                if (confirm('Remover esta apólice?')) deleteMutation.mutate(ins.id)
                            }}>
                                <Trash2 size={12} />
                            </Button>
                        </div>
                    </div>
                ))}
                {!isLoading && (!insurances?.data || insurances.data.length === 0) && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-surface-200 rounded-3xl">
                        <Shield size={40} className="mx-auto text-surface-200 mb-4" />
                        <p className="text-surface-500 font-medium">Nenhuma apólice cadastrada</p>
                        <Button size="sm" variant="outline" className="mt-3" icon={<Plus size={14} />}>Cadastrar Seguro</Button>
                    </div>
                )}
            </div>
        </div>
    )
}
