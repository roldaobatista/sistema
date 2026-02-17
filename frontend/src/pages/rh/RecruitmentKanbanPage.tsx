import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import { useRecruitment, type JobPosting, type Candidate } from '@/hooks/useRecruitment'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, GripVertical } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const STAGES = [
    { id: 'applied', label: 'Aplicado', color: 'bg-surface-100 border-surface-200' },
    { id: 'screening', label: 'Triagem', color: 'bg-blue-50 border-blue-200' },
    { id: 'interview', label: 'Entrevista', color: 'bg-indigo-50 border-indigo-200' },
    { id: 'technical_test', label: 'Teste Téc.', color: 'bg-purple-50 border-purple-200' },
    { id: 'offer', label: 'Proposta', color: 'bg-amber-50 border-amber-200' },
    { id: 'hired', label: 'Contratado', color: 'bg-emerald-50 border-emerald-200' },
    { id: 'rejected', label: 'Rejeitado', color: 'bg-red-50 border-red-200' }
]

function DroppableColumn({ stageId, children }: { stageId: string; children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id: stageId })
    return (
        <div ref={setNodeRef} className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px] transition-colors rounded-b-lg ${isOver ? 'bg-brand-50/50 ring-2 ring-brand-200 ring-inset' : ''}`}>
            {children}
        </div>
    )
}

function DraggableCard({ candidate, onSelectChange }: { candidate: Candidate; onSelectChange: (id: string, stage: string) => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: candidate.id, data: { stage: candidate.stage } })
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

    return (
        <Card ref={setNodeRef} style={style} className="cursor-grab transition-all bg-surface-0 active:cursor-grabbing">
            <CardContent className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                    <div {...attributes} {...listeners} className="mt-0.5 cursor-grab text-surface-300 hover:text-surface-500">
                        <GripVertical className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-medium">{candidate.name}</div>
                        <div className="text-xs text-surface-500 truncate">{candidate.email}</div>
                        {candidate.phone && <div className="text-xs text-surface-500">{candidate.phone}</div>}
                    </div>
                </div>
                <div className="flex justify-end pt-1">
                    <select
                        className="text-xs border rounded p-1"
                        value={candidate.stage}
                        onChange={(e) => onSelectChange(candidate.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        aria-label="Alterar fase do candidato"
                    >
                        {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                </div>
            </CardContent>
        </Card>
    )
}

export default function RecruitmentKanbanPage() {

    const { id } = useParams()
    const navigate = useNavigate()
    const { jobs } = useRecruitment()
    const [job, setJob] = useState<JobPosting | null>(null)
    const [candidates, setCandidates] = useState<Candidate[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false)
    const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null)
    const [formData, setFormData] = useState<Partial<Candidate>>({
        name: '', email: '', phone: '', stage: 'applied'
    })

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor)
    )

    const fetchJobDetails = async () => {
        setIsLoading(true)
        try {
            const response = await api.get(`/hr/job-postings/${id}`)
            setJob(response.data)
            setCandidates(response.data.candidates || [])
        } catch (error) {
            toast.error('Erro ao carregar vaga')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (id) fetchJobDetails()
    }, [id])

    const handleCandidateSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await api.post(`/hr/job-postings/${id}/candidates`, { ...formData, job_posting_id: id })
            toast.success('Candidato adicionado!')
            fetchJobDetails()
            setIsCandidateModalOpen(false)
            setFormData({ name: '', email: '', phone: '', stage: 'applied' })
        } catch (error) {
            toast.error('Erro ao adicionar candidato')
        }
    }

    const updateStage = useCallback(async (candidateId: string, newStage: string) => {
        const prevCandidates = [...candidates]
        setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, stage: newStage as any } : c))
        try {
            await api.put(`/hr/candidates/${candidateId}`, { stage: newStage })
        } catch (error) {
            setCandidates(prevCandidates)
            toast.error('Erro ao atualizar fase')
        }
    }, [candidates])

    const handleDragStart = (event: DragStartEvent) => {
        const candidate = candidates.find(c => c.id === event.active.id)
        setActiveCandidate(candidate || null)
    }

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveCandidate(null)
        const { active, over } = event
        if (!over) return

        const candidateId = active.id as string
        const overId = over.id as string

        // Check if dropped over a stage column
        const targetStage = STAGES.find(s => s.id === overId)
        if (targetStage) {
            const candidate = candidates.find(c => c.id === candidateId)
            if (candidate && candidate.stage !== targetStage.id) {
                updateStage(candidateId, targetStage.id)
            }
            return
        }

        // Check if dropped over another candidate (get their stage)
        const targetCandidate = candidates.find(c => c.id === overId)
        if (targetCandidate) {
            const sourceCandidate = candidates.find(c => c.id === candidateId)
            if (sourceCandidate && sourceCandidate.stage !== targetCandidate.stage) {
                updateStage(candidateId, targetCandidate.stage)
            }
        }
    }

    if (isLoading) return <div className="p-8 text-center">Carregando...</div>
    if (!job) return <div className="p-8 text-center">Vaga não encontrada</div>

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <div className="flex items-center justify-between p-4 border-b bg-surface-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/rh/recrutamento')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            {job.title}
                            <Badge variant="outline">{job.status}</Badge>
                        </h1>
                        <p className="text-sm text-surface-500">{job.department?.name} • {candidates.length} candidatos</p>
                    </div>
                </div>
                <Button onClick={() => setIsCandidateModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Candidato
                </Button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
                    <div className="flex h-full gap-4 min-w-[1200px]">
                        {STAGES.map(stage => {
                            const stageCandidates = candidates.filter(c => c.stage === stage.id)
                            return (
                                <div key={stage.id} className={`flex-1 min-w-[200px] flex flex-col rounded-lg border ${stage.color} bg-opacity-50`}>
                                    <div className="p-3 font-semibold text-sm flex justify-between items-center border-b border-subtle">
                                        {stage.label}
                                        <Badge variant="secondary" className="bg-surface-0/50">{stageCandidates.length}</Badge>
                                    </div>
                                    <DroppableColumn stageId={stage.id}>
                                        <SortableContext items={stageCandidates.map(c => c.id)} strategy={verticalListSortingStrategy}>
                                            {stageCandidates.map(candidate => (
                                                <DraggableCard key={candidate.id} candidate={candidate} onSelectChange={updateStage} />
                                            ))}
                                        </SortableContext>
                                        {stageCandidates.length === 0 && (
                                            <div className="text-center text-xs text-surface-400 py-4">
                                                Arraste candidatos aqui
                                            </div>
                                        )}
                                    </DroppableColumn>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <DragOverlay>
                    {activeCandidate && (
                        <Card className="shadow-xl rotate-2 bg-surface-0 w-[200px]">
                            <CardContent className="p-3 space-y-1">
                                <div className="font-medium">{activeCandidate.name}</div>
                                <div className="text-xs text-surface-500 truncate">{activeCandidate.email}</div>
                            </CardContent>
                        </Card>
                    )}
                </DragOverlay>
            </DndContext>

            <Dialog open={isCandidateModalOpen} onOpenChange={setIsCandidateModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo Candidato</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCandidateSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nome Completo</Label>
                            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Telefone</Label>
                            <Input value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsCandidateModalOpen(false)}>Cancelar</Button>
                            <Button type="submit">Salvar</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
