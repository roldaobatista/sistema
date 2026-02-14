import { useState } from 'react'
import { Check, AlertTriangle, Star, MapPin, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Recommendation {
    id: number
    name: string
    score: number
    details: {
        availability?: number
        skill_match?: number
        proximity?: number
        conflict?: boolean
    }
}

interface TechnicianRecommendationSelectorProps {
    start: string
    end: string
    serviceId?: string | number
    currentTechnicianId?: string | number
    onSelect: (technicianId: number) => void
}

export function TechnicianRecommendationSelector({
    start,
    end,
    serviceId,
    currentTechnicianId,
    onSelect,
}: TechnicianRecommendationSelectorProps) {
    const [loading, setLoading] = useState(false)
    const [recommendations, setRecommendations] = useState<Recommendation[]>([])
    const [searched, setSearched] = useState(false)

    const fetchRecommendations = async () => {
        if (!start || !end) {
            toast.error('Selecione data e hora de inicio e fim primeiro.')
            return
        }

        setLoading(true)
        try {
            const params: any = { start, end }
            if (serviceId) params.service_id = serviceId

            // Optional: Pass current location if we had browser geolocation
            // navigator.geolocation.getCurrentPosition((pos) => ... )

            const response = await api.get('/technicians/recommendation', { params })
            setRecommendations(response.data.data)
            setSearched(true)
        } catch (error) {
            console.error(error)
            toast.error('Erro ao buscar recomendações')
        } finally {
            setLoading(false)
        }
    }

    if (!searched) {
        return (
            <div className="mt-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchRecommendations}
                    disabled={loading || !start || !end}
                    className="w-full border-dashed"
                >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4 text-yellow-500" />}
                    Buscar Recomendações IA
                </Button>
            </div>
        )
    }

    return (
        <div className="mt-2 space-y-2 rounded-lg border border-surface-200 bg-surface-50 p-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-surface-500">Recomendações ({recommendations.length})</span>
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setSearched(false)}
                    className="h-6 text-[10px]"
                >
                    Fechar
                </Button>
            </div>

            <div className="max-h-[200px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                {recommendations.length === 0 ? (
                    <p className="text-center text-xs text-surface-500 py-2">Nenhum técnico disponível encontrado.</p>
                ) : (
                    recommendations.map((tech) => {
                        const isSelected = Number(currentTechnicianId) === tech.id
                        const hasConflict = tech.details.conflict

                        return (
                            <button
                                key={tech.id}
                                type="button"
                                onClick={() => !hasConflict && onSelect(tech.id)}
                                disabled={hasConflict}
                                className={cn(
                                    "flex w-full flex-col gap-1 rounded-md border p-2 text-left transition-colors",
                                    isSelected ? "border-brand-500 bg-brand-50" : "border-surface-200 bg-white hover:bg-surface-50",
                                    hasConflict && "opacity-60 cursor-not-allowed bg-red-50 border-red-100"
                                )}
                            >
                                <div className="flex w-full items-center justify-between">
                                    <span className={cn("text-xs font-medium", hasConflict ? "text-red-700" : "text-surface-900")}>
                                        {tech.name}
                                    </span>
                                    {tech.score > 0 && !hasConflict && (
                                        <Badge variant="success" className="h-4 px-1 text-[9px]">{Math.round(tech.score)} pts</Badge>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-1">
                                    {hasConflict ? (
                                        <Badge variant="danger" className="h-4 px-1 text-[9px] flex items-center gap-1">
                                            <AlertTriangle className="h-2 w-2" /> Conflito
                                        </Badge>
                                    ) : (
                                        <>
                                            <Badge variant="secondary" className="h-4 px-1 text-[9px] text-surface-600">Disponível</Badge>
                                            {tech.details.skill_match && tech.details.skill_match > 0 ? (
                                                <Badge variant="brand" className="h-4 px-1 text-[9px] flex items-center gap-1">
                                                    <Star className="h-2 w-2" /> Habilidade
                                                </Badge>
                                            ) : null}
                                        </>
                                    )}
                                </div>
                            </button>
                        )
                    })
                )}
            </div>
        </div>
    )
}
