import { cn } from '@/lib/utils'
import {
    Clock, Play, Pause, CheckCircle2, Truck, DollarSign, XCircle, Shield,
} from 'lucide-react'

const steps = [
    { key: 'open', label: 'Aberta', icon: Clock, color: 'sky' },
    { key: 'awaiting_dispatch', label: 'Despacho', icon: Shield, color: 'amber' },
    { key: 'in_progress', label: 'Em Andamento', icon: Play, color: 'amber' },
    { key: 'completed', label: 'Concluída', icon: CheckCircle2, color: 'emerald' },
    { key: 'delivered', label: 'Entregue', icon: Truck, color: 'emerald' },
    { key: 'invoiced', label: 'Faturada', icon: DollarSign, color: 'brand' },
] as const

const waitSteps: Record<string, { label: string; icon: typeof Pause; color: string }> = {
    waiting_parts: { label: 'Aguard. Peças', icon: Pause, color: 'amber' },
    waiting_approval: { label: 'Aguard. Aprovação', icon: Pause, color: 'brand' },
}

const colorMap: Record<string, { bg: string; ring: string; text: string; line: string }> = {
    sky: { bg: 'bg-sky-500', ring: 'ring-sky-200', text: 'text-sky-700', line: 'bg-sky-400' },
    amber: { bg: 'bg-amber-500', ring: 'ring-amber-200', text: 'text-amber-700', line: 'bg-amber-400' },
    emerald: { bg: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-emerald-700', line: 'bg-emerald-400' },
    brand: { bg: 'bg-brand-500', ring: 'ring-brand-200', text: 'text-brand-700', line: 'bg-brand-400' },
    red: { bg: 'bg-red-500', ring: 'ring-red-200', text: 'text-red-700', line: 'bg-red-400' },
}

interface StatusTimelineProps {
    currentStatus: string
    statusHistory?: { status: string; created_at: string }[]
}

export default function StatusTimeline({ currentStatus, statusHistory = [] }: StatusTimelineProps) {
    if (currentStatus === 'cancelled') {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-red-700">Ordem de Serviço Cancelada</span>
            </div>
        )
    }

    const historySet = new Set(statusHistory.map(h => h.status))
    historySet.add(currentStatus)

    const historyMap = new Map<string, string>()
    statusHistory.forEach(h => {
        if (!historyMap.has(h.status)) historyMap.set(h.status, h.created_at)
    })

    const currentIdx = steps.findIndex(s => s.key === currentStatus)
    const isWaiting = currentStatus in waitSteps

    const activeSteps = steps.map((step, idx) => {
        const passed = historySet.has(step.key) || idx < currentIdx
        const active = step.key === currentStatus
        const ts = historyMap.get(step.key)
        return { ...step, passed, active, ts }
    })

    const waitInfo = isWaiting ? waitSteps[currentStatus] : null

    return (
        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
            <div className="flex items-center justify-between overflow-x-auto pb-1">
                {activeSteps.map((step, idx) => {
                    const c = colorMap[step.color] ?? colorMap.sky
                    const Icon = step.icon
                    const isLast = idx === activeSteps.length - 1

                    return (
                        <div key={step.key} className="flex items-center flex-1 min-w-0 last:flex-none">
                            <div className="flex flex-col items-center gap-1">
                                <div className={cn(
                                    'flex h-8 w-8 items-center justify-center rounded-full transition-all',
                                    step.active
                                        ? `${c.bg} text-white ring-4 ${c.ring} scale-110`
                                        : step.passed
                                            ? `${c.bg} text-white`
                                            : 'bg-surface-200 text-surface-400'
                                )}>
                                    <Icon className="h-4 w-4" />
                                </div>
                                <span className={cn(
                                    'text-[10px] font-medium text-center leading-tight whitespace-nowrap',
                                    step.active ? c.text : step.passed ? 'text-surface-700' : 'text-surface-400'
                                )}>
                                    {step.label}
                                </span>
                                {step.ts && (
                                    <span className="text-[9px] text-surface-400">
                                        {new Date(step.ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                            {!isLast && (
                                <div className={cn(
                                    'h-0.5 flex-1 mx-1 rounded-full transition-all min-w-[20px]',
                                    step.passed ? c.line : 'bg-surface-200'
                                )} />
                            )}
                        </div>
                    )
                })}
            </div>
            {waitInfo && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <waitInfo.icon className="h-4 w-4 text-amber-600 animate-pulse" />
                    <span className="text-xs font-medium text-amber-700">{waitInfo.label}</span>
                </div>
            )}
        </div>
    )
}
