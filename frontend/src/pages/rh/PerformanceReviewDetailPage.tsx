
import { useParams, useNavigate } from 'react-router-dom'
import { useReview, usePerformance } from '@/hooks/usePerformance'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Save, ArrowLeft, Send } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const COMPETENCIES = [
    { id: 'technical', label: 'Conhecimento Técnico' },
    { id: 'communication', label: 'Comunicação' },
    { id: 'teamwork', label: 'Trabalho em Equipe' },
    { id: 'initiative', label: 'Iniciativa & Proatividade' },
    { id: 'delivery', label: 'Entrega de Resultados' },
]

export default function PerformanceReviewDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { data: review, isLoading } = useReview(Number(id))
    const { updateReview } = usePerformance()

    const [ratings, setRatings] = useState<Record<string, number>>({})
    const [feedback, setFeedback] = useState('')
    const [nineBox, setNineBox] = useState({ potential: 'medium', performance: 'medium' })
    const [actionPlan, setActionPlan] = useState('')

    useEffect(() => {
        if (review) {
            setRatings(review.ratings as Record<string, number> || {})
            setFeedback(review.feedback_text || '')
            setNineBox({
                potential: review.nine_box_potential || 'medium',
                performance: review.nine_box_performance || 'medium',
            })
            setActionPlan(review.action_plan || '')
        }
    }, [review])

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-64 col-span-2" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        )
    }

    if (!review) return <div>Avaliação não encontrada</div>

    const handleSave = (status: 'in_progress' | 'completed' = 'in_progress') => {
        // Calculate overall average
        const values = Object.values(ratings)
        const overall = values.length > 0
            ? values.reduce((a, b) => a + b, 0) / values.length
            : 0

        updateReview.mutate({
            id: review.id,
            data: {
                ratings,
                feedback_text: feedback,
                nine_box_potential: nineBox.potential as any,
                nine_box_performance: nineBox.performance as any,
                action_plan: actionPlan,
                overall_rating: overall,
                status
            }
        }, {
            onSuccess: () => {
                if (status === 'completed') {
                    navigate('/rh/desempenho')
                } else {
                    toast.success('Rascunho salvo')
                }
            }
        })
    }

    const getRatingColor = (val: number) => {
        if (val >= 4.5) return 'bg-emerald-500 text-white border-emerald-600'
        if (val >= 3.5) return 'bg-blue-500 text-white border-blue-600'
        if (val >= 2.5) return 'bg-yellow-500 text-white border-yellow-600'
        return 'bg-red-500 text-white border-red-600'
    }

    return (
        <div className="space-y-6 pb-20">
            <PageHeader
                title={`Avaliação: ${review.title}`}
                subtitle={`${review.user?.name} — Ciclo: ${review.cycle}`}
                backButton={true}
                action={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => handleSave('in_progress')} disabled={review.status === 'completed'}>
                            <Save className="mr-2 h-4 w-4" />
                            Salvar Rascunho
                        </Button>
                        <Button onClick={() => handleSave('completed')} disabled={review.status === 'completed'}>
                            <Send className="mr-2 h-4 w-4" />
                            Finalizar Avaliação
                        </Button>
                    </div>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Competencies */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Competências</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {COMPETENCIES.map(comp => (
                                <div key={comp.id} className="space-y-3 p-4 rounded-lg border border-subtle bg-surface-50/50">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-surface-900">{comp.label}</label>
                                        <span className={cn(
                                            "inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold border shadow-sm transition-all",
                                            ratings[comp.id] ? getRatingColor(ratings[comp.id]) : "bg-surface-100 text-surface-400 border-surface-200"
                                        )}>
                                            {ratings[comp.id] || '-'}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map(val => (
                                            <button
                                                key={val}
                                                type="button"
                                                onClick={() => setRatings(prev => ({ ...prev, [comp.id]: val }))}
                                                disabled={review.status === 'completed'}
                                                className={cn(
                                                    "flex-1 py-2 text-xs font-medium rounded transition-all border",
                                                    ratings[comp.id] === val
                                                        ? getRatingColor(val)
                                                        : "bg-surface-0 border-surface-200 text-surface-600 hover:bg-surface-100"
                                                )}
                                            >
                                                {val}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Feedback Text */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Feedback Qualitativo</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <label className="text-sm font-medium text-surface-700">Pontos Fortes & Oportunidades de Melhoria</label>
                                <Textarea
                                    value={feedback}
                                    onChange={e => setFeedback(e.target.value)}
                                    placeholder="Descreva detalhadamente os pontos observados..."
                                    className="min-h-[200px]"
                                    disabled={review.status === 'completed'}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Action Plan */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Plano de Desenvolvimento Individual (PDI)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <label className="text-sm font-medium text-surface-700">Ações acordadas para o próximo ciclo</label>
                                <Textarea
                                    value={actionPlan}
                                    onChange={e => setActionPlan(e.target.value)}
                                    placeholder="Ex: Realizar curso de liderança, melhorar inglês..."
                                    className="min-h-[150px]"
                                    disabled={review.status === 'completed'}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Metadata Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Informações</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex justify-between py-2 border-b border-subtle">
                                <span className="text-surface-500">Status</span>
                                <span className="font-medium capitalize">{review.status}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-subtle">
                                <span className="text-surface-500">Prazo</span>
                                <span className="font-medium">
                                    {review.created_at ? new Date(review.created_at).toLocaleDateString() : '—'}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-subtle">
                                <span className="text-surface-500">Avaliador</span>
                                <span className="font-medium">{review.reviewer?.name}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 9-Box Assessment */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Matriz 9-Box</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Potencial</label>
                                <Select
                                    value={nineBox.potential}
                                    onValueChange={v => setNineBox(p => ({ ...p, potential: v }))}
                                    disabled={review.status === 'completed'}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Baixo Potencial</SelectItem>
                                        <SelectItem value="medium">Médio Potencial</SelectItem>
                                        <SelectItem value="high">Alto Potencial</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Desempenho</label>
                                <Select
                                    value={nineBox.performance}
                                    onValueChange={v => setNineBox(p => ({ ...p, performance: v }))}
                                    disabled={review.status === 'completed'}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Baixo Desempenho</SelectItem>
                                        <SelectItem value="medium">Médio Desempenho</SelectItem>
                                        <SelectItem value="high">Alto Desempenho</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="pt-4 border-t border-subtle">
                                <div className="text-xs text-center text-surface-500 mb-2">Classificação Atual</div>
                                <div className={cn(
                                    "p-3 rounded text-center text-sm font-bold border",
                                    nineBox.potential === 'high' && nineBox.performance === 'high' ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                                        nineBox.potential === 'low' && nineBox.performance === 'low' ? "bg-red-100 text-red-800 border-red-200" :
                                            "bg-blue-100 text-blue-800 border-blue-200"
                                )}>
                                    {nineBox.potential === 'high' ? 'Alto Potencial' : nineBox.potential === 'low' ? 'Baixo Potencial' : 'Potencial Médio'}
                                    <br />
                                    x
                                    <br />
                                    {nineBox.performance === 'high' ? 'Alto Desempenho' : nineBox.performance === 'low' ? 'Baixo Desempenho' : 'Desempenho Médio'}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
