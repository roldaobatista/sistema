import { useState , useMemo } from 'react'
import { useOrganization } from '@/hooks/useOrganization'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Network, Building2, UserCircle } from 'lucide-react'
import { Department, Position } from '@/types/hr'

export default function OrgChartPage() {

    const {
        departments, loadingDepts, createDept, updateDept, deleteDept,
        positions, loadingPositions, createPosition, updatePosition, deletePosition
    } = useOrganization()

    const [activeTab, setActiveTab] = useState<'chart' | 'departments' | 'positions'>('chart')

    // Dept Modal
    const [deptModalOpen, setDeptModalOpen] = useState(false)
    const [editingDept, setEditingDept] = useState<Department | null>(null)
    const [deptForm, setDeptForm] = useState<Partial<Department>>({})

    // Position Modal
    const [posModalOpen, setPosModalOpen] = useState(false)
    const [editingPos, setEditingPos] = useState<Position | null>(null)
    const [posForm, setPosForm] = useState<Partial<Position>>({})

    const handleEditDept = (dept: Department) => {
        setEditingDept(dept)
        setDeptForm(dept)
        setDeptModalOpen(true)
    }

    const handleCreateDept = () => {
        setEditingDept(null)
        setDeptForm({})
        setDeptModalOpen(true)
    }

    const saveDept = () => {
        if (editingDept) {
            updateDept.mutate({ id: editingDept.id, data: deptForm })
        } else {
            createDept.mutate(deptForm)
        }
        setDeptModalOpen(false)
    }

    const handleEditPos = (pos: Position) => {
        setEditingPos(pos)
        setPosForm(pos)
        setPosModalOpen(true)
    }

    const handleCreatePos = () => {
        setEditingPos(null)
        setPosForm({})
        setPosModalOpen(true)
    }

    const savePos = () => {
        if (editingPos) {
            updatePosition.mutate({ id: editingPos.id, data: posForm })
        } else {
            createPosition.mutate(posForm)
        }
        setPosModalOpen(false)
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Organograma & Cargos"
                subtitle="Gestão da estrutura organizacional, departamentos e cargos."
                action={
                    activeTab === 'departments' ? (
                        <Button onClick={handleCreateDept} icon={<Plus className="h-4 w-4" />}>
                            Novo Departamento
                        </Button>
                    ) : activeTab === 'positions' ? (
                        <Button onClick={handleCreatePos} icon={<Plus className="h-4 w-4" />}>
                            Novo Cargo
                        </Button>
                    ) : null
                }
            />

            {/* Tabs */}
            <div className="flex border-b border-subtle">
                <button
                    onClick={() => setActiveTab('chart')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'chart'
                        ? 'border-brand-500 text-brand-600'
                        : 'border-transparent text-surface-500 hover:text-surface-700'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Network className="h-4 w-4" />
                        Organograma Visual
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('departments')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'departments'
                        ? 'border-brand-500 text-brand-600'
                        : 'border-transparent text-surface-500 hover:text-surface-700'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Departamentos
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('positions')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'positions'
                        ? 'border-brand-500 text-brand-600'
                        : 'border-transparent text-surface-500 hover:text-surface-700'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <UserCircle className="h-4 w-4" />
                        Cargos
                    </div>
                </button>
            </div>

            {/* Content */}
            {activeTab === 'chart' && (() => {
                type DeptNode = Omit<Department, 'children'> & { children: DeptNode[] }

                const buildTree = (depts: Department[]): DeptNode[] => {
                    const map: Record<number, DeptNode> = {}
                    const roots: DeptNode[] = []
                    depts.forEach(d => { map[d.id] = { ...d, children: [] } })
                    depts.forEach(d => {
                        const node = map[d.id]
                        if (d.parent_id && map[d.parent_id]) {
                            map[d.parent_id].children.push(node)
                        } else {
                            roots.push(node)
                        }
                    })
                    return roots
                }

                const OrgNode = ({ node, level = 0 }: { node: DeptNode; level?: number }) => (
                    <div className={`flex flex-col items-center ${level > 0 ? 'mt-4' : ''}`}>
                        <div className="rounded-xl border border-default bg-white shadow-sm p-4 text-center min-w-[160px] hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <Building2 className="h-4 w-4 text-brand-500" />
                                <span className="font-semibold text-sm text-surface-900">{node.name}</span>
                            </div>
                            {node.manager?.name && (
                                <p className="text-xs text-surface-500">{node.manager.name}</p>
                            )}
                            {node.cost_center && (
                                <p className="text-xs text-surface-400">CC: {node.cost_center}</p>
                            )}
                        </div>
                        {node.children.length > 0 && (
                            <>
                                <div className="w-px h-4 bg-surface-300" />
                                <div className="flex gap-6 relative">
                                    {node.children.length > 1 && (
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-surface-300" style={{ width: `calc(100% - 160px)` }} />
                                    )}
                                    {node.children.map(child => (
                                        <div key={child.id} className="flex flex-col items-center">
                                            <div className="w-px h-4 bg-surface-300" />
                                            <OrgNode node={child} level={level + 1} />
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )

                const tree = buildTree(departments ?? [])

                return (
                    <div className="rounded-xl border border-default bg-surface-0 p-8 overflow-x-auto">
                        {tree.length === 0 ? (
                            <div className="text-center text-surface-500 py-12">
                                <Network className="h-12 w-12 mx-auto mb-3 text-surface-300" />
                                <p className="font-medium">Nenhum departamento cadastrado</p>
                                <p className="text-sm mt-1">Crie departamentos na aba "Departamentos" para visualizar o organograma.</p>
                            </div>
                        ) : (
                            <div className="flex justify-center gap-8">
                                {tree.map(root => (
                                    <OrgNode key={root.id} node={root} />
                                ))}
                            </div>
                        )}
                    </div>
                )
            })()}

            {activeTab === 'departments' && (
                <div className="rounded-xl border border-default bg-surface-0 shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Responsável</TableHead>
                                <TableHead>Departamento Pai</TableHead>
                                <TableHead>Centro de Custo</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingDepts ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell>
                                </TableRow>
                            ) : departments?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-surface-500">
                                        Nenhum departamento cadastrado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                departments?.map(dept => (
                                    <TableRow key={dept.id}>
                                        <TableCell className="font-medium">{dept.name}</TableCell>
                                        <TableCell>{dept.manager?.name || '-'}</TableCell>
                                        <TableCell>{dept.parent?.name || '-'}</TableCell>
                                        <TableCell>{dept.cost_center || '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button size="icon" variant="ghost" onClick={() => handleEditDept(dept)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => { if (window.confirm(`Deseja realmente excluir o departamento "${dept.name}"?`)) deleteDept.mutate(dept.id) }}>
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

            {activeTab === 'positions' && (
                <div className="rounded-xl border border-default bg-surface-0 shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Cargo</TableHead>
                                <TableHead>Nível</TableHead>
                                <TableHead>Departamento</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingPositions ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell>
                                </TableRow>
                            ) : positions?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-surface-500">
                                        Nenhum cargo cadastrado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                positions?.map(pos => (
                                    <TableRow key={pos.id}>
                                        <TableCell className="font-medium">{pos.name}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center rounded-full bg-surface-100 px-2 py-0.5 text-xs font-medium text-surface-700 capitalize">
                                                {pos.level}
                                            </span>
                                        </TableCell>
                                        <TableCell>{pos.department?.name || '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button size="icon" variant="ghost" onClick={() => handleEditPos(pos)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => { if (window.confirm(`Deseja realmente excluir o cargo "${pos.name}"?`)) deletePosition.mutate(pos.id) }}>
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

            {/* Department Modal */}
            <Dialog open={deptModalOpen} onOpenChange={setDeptModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingDept ? 'Editar Departamento' : 'Novo Departamento'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome</label>
                            <Input
                                value={deptForm.name || ''}
                                onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                                placeholder="Ex: Financeiro"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Centro de Custo</label>
                            <Input
                                value={deptForm.cost_center || ''}
                                onChange={e => setDeptForm({ ...deptForm, cost_center: e.target.value })}
                                placeholder="Ex: CC-001"
                            />
                        </div>
                        {/* Parent selection would go here */}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeptModalOpen(false)}>Cancelar</Button>
                        <Button onClick={saveDept} loading={createDept.isPending || updateDept.isPending}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Position Modal */}
            <Dialog open={posModalOpen} onOpenChange={setPosModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingPos ? 'Editar Cargo' : 'Novo Cargo'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome do Cargo</label>
                            <Input
                                value={posForm.name || ''}
                                onChange={e => setPosForm({ ...posForm, name: e.target.value })}
                                placeholder="Ex: Analista Sênior"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nível</label>
                            <select
                                aria-label="Nível do cargo"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={posForm.level || 'junior'}
                                onChange={e => setPosForm({ ...posForm, level: e.target.value as any })}
                            >
                                <option value="junior">Júnior</option>
                                <option value="pleno">Pleno</option>
                                <option value="senior">Sênior</option>
                                <option value="lead">Lead</option>
                                <option value="manager">Gerente</option>
                                <option value="specialist">Especialista</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Departamento</label>
                            <select
                                aria-label="Departamento"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={posForm.department_id || ''}
                                onChange={e => setPosForm({ ...posForm, department_id: Number(e.target.value) })}
                            >
                                <option value="">Selecione...</option>
                                {departments?.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPosModalOpen(false)}>Cancelar</Button>
                        <Button onClick={savePos} loading={createPosition.isPending || updatePosition.isPending}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
