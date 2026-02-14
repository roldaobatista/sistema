import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import {
    Search, Plus, Users, Clock, Calendar, Award,
    ChevronLeft, ChevronRight, MapPin, CheckCircle2, AlertTriangle, MessageSquare
} from 'lucide-react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/pageheader'
import { usePerformance } from '@/hooks/usePerformance'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'

const tabs = ['schedules', 'clock', 'trainings', 'reviews', 'feedback', 'dashboard'] as const
type Tab = typeof tabs[number]
const tabLabels: Record<Tab, string> = {
    schedules: 'Escalas', clock: 'Ponto', trainings: 'Treinamentos',
    reviews: 'Avaliações', feedback: 'Feedback', dashboard: 'Dashboard'
}

export default function HRPage() {
  const { hasPermission } = useAuthStore()

    const [tab, setTab] = useState<Tab>('schedules')
    const [page, setPage] = useState(1)
    const navigate = useNavigate()

    const { data: schedulesData, isLoading: loadingSchedules, isError: isErrorSchedules } = useQuery({
        queryKey: ['hr-schedules', page],
        queryFn: () => api.get('/hr/schedules', { params: { page, per_page: 20 } }).then(r => r.data),
        enabled: tab === 'schedules',
    })

    const { data: clockData, isLoading: loadingClock, isError: isErrorClock } = useQuery({
        queryKey: ['hr-clock-all', page],
        queryFn: () => api.get('/hr/clock/all', { params: { page, per_page: 20 } }).then(r => r.data),
        enabled: tab === 'clock',
    })

    const { data: trainingsData, isLoading: loadingTrainings, isError: isErrorTrainings } = useQuery({
        queryKey: ['hr-trainings', page],
        queryFn: () => api.get('/hr/trainings', { params: { page, per_page: 20 } }).then(r => r.data),
        enabled: tab === 'trainings',
    })

    useEffect(() => {
        if (isErrorSchedules || isErrorClock || isErrorTrainings) {
            toast.error('Erro ao carregar dados de RH. Tente novamente.')
        }
    }, [isErrorSchedules, isErrorClock, isErrorTrainings])

    const {
        reviews, loadingReviews,
        feedbackList, loadingFeedback, sendFeedback
    } = usePerformance()

    const { data: users } = useQuery({
        queryKey: ['users-list'],
        queryFn: () => api.get('/users').then(r => r.data?.data),
        enabled: tab === 'feedback'
    })

    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
    const [newFeedback, setNewFeedback] = useState({
        to_user_id: '',
        type: 'praise',
        visibility: 'public',
        message: ''
    })

    const handleSendFeedback = () => {
        if (!newFeedback.to_user_id || !newFeedback.message) return
        sendFeedback.mutate({
            to_user_id: Number(newFeedback.to_user_id),
            type: newFeedback.type as any,
            visibility: newFeedback.visibility as any,
            message: newFeedback.message
        }, {
            onSuccess: () => {
                setIsFeedbackOpen(false)
                setNewFeedback({ to_user_id: '', type: 'praise', visibility: 'public', message: '' })
                toast.success('Feedback enviado com sucesso')
            },
            onError: () => {
                toast.error('Erro ao enviar feedback')
            }
        })
    }



    const { data: dashboard } = useQuery({
        queryKey: ['hr-dashboard'],
        queryFn: () => api.get('/hr/dashboard').then(r => r.data?.data),
        enabled: tab === 'dashboard',
    })

    const schedules = schedulesData?.data ?? []
    const clockEntries = clockData?.data ?? []
    const trainings = trainingsData?.data ?? []
    // const reviews = reviewsData?.data ?? [] // Handled by hook

    return (
        <div className="space-y-5">
            <PageHeader title="Recursos Humanos" subtitle="Escalas, ponto, treinamentos e avaliações" />

            <div className="flex gap-1 rounded-xl border border-default bg-surface-50 p-1">
                {tabs.map(t => (
                    <button key={t} onClick={() => { setTab(t); setPage(1) }}
                        className={cn('flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                            tab === t ? 'bg-surface-0 text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'
                        )}>
                        {tabLabels[t]}
                    </button>
                ))}
            </div>

            {/* SCHEDULES */}
            {tab === 'schedules' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Técnico</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Data</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Tipo</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Turno</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingSchedules && <tr><td colSpan={4} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingSchedules && schedules.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-surface-400">Nenhuma escala</td></tr>}
                            {schedules.map((s: any) => (
                                <tr key={s.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-medium text-surface-900">{s.user?.name ?? 'â€”'}</td>
                                    <td className="px-4 py-3 text-surface-600">{s.schedule_date ? new Date(s.schedule_date).toLocaleDateString('pt-BR') : 'â€”'}</td>
                                    <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
                                        s.type === 'work' ? 'bg-emerald-100 text-emerald-700' : s.type === 'off' ? 'bg-surface-100 text-surface-600' : 'bg-amber-100 text-amber-700'
                                    )}>{s.type === 'work' ? 'Trabalho' : s.type === 'off' ? 'Folga' : s.type === 'vacation' ? 'Férias' : s.type}</span></td>
                                    <td className="px-4 py-3 text-surface-600">{s.shift ?? 'â€”'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* CLOCK */}
            {tab === 'clock' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Técnico</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Entrada</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Saída</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Horas</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">GPS</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingClock && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingClock && clockEntries.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Nenhum registro</td></tr>}
                            {clockEntries.map((c: any) => (
                                <tr key={c.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-medium text-surface-900">{c.user?.name ?? 'â€”'}</td>
                                    <td className="px-4 py-3 text-surface-600">{c.clock_in ? new Date(c.clock_in).toLocaleString('pt-BR') : 'â€”'}</td>
                                    <td className="px-4 py-3 text-surface-600">{c.clock_out ? new Date(c.clock_out).toLocaleString('pt-BR') : 'â€”'}</td>
                                    <td className="px-4 py-3 font-mono text-surface-700">{c.total_hours ? `${c.total_hours}h` : 'â€”'}</td>
                                    <td className="px-4 py-3">{c.clock_in_latitude ? <MapPin size={14} className="text-emerald-500" /> : <span className="text-surface-300">â€”</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TRAININGS */}
            {tab === 'trainings' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Título</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Técnico</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Tipo</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Data</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingTrainings && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingTrainings && trainings.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Nenhum treinamento</td></tr>}
                            {trainings.map((t: any) => (
                                <tr key={t.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-medium text-surface-900">{t.title}</td>
                                    <td className="px-4 py-3 text-surface-600">{t.user?.name ?? 'â€”'}</td>
                                    <td className="px-4 py-3 text-xs text-surface-500">{t.type}</td>
                                    <td className="px-4 py-3 text-surface-600">{t.completed_at ? new Date(t.completed_at).toLocaleDateString('pt-BR') : 'â€”'}</td>
                                    <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
                                        t.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                    )}>{t.status === 'completed' ? 'Concluído' : 'Pendente'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* REVIEWS */}
            {tab === 'reviews' && (
                <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Título</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Colaborador</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Avaliador</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Ciclo</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
                            <th className="px-4 py-2.5 text-right font-semibold text-surface-600">Ações</th>
                        </tr></thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingReviews && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                            {!loadingReviews && reviews?.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Nenhuma avaliação encontrada.</td></tr>}
                            {reviews?.map((review: any) => (
                                <tr key={review.id} className="transition-colors hover:bg-surface-50/50">
                                    <td className="px-4 py-3 font-medium text-surface-900">{review.title || 'Avaliação'}</td>
                                    <td className="px-4 py-3 text-surface-600">{review.user?.name}</td>
                                    <td className="px-4 py-3 text-surface-600">{review.reviewer?.name}</td>
                                    <td className="px-4 py-3 text-surface-600">{review.cycle}</td>
                                    <td className="px-4 py-3">
                                        <span className={cn(
                                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                                            review.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                                                review.status === 'in_progress' ? "bg-blue-100 text-blue-700" :
                                                    "bg-surface-100 text-surface-700"
                                        )}>
                                            {review.status === 'in_progress' ? 'Em Andamento' :
                                                review.status === 'draft' ? 'Rascunho' :
                                                    review.status === 'completed' ? 'Concluído' : review.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => navigate(`/rh/desempenho/${review.id}`)}
                                            className="text-brand-600 hover:text-brand-700 font-medium text-xs"
                                        >
                                            Detalhes
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* FEEDBACK */}
            {tab === 'feedback' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-brand-600 hover:bg-brand-700 text-white">
                                    <Plus className="mr-2 h-4 w-4" /> Novo Feedback
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Enviar Feedback</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Para quem?</Label>
                                        <Select
                                            value={newFeedback.to_user_id}
                                            onValueChange={v => setNewFeedback({ ...newFeedback, to_user_id: v })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione um colaborador" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {users?.map((u: any) => (
                                                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Tipo</Label>
                                            <Select
                                                value={newFeedback.type}
                                                onValueChange={v => setNewFeedback({ ...newFeedback, type: v })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="praise">Elogio</SelectItem>
                                                    <SelectItem value="suggestion">Sugestão</SelectItem>
                                                    <SelectItem value="concern">Preocupação</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Visibilidade</Label>
                                            <Select
                                                value={newFeedback.visibility}
                                                onValueChange={v => setNewFeedback({ ...newFeedback, visibility: v })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="public">Público</SelectItem>
                                                    <SelectItem value="private">Privado</SelectItem>
                                                    <SelectItem value="manager_only">Apenas Gestor</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Mensagem</Label>
                                        <Textarea
                                            placeholder="Descreva o feedback..."
                                            value={newFeedback.message}
                                            onChange={e => setNewFeedback({ ...newFeedback, message: e.target.value })}
                                        />
                                    </div>
                                    <Button onClick={handleSendFeedback} disabled={sendFeedback.isPending} className="w-full bg-brand-600 hover:bg-brand-700 text-white">
                                        {sendFeedback.isPending ? 'Enviando...' : 'Enviar Feedback'}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="overflow-auto rounded-xl border border-default bg-surface-0 shadow-card">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-subtle bg-surface-50">
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">De</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Para</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Tipo</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Mensagem</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-surface-600">Data</th>
                            </tr></thead>
                            <tbody className="divide-y divide-subtle">
                                {loadingFeedback && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Carregando...</td></tr>}
                                {!loadingFeedback && feedbackList?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Nenhum feedback encontrado.</td></tr>}
                                {feedbackList?.map((f: any) => (
                                    <tr key={f.id} className="transition-colors hover:bg-surface-50/50">
                                        <td className="px-4 py-3 font-medium text-surface-900">{f.from_user?.name}</td>
                                        <td className="px-4 py-3 text-surface-600">{f.to_user?.name}</td>
                                        <td className="px-4 py-3">
                                            <span className={cn(
                                                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                                                f.type === 'praise' ? "bg-emerald-100 text-emerald-700" :
                                                    f.type === 'suggestion' ? "bg-blue-100 text-blue-700" :
                                                        "bg-amber-100 text-amber-700"
                                            )}>
                                                {f.type === 'praise' ? 'Elogio' : f.type === 'suggestion' ? 'Sugestão' : 'Preocupação'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-surface-600 max-w-md truncate" title={f.content}>{f.content}</td>
                                        <td className="px-4 py-3 text-surface-500 text-xs">
                                            {new Date(f.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* DASHBOARD */}
            {tab === 'dashboard' && dashboard && (
                <div className="grid grid-cols-4 gap-4">
                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-brand-50 p-2"><Users size={20} className="text-brand-600" /></div>
                            <div><p className="text-2xl font-bold text-surface-900">{dashboard.total_technicians}</p><p className="text-xs text-surface-500">Técnicos</p></div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-card">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-emerald-100 p-2"><CheckCircle2 size={20} className="text-emerald-600" /></div>
                            <div><p className="text-2xl font-bold text-emerald-700">{dashboard.clocked_in_today}</p><p className="text-xs text-emerald-600">Online Hoje</p></div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-card">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-blue-100 p-2"><Award size={20} className="text-blue-600" /></div>
                            <div><p className="text-2xl font-bold text-blue-700">{dashboard.trainings_due}</p><p className="text-xs text-blue-600">Treinamentos Pendentes</p></div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-card">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-amber-100 p-2"><Calendar size={20} className="text-amber-600" /></div>
                            <div><p className="text-2xl font-bold text-amber-700">{dashboard.pending_reviews}</p><p className="text-xs text-amber-600">Avaliações Pendentes</p></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
