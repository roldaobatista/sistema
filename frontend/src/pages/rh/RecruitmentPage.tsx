import { useState } from 'react'
import { Plus, Search, Filter, MoreHorizontal, User, Mail, Phone, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useRecruitment, JobPosting } from '@/hooks/useRecruitment'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function RecruitmentPage() {
    const { jobs, isLoading, createJob, updateJob, deleteJob } = useRecruitment()
    const [searchTerm, setSearchTerm] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingJob, setEditingJob] = useState<JobPosting | null>(null)
    const [formData, setFormData] = useState<Partial<JobPosting>>({
        title: '',
        description: '',
        status: 'open',
        salary_range_min: 0,
        salary_range_max: 0
    })

    const filteredJobs = jobs?.filter(job =>
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.department?.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (editingJob) {
                await updateJob.mutateAsync({ id: editingJob.id, data: formData })
                toast.success('Vaga atualizada!')
            } else {
                await createJob.mutateAsync(formData)
                toast.success('Vaga criada!')
            }
            setIsModalOpen(false)
            setEditingJob(null)
            setFormData({ title: '', description: '', status: 'open', salary_range_min: 0, salary_range_max: 0 })
        } catch (error) {
            toast.error('Erro ao salvar vaga')
        }
    }

    const openEdit = (job: JobPosting) => {
        setEditingJob(job)
        setFormData(job)
        setIsModalOpen(true)
    }

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'open': return 'default'
            case 'closed': return 'secondary'
            case 'on_hold': return 'outline'
            default: return 'default'
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Recrutamento</h1>
                    <p className="text-muted-foreground">Gerencie vagas e candidatos (ATS Lite).</p>
                </div>
                <Button onClick={() => { setEditingJob(null); setFormData({ title: '', description: '', status: 'open' }); setIsModalOpen(true) }}>
                    <Plus className="mr-2 h-4 w-4" /> Nova Vaga
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar vagas..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <p>Carregando...</p>
                ) : filteredJobs?.length === 0 ? (
                    <p className="text-muted-foreground col-span-3 text-center py-10">Nenhuma vaga encontrada.</p>
                ) : (
                    filteredJobs?.map((job) => (
                        <Card key={job.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <Badge variant={getStatusVariant(job.status)} className="mb-2">
                                        {job.status === 'open' ? 'Aberta' : job.status === 'closed' ? 'Fechada' : 'Em Espera'}
                                    </Badge>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(job)}>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </div>
                                <CardTitle className="line-clamp-1">{job.title}</CardTitle>
                                <CardDescription>{job.department?.name || 'Sem departamento'}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                                        {job.description}
                                    </p>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <User className="h-4 w-4" />
                                            <span>{job.candidates?.length || 0} candidatos</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Calendar className="h-4 w-4" />
                                            <span>{job.opened_at ? format(new Date(job.opened_at), 'dd/MM/yyyy') : '-'}</span>
                                        </div>
                                    </div>
                                    <div className="pt-2">
                                        <Button variant="outline" className="w-full" onClick={() => window.location.href = `/rh/recrutamento/${job.id}`}>Ver Candidatos</Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingJob ? 'Editar Vaga' : 'Nova Vaga'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Título do Cargo</Label>
                                <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={formData.status} onValueChange={(val: any) => setFormData({ ...formData, status: val })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="open">Aberta</SelectItem>
                                        <SelectItem value="on_hold">Em Espera</SelectItem>
                                        <SelectItem value="closed">Fechada</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Descrição</Label>
                            <Textarea
                                className="min-h-[100px]"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Requisitos</Label>
                            <Textarea
                                className="min-h-[100px]"
                                value={formData.requirements || ''}
                                onChange={e => setFormData({ ...formData, requirements: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Salário Mínimo</Label>
                                <Input type="number" value={formData.salary_range_min} onChange={e => setFormData({ ...formData, salary_range_min: parseFloat(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Salário Máximo</Label>
                                <Input type="number" value={formData.salary_range_max} onChange={e => setFormData({ ...formData, salary_range_max: parseFloat(e.target.value) })} />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                            <Button type="submit">Salvar</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
