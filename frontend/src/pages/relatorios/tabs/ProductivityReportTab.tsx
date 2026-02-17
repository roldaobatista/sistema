import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { Users, Clock, Briefcase } from 'lucide-react'
import { ChartCard } from '@/components/charts/ChartCard'
import { StackedBar } from '@/components/charts/StackedBar'

const fmtHours = (min: number) => {
    const m = Number(min) || 0
    return `${Math.floor(m / 60)}h ${m % 60}m`
}
const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Props { data: any }

export function ProductivityReportTab({ data }: Props) {
    const techStats = (data.technicians ?? []).map((t: any) => ({
        name: t.name,
        Trabalho: Number(t.work_minutes ?? 0),
        Deslocamento: Number(t.travel_minutes ?? 0),
        Espera: Number(t.waiting_minutes ?? 0),
        os_count: Number(t.os_count ?? 0),
    }))

    const completedData = (data.completed_by_tech ?? [])
        .filter((c: any) => c.assignee)
        .map((c: any) => ({
            name: c.assignee.name,
            count: Number(c.count),
            total: Number(c.total ?? 0),
        }))
        .sort((a: any, b: any) => b.count - a.count)

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-surface-500">
                        <Users className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">Técnicos</span>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-surface-900">{techStats.length}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-surface-500">
                        <Clock className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">Total Horas Trabalho</span>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-surface-900">
                        {fmtHours(techStats.reduce((s: number, t: any) => s + t.Trabalho, 0))}
                    </p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-surface-500">
                        <Briefcase className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">Total OS Atendidas</span>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-surface-900">
                        {techStats.reduce((s: number, t: any) => s + t.os_count, 0)}
                    </p>
                </div>
            </div>

            {techStats.length > 0 && (
                <ChartCard title="Horas por Tipo (por técnico)" icon={<Clock className="h-4 w-4" />} height={Math.max(200, techStats.length * 50)}>
                    <StackedBar
                        data={techStats}
                        xKey="name"
                        dataKeys={[
                            { key: 'Trabalho', label: 'Trabalho', color: '#22c55e' },
                            { key: 'Deslocamento', label: 'Deslocamento', color: '#f59e0b' },
                            { key: 'Espera', label: 'Espera', color: '#ef4444' },
                        ]}
                        layout="vertical"
                        formatValue={(v) => fmtHours(v)}
                        height="100%"
                    />
                </ChartCard>
            )}

            {completedData.length > 0 && (
                <ChartCard title="OS Concluídas por Técnico" icon={<Users className="h-4 w-4" />} height={Math.max(200, completedData.length * 50)}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={completedData} layout="vertical" margin={{ left: 10, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200" />
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                            <Tooltip
                                formatter={(value: any, name: string) => {
                                    if (name === 'Valor') return [fmtBRL(Number(value)), name]
                                    return [value, name]
                                }}
                            />
                            <Legend />
                            <Bar dataKey="count" name="Quantidade" fill="#6366f1" radius={[0, 4, 4, 0]} animationDuration={800} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}
        </div>
    )
}
