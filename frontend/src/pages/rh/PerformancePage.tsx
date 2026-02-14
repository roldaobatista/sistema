import { useState } from 'react'
import { usePerformance } from '@/hooks/usePerformance'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Plus, MessageSquare, BarChart2, CheckCircle, Clock } from 'lucide-react'
import { PerformanceReview, ContinuousFeedback } from '@/types/hr'
import { cn } from '@/lib/utils'

export default function PerformancePage() {
    const {
        reviews, loadingReviews, createReview, updateReview,
        feedbackList, loadingFeedback, sendFeedback
    } = usePerformance()

    const { data: usersResponse } = useQuery({
        queryKey: ['users-options'],
        queryFn: () => api.get('/users', { params: { per_page: 200, status: 'active' } }),
    })
    const users = usersResponse?.data?.data ?? usersResponse?.data ?? []

    const [activeTab, setActiveTab] = useState<'reviews' | 'feedback' | 'ninebox'>('reviews')

    // Review Modal
    const [reviewModalOpen, setReviewModalOpen] = useState(false)
    const [reviewForm, setReviewForm] = useState<Partial<PerformanceReview>>({})

    // Feedback Modal
    const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
    const [feedbackForm, setFeedbackForm] = useState<Partial<ContinuousFeedback>>({})

    const handleCreateReview = () => {
        setReviewForm({})
        setReviewModalOpen(true)
    }

    const saveReview = () => {
        createReview.mutate(reviewForm)
        setReviewModalOpen(false)
    }

    const handleSendFeedback = () => {
        setFeedbackForm({})
        setFeedbackModalOpen(true)
    }

    const submitFeedback = () => {
        // Mocking user selection for now as we don't have a user picker component ready in this context
        // In real app, would use a Combobox to select 'to_user_id'
        if (!feedbackForm.to_user_id) {
            // toast.error('Selecione um destinatário')
            // For now, let's assume valid data input or improved UI later
        }
        sendFeedback.mutate(feedbackForm)
        setFeedbackModalOpen(false)
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Gestão de Desempenho"
                subtitle="Avaliações de desempenho, feedback contínuo e PDI."
                action={
                    activeTab === 'reviews' ? (
                        <Button onClick={handleCreateReview} icon={<Plus className="h-4 w-4" />}>
                            Nova Avaliação
                        </Button>
                    ) : activeTab === 'feedback' ? (
                        <Button onClick={handleSendFeedback} icon={<MessageSquare className="h-4 w-4" />}>
                            Novo Feedback
                        </Button>
                    ) : null
                }
            />

            {/* Tabs */}
            <div className="flex border-b border-subtle">
                <button
                    onClick={() => setActiveTab('reviews')}
                    className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                        activeTab === 'reviews' ? "border-brand-500 text-brand-600" : "border-transparent text-surface-500 hover:text-surface-700")}
                >
                    <BarChart2 className="h-4 w-4" />
                    Avaliações
                </button>
                <button
                    onClick={() => setActiveTab('feedback')}
                    className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                        activeTab === 'feedback' ? "border-brand-500 text-brand-600" : "border-transparent text-surface-500 hover:text-surface-700")}
                >
                    <MessageSquare className="h-4 w-4" />
                    Feedback Contínuo
                </button>
                <button
                    onClick={() => setActiveTab('ninebox')}
                    className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                        activeTab === 'ninebox' ? "border-brand-500 text-brand-600" : "border-transparent text-surface-500 hover:text-surface-700")}
                >
                    {/* Grid Icon */}
                    <div className="grid grid-cols-2 gap-0.5 h-4 w-4">
                        <div className="bg-current rounded-[1px]"></div>
                        <div className="bg-current rounded-[1px]"></div>
                        <div className="bg-current rounded-[1px]"></div>
                        <div className="bg-current rounded-[1px]"></div>
                    </div>
                    9-Box
                </button>
            </div>

            {/* Reviews Content */}
            {activeTab === 'reviews' && (
                <div className="rounded-xl border border-default bg-surface-0 shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Título</TableHead>
                                <TableHead>Colaborador</TableHead>
                                <TableHead>Avaliador</TableHead>
                                <TableHead>Ciclo</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingReviews ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell>
                                </TableRow>
                            ) : reviews?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-surface-500">
                                        Nenhuma avaliação encontrada.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reviews?.map(review => (
                                    <TableRow key={review.id}>
                                        <TableCell className="font-medium">{review.title}</TableCell>
                                        <TableCell>{review.user?.name}</TableCell>
                                        <TableCell>{review.reviewer?.name}</TableCell>
                                        <TableCell>{review.cycle}</TableCell>
                                        <TableCell>
                                            <span className={cn(
                                                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                                                review.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                                                    review.status === 'in_progress' ? "bg-blue-100 text-blue-700" :
                                                        "bg-surface-100 text-surface-700"
                                            )}>
                                                {review.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="outline" onClick={() => navigate(`/rh/desempenho/${review.id}`)}>Detalhes</Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Feedback Content */}
            {activeTab === 'feedback' && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {loadingFeedback ? (
                        <div className="col-span-full text-center py-8 text-surface-500">Carregando feedbacks...</div>
                    ) : feedbackList?.length === 0 ? (
                        <div className="col-span-full text-center py-8 text-surface-500">Nenhum feedback registrado.</div>
                    ) : (
                        feedbackList?.map(fb => (
                            <div key={fb.id} className="rounded-xl border border-default bg-surface-0 p-5 shadow-sm space-y-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-surface-100 flex items-center justify-center text-sm font-bold text-surface-600">
                                            {fb.from_user?.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm text-surface-900">{fb.from_user?.name}</div>
                                            <div className="text-xs text-surface-500">para {fb.to_user?.name}</div>
                                        </div>
                                    </div>
                                    <span className={cn(
                                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                                        fb.type === 'praise' ? "bg-emerald-50 text-emerald-700" :
                                            fb.type === 'guidance' ? "bg-blue-50 text-blue-700" :
                                                "bg-amber-50 text-amber-700"
                                    )}>
                                        {fb.type}
                                    </span>
                                </div>
                                <p className="text-sm text-surface-700 leading-relaxed bg-surface-50 p-3 rounded-lg border border-subtle">
                                    "{fb.message}"
                                </p>
                                <div className="text-xs text-surface-400 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(fb.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* 9-Box Content */}
            {activeTab === 'ninebox' && (() => {
                const nineBoxLabels = [
                    { label: 'Enigma', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
                    { label: 'Estrela em Crescimento', bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700' },
                    { label: 'Estrela', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
                    { label: 'Risco', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
                    { label: 'Profissional Confiável', bg: 'bg-surface-50', border: 'border-surface-200', text: 'text-surface-700' },
                    { label: 'Alto Potencial', bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700' },
                    { label: 'Iceberg', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
                    { label: 'Eficiente', bg: 'bg-surface-50', border: 'border-surface-200', text: 'text-surface-700' },
                    { label: 'Comprometido', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
                ]

                const getCell = (score: number, potential: number): number => {
                    const row = potential >= 7 ? 0 : potential >= 4 ? 1 : 2
                    const col = score < 4 ? 0 : score < 7 ? 1 : 2
                    return row * 3 + col
                }

                const cellMap: Record<number, { name: string; score: number }[]> = {}
                reviews?.forEach((r: any) => {
                    const cell = getCell(r.overall_score ?? r.score ?? 5, r.potential_score ?? 5)
                    if (!cellMap[cell]) cellMap[cell] = []
                    cellMap[cell].push({ name: r.user?.name ?? r.user_name ?? `User #${r.user_id}`, score: r.overall_score ?? r.score ?? 0 })
                })

                return (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 text-xs text-surface-500">
                            <span className="font-bold text-surface-700">↑ Potencial</span>
                            <span className="ml-auto font-bold text-surface-700">Desempenho →</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {nineBoxLabels.map((cell, i) => (
                                <div key={i} className={`${cell.bg} ${cell.border} border rounded-xl p-3 min-h-[120px] flex flex-col`}>
                                    <span className={`text-xs font-semibold ${cell.text} mb-2`}>{cell.label}</span>
                                    <div className="flex flex-wrap gap-1">
                                        {(cellMap[i] ?? []).map((person, j) => (
                                            <span key={j} className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-xs font-medium text-surface-700 shadow-xs border border-surface-100 truncate max-w-[120px]" title={`${person.name} (Score: ${person.score})`}>
                                                {person.name.split(' ')[0]}
                                            </span>
                                        ))}
                                    </div>
                                    {!cellMap[i]?.length && (
                                        <span className="text-xs text-surface-400 italic mt-auto">Vazio</span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-surface-400 text-center">
                            {reviews?.length ?? 0} colaboradore(s) plotado(s) com base nas avaliações. Eixo Y: Potencial | Eixo X: Desempenho
                        </p>
                    </div>
                )
            })()}

            {/* Review Modal */}
            <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nova Avaliação</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Título</label>
                            <Input
                                value={reviewForm.title || ''}
                                onChange={e => setReviewForm({ ...reviewForm, title: e.target.value })}
                                placeholder="Ex: Avaliação Anual 2026"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Ciclo</label>
                            <Input
                                value={reviewForm.cycle || ''}
                                onChange={e => setReviewForm({ ...reviewForm, cycle: e.target.value })}
                                placeholder="Ex: 2026-Q1"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Tipo</label>
                                <select
                                    aria-label="Tipo de avaliação"
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={reviewForm.type || '180'}
                                    onChange={e => setReviewForm({ ...reviewForm, type: e.target.value as any })}
                                >
                                    <option value="180">180 (Manager)</option>
                                    <option value="360">360 (Peers)</option>
                                    <option value="self">Auto-avaliação</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Prazo</label>
                                <Input
                                    type="date"
                                    value={reviewForm.deadline || ''}
                                    onChange={e => setReviewForm({ ...reviewForm, deadline: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Avaliado *</label>
                            <select
                                aria-label="Avaliado"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={reviewForm.user_id || ''}
                                onChange={e => setReviewForm({ ...reviewForm, user_id: Number(e.target.value) })}
                            >
                                <option value="">Selecione o colaborador...</option>
                                {users.map((u: any) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Avaliador *</label>
                            <select
                                aria-label="Avaliador"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={reviewForm.reviewer_id || ''}
                                onChange={e => setReviewForm({ ...reviewForm, reviewer_id: Number(e.target.value) })}
                            >
                                <option value="">Selecione o avaliador...</option>
                                {users.map((u: any) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReviewModalOpen(false)}>Cancelar</Button>
                        <Button onClick={saveReview} loading={createReview.isPending}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Feedback Modal */}
            <Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo Feedback</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Para *</label>
                            <select
                                aria-label="Destinatário do feedback"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={feedbackForm.to_user_id || ''}
                                onChange={e => setFeedbackForm({ ...feedbackForm, to_user_id: Number(e.target.value) })}
                            >
                                <option value="">Selecione o destinatário...</option>
                                {users.map((u: any) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tipo</label>
                            <select
                                aria-label="Tipo de feedback"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={feedbackForm.type || 'praise'}
                                onChange={e => setFeedbackForm({ ...feedbackForm, type: e.target.value as any })}
                            >
                                <option value="praise">Elogio</option>
                                <option value="guidance">Orientação</option>
                                <option value="correction">Correção</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Visibilidade</label>
                            <select
                                aria-label="Visibilidade do feedback"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={feedbackForm.visibility || 'public'}
                                onChange={e => setFeedbackForm({ ...feedbackForm, visibility: e.target.value as any })}
                            >
                                <option value="public">Público (Todos veem)</option>
                                <option value="manager_only">Somente Gestor</option>
                                <option value="private">Privado (Só vocês)</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Mensagem</label>
                            <Input
                                value={feedbackForm.message || ''}
                                onChange={e => setFeedbackForm({ ...feedbackForm, message: e.target.value })}
                                placeholder="Escreva seu feedback..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFeedbackModalOpen(false)}>Cancelar</Button>
                        <Button onClick={submitFeedback} loading={sendFeedback.isPending}>Enviar Feedback</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
