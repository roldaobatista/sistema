import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import type { ServiceCallKpi } from '@/types/service-call'
import { BarChart3, Clock, AlertTriangle, Users, TrendingUp, ArrowLeft, RefreshCw } from 'lucide-react'

export default function ServiceCallDashboardPage() {
    const navigate = useNavigate()
    const [days, setDays] = useState(30)

    const { data: kpi, isLoading, refetch } = useQuery<ServiceCallKpi>({
        queryKey: ['service-calls-kpi', days],
        queryFn: async () => {
            const { data } = await api.get('/service-calls-kpi', { params: { days } })
            return data
        },
    })

    const maxVolume = Math.max(...(kpi?.volume_by_day?.map(d => d.total) ?? [1]))

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>Dashboard KPI — Chamados</h1>
                    <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>Métricas dos últimos {days} dias — {kpi?.total_period ?? 0} chamados</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {[7, 15, 30, 60, 90].map(d => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            style={{
                                padding: '6px 14px', borderRadius: 8, border: '1px solid ' + (days === d ? '#3b82f6' : '#d1d5db'),
                                background: days === d ? '#3b82f6' : 'white', color: days === d ? 'white' : '#374151',
                                fontSize: 13, cursor: 'pointer', fontWeight: days === d ? 600 : 400,
                            }}
                        >
                            {d}d
                        </button>
                    ))}
                    <button onClick={() => refetch()} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>
                        <RefreshCw size={14} />
                    </button>
                    <button
                        onClick={() => navigate('/chamados')}
                        style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                        <ArrowLeft size={14} /> Lista
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
                <KpiCard icon={<Clock size={20} color="#3b82f6" />} label="MTTR (Resolução)" value={`${kpi?.mttr_hours ?? 0}h`} color="#3b82f6" />
                <KpiCard icon={<TrendingUp size={20} color="#8b5cf6" />} label="Tempo de Triagem" value={`${kpi?.mt_triage_hours ?? 0}h`} color="#8b5cf6" />
                <KpiCard icon={<AlertTriangle size={20} color="#ef4444" />} label="Taxa SLA Estourado" value={`${kpi?.sla_breach_rate ?? 0}%`} color="#ef4444" />
                <KpiCard icon={<RefreshCw size={20} color="#f59e0b" />} label="Taxa Reagendamento" value={`${kpi?.reschedule_rate ?? 0}%`} color="#f59e0b" />
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* Volume by Day */}
                <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <BarChart3 size={16} /> Volume Diário
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160 }}>
                        {(kpi?.volume_by_day ?? []).slice(-30).map((d, i) => (
                            <div
                                key={i}
                                title={`${new Date(d.date).toLocaleDateString('pt-BR')}: ${d.total} chamados`}
                                style={{
                                    flex: 1,
                                    minWidth: 6,
                                    background: `linear-gradient(to top, #3b82f6, #60a5fa)`,
                                    borderRadius: '4px 4px 0 0',
                                    height: `${Math.max((d.total / maxVolume) * 100, 4)}%`,
                                    transition: 'height 0.3s',
                                    cursor: 'pointer',
                                }}
                            />
                        ))}
                    </div>
                    {(kpi?.volume_by_day?.length ?? 0) === 0 && (
                        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Sem dados no período</p>
                    )}
                </div>

                {/* By Technician */}
                <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Users size={16} /> Por Técnico
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(kpi?.by_technician ?? []).sort((a, b) => b.total - a.total).slice(0, 8).map((t, i) => {
                            const maxTech = Math.max(...(kpi?.by_technician?.map(x => x.total) ?? [1]))
                            return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 12, color: '#374151', minWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.technician}</span>
                                    <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 14, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', background: '#8b5cf6', borderRadius: 4, width: `${(t.total / maxTech) * 100}%`, transition: 'width 0.3s' }} />
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', minWidth: 24, textAlign: 'right' }}>{t.total}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Top Customers */}
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 16 }}>Top 10 Clientes Recorrentes</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 8 }}>
                    {(kpi?.top_customers ?? []).map((c, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 12, minWidth: 20 }}>#{i + 1}</span>
                                <span style={{ fontSize: 13, color: '#374151' }}>{c.customer ?? 'N/A'}</span>
                            </div>
                            <span style={{ fontWeight: 700, fontSize: 14, color: '#3b82f6' }}>{c.total}</span>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
    )
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    return (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icon}
            </div>
            <div>
                <p style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginTop: 2 }}>{value}</p>
            </div>
        </div>
    )
}
