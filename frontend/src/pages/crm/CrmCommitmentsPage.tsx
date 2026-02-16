import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCommitments, createCommitment, updateCommitment } from '@/lib/crm-field-api'
import type { Commitment } from '@/lib/crm-field-api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Handshake, CheckCircle2, Clock, AlertCircle, User, Building2 } from 'lucide-react'

const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
    pending: { label: 'Pendente', variant: 'outline', icon: Clock },
    completed: { label: 'Cumprido', variant: 'secondary', icon: CheckCircle2 },
    overdue: { label: 'Atrasado', variant: 'destructive', icon: AlertCircle },
    cancelled: { label: 'Cancelado', variant: 'outline', icon: Clock },
}
const responsibleIcons: Record<string, React.ElementType> = { us: Building2, client: User, both: Handshake }
const priorityColors: Record<string, string> = { low: 'bg-gray-100', normal: 'bg-blue-100', high: 'bg-orange-100', urgent: 'bg-red-100' }

export function CrmCommitmentsPage() {
    const qc = useQueryClient()
    const [statusFilter, setStatusFilter] = useState('pending')

    const params: Record<string, unknown> = {}
    if (statusFilter !== 'all') params.status = statusFilter

    const { data: commitmentsRes, isLoading } = useQuery({ queryKey: ['commitments', params], queryFn: () => getCommitments(params) })
    const commitments: Commitment[] = commitmentsRes?.data ?? []

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => updateCommitment(id, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['commitments'] }); toast.success('Compromisso atualizado!') },
    })

    return (
        <div className="space-y-6">
            <PageHeader title="Compromissos" description="Acompanhe promessas feitas aos clientes e por eles" />
            <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="pending">Pendentes</SelectItem><SelectItem value="completed">Cumpridos</SelectItem><SelectItem value="overdue">Atrasados</SelectItem></SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : commitments.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground"><Handshake className="h-12 w-12 mx-auto mb-4 opacity-30" /><p>Nenhum compromisso encontrado</p></CardContent></Card>
            ) : (
                <div className="space-y-2">
                    {commitments.map(c => {
                        const sc = statusConfig[c.status] ?? statusConfig.pending
                        const Icon = sc.icon
                        const RIcon = responsibleIcons[c.responsible_type] ?? Handshake
                        const isOverdue = c.status === 'pending' && c.due_date && new Date(c.due_date) < new Date()
                        return (
                            <Card key={c.id} className={`hover:shadow-sm transition-shadow ${isOverdue ? 'border-red-200 bg-red-50/50' : ''}`}>
                                <CardContent className="py-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <RIcon className="h-5 w-5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium">{c.title}</p>
                                                <p className="text-sm text-muted-foreground">{c.customer?.name} · {c.due_date ? `Prazo: ${fmtDate(c.due_date)}` : 'Sem prazo'} · {c.user?.name}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">{c.responsible_type === 'us' ? 'Nós' : c.responsible_type === 'client' ? 'Cliente' : 'Ambos'}</Badge>
                                            <Badge variant={sc.variant}>{isOverdue ? 'Atrasado' : sc.label}</Badge>
                                            {c.status === 'pending' && (
                                                <Button size="sm" variant="outline" onClick={() => updateMut.mutate({ id: c.id, data: { status: 'completed' } })}>
                                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Concluir
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
