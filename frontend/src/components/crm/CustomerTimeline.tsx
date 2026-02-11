import { Phone, Mail, MessageCircle, FileText, Users, MapPin, CheckSquare, Cpu, Calendar, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CrmActivity } from '@/lib/crm-api'

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    ligacao: { icon: Phone, color: 'text-blue-600', bg: 'bg-blue-100' },
    email: { icon: Mail, color: 'text-sky-600', bg: 'bg-sky-100' },
    reuniao: { icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    visita: { icon: MapPin, color: 'text-amber-600', bg: 'bg-amber-100' },
    whatsapp: { icon: MessageCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    nota: { icon: FileText, color: 'text-surface-500', bg: 'bg-surface-100' },
    tarefa: { icon: CheckSquare, color: 'text-brand-600', bg: 'bg-brand-100' },
    system: { icon: Cpu, color: 'text-surface-400', bg: 'bg-surface-100' },
}

interface Props {
    activities: CrmActivity[]
    className?: string
}

export function CustomerTimeline({ activities, className }: Props) {
    if (activities.length === 0) {
        return (
            <div className={cn('rounded-xl border border-default bg-white p-8 text-center', className)}>
                <Clock className="mx-auto h-8 w-8 text-surface-300" />
                <p className="mt-2 text-sm text-surface-400">Nenhuma atividade registrada</p>
            </div>
        )
    }

    // Group by date
    const grouped = new Map<string, CrmActivity[]>()
    activities.forEach(act => {
        const date = new Date(act.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
        const list = grouped.get(date) ?? []
        list.push(act)
        grouped.set(date, list)
    })

    return (
        <div className={cn('space-y-6', className)}>
            {Array.from(grouped.entries()).map(([date, acts]) => (
                <div key={date}>
                    <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        {date}
                    </p>
                    <div className="relative ml-4 border-l-2 border-subtle pl-6 space-y-4">
                        {acts.map(act => {
                            const cfg = typeConfig[act.type] ?? typeConfig.nota
                            const Icon = cfg.icon
                            return (
                                <div key={act.id} className="relative group">
                                    {/* Dot */}
                                    <div className={cn(
                                        'absolute -left-[31px] top-1 flex h-6 w-6 items-center justify-center rounded-full',
                                        cfg.bg
                                    )}>
                                        <Icon className={cn('h-3 w-3', cfg.color)} />
                                    </div>

                                    <div className="rounded-lg border border-default/60 bg-white p-3 shadow-sm hover:shadow-card transition-shadow">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-surface-800">{act.title}</p>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-surface-400">
                                                    {act.user?.name && <span>{act.user.name}</span>}
                                                    <span>•</span>
                                                    <span>{new Date(act.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    {act.channel && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="capitalize">{act.channel}</span>
                                                        </>
                                                    )}
                                                    {act.outcome && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{act.outcome}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            {act.is_automated && (
                                                <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[10px] font-medium text-surface-500">
                                                    Auto
                                                </span>
                                            )}
                                        </div>
                                        {act.description && (
                                            <p className="mt-2 text-xs text-surface-600 whitespace-pre-wrap">{act.description}</p>
                                        )}
                                        {act.deal && (
                                            <p className="mt-1 text-[10px] text-brand-500">
                                                Deal: {act.deal.title}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}
