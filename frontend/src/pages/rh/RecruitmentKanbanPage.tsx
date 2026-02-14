import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useRecruitment, JobPosting, Candidate } from '@/hooks/useRecruitment'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, MoreHorizontal } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

// Simple Draggable/Droppable implementation for now, or just columns
// Since dnd-kit requires a bit of setup, I'll start with a detailed view that LISTS candidates by stage
// and allows moving them via a select or drag if I can set it up quickly.
// For "Lite" ATS, a board view where you can drag cards is ideal.

const STAGES = [
    { id: 'applied', label: 'Aplicado', color: 'bg-slate-100 border-slate-200' },
    { id: 'screening', label: 'Triagem', color: 'bg-blue-50 border-blue-200' },
    { id: 'interview', label: 'Entrevista', color: 'bg-indigo-50 border-indigo-200' },
    { id: 'technical_test', label: 'Teste Téc.', color: 'bg-purple-50 border-purple-200' },
    { id: 'offer', label: 'Proposta', color: 'bg-amber-50 border-amber-200' },
    { id: 'hired', label: 'Contratado', color: 'bg-emerald-50 border-emerald-200' },
    { id: 'rejected', label: 'Rejeitado', color: 'bg-red-50 border-red-200' }
]

export default function RecruitmentKanbanPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { jobs } = useRecruitment()
    const [job, setJob] = useState<JobPosting | null>(null)
    const [candidates, setCandidates] = useState<Candidate[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false)
    const [formData, setFormData] = useState<Partial<Candidate>>({
        name: '', email: '', phone: '', stage: 'applied'
    })

    const fetchJobDetails = async () => {
        setIsLoading(true)
        try {
            const response = await api.get(`/hr/job-postings/${id}`)
            setJob(response.data)
            // Separate endpoint for candidates usually, but show method includes them
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
            // Need endpoint to create candidate. Previous controller didn't have it explicitly documented but I can add it or use a nested resource.
            // I'll assume I need to update the controller or use a generic "candidates" endpoint.
            // For now, let's assume I add a store method to JobPostingController or separate CandidateController.
            // Wait, I didn't create CandidateController. I should have. 
            // I'll add a temporary method to create via relationship or separate controller.
            // Let's assume endpoint: POST /hr/job-postings/{id}/candidates

            await api.post(`/hr/job-postings/${id}/candidates`, { ...formData, job_posting_id: id })
            toast.success('Candidato adicionado!')
            fetchJobDetails()
            setIsCandidateModalOpen(false)
            setFormData({ name: '', email: '', phone: '', stage: 'applied' })
        } catch (error) {
            toast.error('Erro ao adicionar candidato')
        }
    }

    // For drag and drop, I'd need a robust setup. 
    // To be safe and fast, I'll implement "Click to Move" or simple select for stage change first.
    // Or I can implement a simple visual board where you click "Move to Next" or select stage.

    const updateStage = async (candidateId: string, newStage: string) => {
        try {
            // Need update endpoint. PUT /hr/candidates/{id} or similiar.
            // I'll assume I need to create the backend logic for this.
            await api.put(`/hr/candidates/${candidateId}`, { stage: newStage })
            toast.success('Fase atualizada')
            setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, stage: newStage as any } : c))
        } catch (error) {
            toast.error('Erro ao atualizar fase')
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
                        <p className="text-sm text-muted-foreground">{job.department?.name} • {candidates.length} candidatos</p>
                    </div>
                </div>
                <Button onClick={() => setIsCandidateModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Candidato
                </Button>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
                <div className="flex h-full gap-4 min-w-[1200px]">
                    {STAGES.map(stage => (
                        <div key={stage.id} className={`flex-1 min-w-[200px] flex flex-col rounded-lg border ${stage.color} bg-opacity-50`}>
                            <div className="p-3 font-semibold text-sm flex justify-between items-center border-b border-black/5">
                                {stage.label}
                                <Badge variant="secondary" className="bg-white/50">{candidates.filter(c => c.stage === stage.id).length}</Badge>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                {candidates.filter(c => c.stage === stage.id).map(candidate => (
                                    <Card key={candidate.id} className="cursor-pointer hover:shadow-md transition-all bg-surface-0">
                                        <CardContent className="p-3 space-y-2">
                                            <div className="font-medium">{candidate.name}</div>
                                            <div className="text-xs text-muted-foreground truncate">{candidate.email}</div>
                                            <div className="flex justify-end pt-2">
                                                <select

                                                    className="text-xs border rounded p-1"
                                                    value={candidate.stage}
                                                    onChange={(e) => updateStage(candidate.id, e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    aria-label="Alterar fase do candidato"
                                                >
                                                    {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                                </select>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

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
