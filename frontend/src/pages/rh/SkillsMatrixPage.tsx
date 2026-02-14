import { useState } from 'react'
import { toast } from 'sonner'
import { useSkills } from '@/hooks/useSkills'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, BookOpen, Star } from 'lucide-react'
import { Skill } from '@/types/hr'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

export default function SkillsMatrixPage() {
  const { hasPermission } = useAuthStore()

    const {
  const [searchTerm, setSearchTerm] = useState('')
        skills, loadingSkills, matrix, loadingMatrix,
        createSkill, updateSkill, deleteSkill, assessUser
    } = useSkills()

    const [activeTab, setActiveTab] = useState<'matrix' | 'skills'>('matrix')

    // Skill Modal
    const [skillModalOpen, setSkillModalOpen] = useState(false)
    const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
    const [skillForm, setSkillForm] = useState<Partial<Skill>>({})

    // Assess Modal
    const [assessModalOpen, setAssessModalOpen] = useState(false)
    const [selectedUser, setSelectedUser] = useState<any>(null)
    const [assessForm, setAssessForm] = useState<{ [skillId: number]: number }>({})

    const handleEditSkill = (skill: Skill) => {
        setEditingSkill(skill)
        setSkillForm(skill)
        setSkillModalOpen(true)
    }

    const handleCreateSkill = () => {
        setEditingSkill(null)
        setSkillForm({})
        setSkillModalOpen(true)
    }

    const saveSkill = () => {
        if (editingSkill) {
            updateSkill.mutate({ id: editingSkill.id, data: skillForm })
        } else {
            createSkill.mutate(skillForm)
        }
        setSkillModalOpen(false)
    }

    const handleAssessUser = (user: any) => {
        setSelectedUser(user)
        // Pre-fill with current levels
        const current: any = {}
        user.skills?.forEach((s: any) => current[s.skill_id] = s.current_level)
        setAssessForm(current)
        setAssessModalOpen(true)
    }

    const saveAssessment = () => {
        const payload = Object.entries(assessForm).map(([skillId, level]) => ({
            skill_id: Number(skillId),
            level
        }))
        assessUser.mutate({ userId: selectedUser.id, skills: payload })
        setAssessModalOpen(false)
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Matriz de Competências"
                subtitle="Gestão de habilidades e avaliação técnica da equipe."
                action={
                    activeTab === 'skills' ? (
                        <Button onClick={handleCreateSkill} icon={<Plus className="h-4 w-4" />}>
                            Nova Competência
                        </Button>
                    ) : null
                }
            />

            {/* Tabs */}
            <div className="flex border-b border-subtle">
                <button
                    onClick={() => setActiveTab('matrix')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'matrix'
                        ? 'border-brand-500 text-brand-600'
                        : 'border-transparent text-surface-500 hover:text-surface-700'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Star className="h-4 w-4" />
                        Matriz de Skills
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('skills')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'skills'
                        ? 'border-brand-500 text-brand-600'
                        : 'border-transparent text-surface-500 hover:text-surface-700'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Cadastro de Competências
                    </div>
                </button>
            </div>

            {/* Matrix View */}
            {activeTab === 'matrix' && (
                <div className="rounded-xl border border-default bg-surface-0 shadow-sm overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">Colaborador</TableHead>
                                {skills?.map(skill => (
                                    <TableHead key={skill.id} className="text-center min-w-[100px]">
                                        <div className="flex flex-col items-center">
                                            <span>{skill.name}</span>
                                            <span className="text-[10px] text-surface-400 font-normal">{skill.category}</span>
                                        </div>
                                    </TableHead>
                                ))}
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingMatrix ? (
                                <TableRow>
                                    <TableCell colSpan={skills ? skills.length + 2 : 2} className="text-center py-8">Carregando...</TableCell>
                                </TableRow>
                            ) : matrix?.map((user: any) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-surface-100 flex items-center justify-center text-xs font-bold text-surface-600">
                                                {user.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-surface-900">{user.name}</div>
                                                <div className="text-xs text-surface-500">{user.position?.name || 'Sem cargo'}</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    {skills?.map(skill => {
                                        const userSkill = user.skills?.find((s: any) => s.skill_id === skill.id)
                                        const level = userSkill?.current_level || 0
                                        return (
                                            <TableCell key={skill.id} className="text-center">
                                                <div className={cn(
                                                    "inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                                                    level === 0 ? "bg-surface-100 text-surface-400" :
                                                        level < 3 ? "bg-amber-100 text-amber-700" :
                                                            level < 5 ? "bg-emerald-100 text-emerald-700" :
                                                                "bg-brand-100 text-brand-700"
                                                )}>
                                                    {level || '-'}
                                                </div>
                                            </TableCell>
                                        )
                                    })}
                                    <TableCell className="text-right">
                                        <Button size="sm" variant="outline" onClick={() => handleAssessUser(user)}>
                                            Avaliar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Skills CRUD */}
            {activeTab === 'skills' && (
                <div className="rounded-xl border border-default bg-surface-0 shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingSkills ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell>
                                </TableRow>
                            ) : skills?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-surface-500">
                                        Nenhuma competência cadastrada.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                skills?.map(skill => (
                                    <TableRow key={skill.id}>
                                        <TableCell className="font-medium">{skill.name}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center rounded-full bg-surface-100 px-2 py-0.5 text-xs font-medium text-surface-700">
                                                {skill.category}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-surface-500">{skill.description || '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button size="icon" variant="ghost" onClick={() => handleEditSkill(skill)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => { if (window.confirm('Deseja realmente excluir este registro?')) deleteSkill.mutate(skill.id) }}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Skill Modal */}
            <Dialog open={skillModalOpen} onOpenChange={setSkillModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingSkill ? 'Editar Competência' : 'Nova Competência'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome</label>
                            <Input
                                value={skillForm.name || ''}
                                onChange={e => setSkillForm({ ...skillForm, name: e.target.value })}
                                placeholder="Ex: React.js"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Categoria</label>
                            <select
                                aria-label="Categoria da competência"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={skillForm.category || 'Técnica'}
                                onChange={e => setSkillForm({ ...skillForm, category: e.target.value })}
                            >
                                <option value="Técnica">Técnica</option>
                                <option value="Comportamental">Comportamental</option>
                                <option value="Idioma">Idioma</option>
                                <option value="Certificação">Certificação</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Descrição</label>
                            <Input
                                value={skillForm.description || ''}
                                onChange={e => setSkillForm({ ...skillForm, description: e.target.value })}
                                placeholder="Breve descrição..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSkillModalOpen(false)}>Cancelar</Button>
                        <Button onClick={saveSkill} loading={createSkill.isPending || updateSkill.isPending}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assess Modal */}
            <Dialog open={assessModalOpen} onOpenChange={setAssessModalOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Avaliar Competências: {selectedUser?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        {skills?.map(skill => (
                            <div key={skill.id} className="flex items-center justify-between border-b border-subtle pb-3">
                                <div>
                                    <div className="font-medium text-sm">{skill.name}</div>
                                    <div className="text-xs text-surface-500">{skill.category}</div>
                                </div>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map(level => (
                                        <button
                                            key={level}
                                            onClick={() => setAssessForm(prev => ({ ...prev, [skill.id]: level }))}
                                            className={cn(
                                                "h-8 w-8 rounded-full text-xs font-bold transition-all",
                                                (assessForm[skill.id] || 0) >= level
                                                    ? "bg-brand-500 text-white"
                                                    : "bg-surface-100 text-surface-400 hover:bg-surface-200"
                                            )}
                                        >
                                            {level}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssessModalOpen(false)}>Cancelar</Button>
                        <Button onClick={saveAssessment} loading={assessUser.isPending}>Salvar Avaliação</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}