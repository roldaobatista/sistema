import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Star, MessageSquare, Clock, User, Wrench } from 'lucide-react'

interface SurveyData {
    id: number
    nps_score: number | null
    service_rating: number | null
    technician_rating: number | null
    timeliness_rating: number | null
    comment: string | null
    channel: string | null
    created_at: string
}

function StarRating({ value, label, icon: Icon }: { value: number | null; label: string; icon: React.ElementType }) {
    if (value === null) return null
    return (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="flex items-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map(i => (
                        <Star
                            key={i}
                            className={`h-4 w-4 ${i <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                        />
                    ))}
                    <span className="ml-2 text-sm font-semibold">{value}/5</span>
                </div>
            </div>
        </div>
    )
}

function NpsIndicator({ score }: { score: number }) {
    const category = score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor'
    const config = {
        promoter: { label: 'Promotor', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' },
        passive: { label: 'Neutro', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' },
        detractor: { label: 'Detrator', color: 'bg-red-100 text-red-700 dark:bg-red-900/30' },
    }
    const cfg = config[category]

    return (
        <div className="text-center rounded-xl border bg-card p-6">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">NPS Score</div>
            <div className="text-4xl font-bold">{score}</div>
            <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${cfg.color}`}>
                {cfg.label}
            </span>
        </div>
    )
}

export default function SatisfactionTab({ workOrderId }: { workOrderId: number }) {
    const { data, isLoading } = useQuery<SurveyData>({
        queryKey: ['wo-satisfaction', workOrderId],
        queryFn: () => api.get(`/work-orders/${workOrderId}/satisfaction`).then(r => r.data.data ?? r.data),
    })

    if (isLoading) {
        return <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>
    }

    if (!data) {
        return (
            <div className="rounded-xl border bg-card p-8 text-center">
                <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                    Nenhuma pesquisa de satisfação respondida para esta OS.
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                    A pesquisa é enviada automaticamente ao cliente após a conclusão.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Pesquisa de Satisfação
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
                {data.nps_score !== null && <NpsIndicator score={data.nps_score} />}

                <div className="space-y-3">
                    <StarRating value={data.service_rating} label="Serviço" icon={Star} />
                    <StarRating value={data.technician_rating} label="Técnico" icon={Wrench} />
                    <StarRating value={data.timeliness_rating} label="Pontualidade" icon={Clock} />
                </div>
            </div>

            {data.comment && (
                <div className="rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                        <MessageSquare className="h-4 w-4" /> Comentário do Cliente
                    </div>
                    <p className="text-sm leading-relaxed">{data.comment}</p>
                </div>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Canal: {data.channel ?? 'Sistema'}</span>
                <span>Respondido em: {new Date(data.created_at).toLocaleString('pt-BR')}</span>
            </div>
        </div>
    )
}
