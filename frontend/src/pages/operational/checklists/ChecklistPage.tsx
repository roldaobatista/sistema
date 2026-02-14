import { useState , useMemo } from 'react'
import { toast } from 'sonner'
import { useQuery , useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ListChecks, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { ChecklistBuilder } from './components/ChecklistBuilder'
import { useAuthStore } from '@/stores/auth-store'

interface Checklist {
    id: number
    name: string
    description: string
    items: any[]
    is_active: boolean
    created_at: string
}

export function ChecklistPage() {

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/checklist/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['checklist'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }
  const { hasPermission } = useAuthStore()

    const [isSheetOpen, setIsSheetOpen] = useState(false)

    const { data: checklists, isLoading, refetch } = useQuery<Checklist[]>({
  const [searchTerm, setSearchTerm] = useState('')
        queryKey: ['checklists'],
        queryFn: async () => {
            const response = await api.get('/checklists')
            return response.data
        }
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Checklists</h1>
                    <p className="text-muted-foreground">Gerencie os modelos de checklist para inspeções e visitas.</p>
                </div>

                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                    <SheetTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Novo Checklist
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="sm:max-w-xl w-full overflow-y-auto">
                        <SheetHeader className="mb-6">
                            <SheetTitle>Configurar Checklist</SheetTitle>
                        </SheetHeader>
                        <ChecklistBuilder onSuccess={() => {
                            setIsSheetOpen(false)
                            refetch()
                        }} />
                    </SheetContent>
                </Sheet>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Itens</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {checklists?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        Nenhum checklist criado ainda.
                                    </TableCell>
                                </TableRow>
                            )}
                            {checklists?.map((checklist) => (
                                <TableRow key={checklist.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center space-x-2">
                                            <ListChecks className="h-4 w-4 text-muted-foreground" />
                                            <span>{checklist.name}</span>
                                        </div>
                                        {checklist.description && <p className="text-xs text-muted-foreground ml-6">{checklist.description}</p>}
                                    </TableCell>
                                    <TableCell>{checklist.items?.length || 0} perguntas</TableCell>
                                    <TableCell>
                                        <Badge variant={checklist.is_active ? 'default' : 'secondary'}>
                                            {checklist.is_active ? 'Ativo' : 'Inativo'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm">Editar</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    )
}
