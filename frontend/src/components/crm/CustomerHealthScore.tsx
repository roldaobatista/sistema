import { cn } from '@/lib/utils'

interface HealthScoreProps {
    score: number
    breakdown: {
        score: number
        max: number
        label: string
    }[]
    className?: string
}

export function CustomerHealthScore({ score, breakdown, className }: HealthScoreProps) {
    const getScoreColor = (s: number) => {
        if (s >= 80) return { text: 'text-emerald-600', bg: 'bg-emerald-500', ring: 'ring-emerald-200', label: 'Excelente' }
        if (s >= 60) return { text: 'text-blue-600', bg: 'bg-blue-500', ring: 'ring-blue-200', label: 'Bom' }
        if (s >= 40) return { text: 'text-amber-600', bg: 'bg-amber-500', ring: 'ring-amber-200', label: 'Atenção' }
        return { text: 'text-red-600', bg: 'bg-red-500', ring: 'ring-red-200', label: 'Crítico' }
    }

    const config = getScoreColor(score)

    return (
        <div className={cn('rounded-xl border border-default bg-surface-0 dark:bg-surface-800 p-5 shadow-card', className)}>
            {/* Score Circle */}
            <div className="flex items-center gap-5 mb-5">
                <div className={cn('relative flex h-20 w-20 items-center justify-center rounded-full ring-4', config.ring)}>
                    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="4"
                            className="text-surface-100" />
                        <circle cx="40" cy="40" r="36" fill="none" strokeWidth="4"
                            className={config.text}
                            strokeDasharray={`${(score / 100) * 226} 226`}
                            strokeLinecap="round" />
                    </svg>
                    <span className={cn('text-2xl font-bold', config.text)}>{score}</span>
                </div>
                <div>
                    <p className={cn('text-lg font-bold', config.text)}>{config.label}</p>
                    <p className="text-xs text-surface-500">Health Score do Cliente</p>
                </div>
            </div>

            {/* Breakdown */}
            <div className="space-y-2.5">
                {breakdown.map((item, i) => (
                    <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-surface-600">{item.label}</span>
                            <span className="text-xs font-bold text-surface-700">{item.score}/{item.max}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden">
                            <div
                                className={cn('h-full rounded-full transition-all duration-500',
                                    item.score === item.max ? 'bg-emerald-500' :
                                        item.score > 0 ? 'bg-amber-500' : 'bg-red-400'
                                )}
                                style={{ width: `${(item.score / item.max) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
