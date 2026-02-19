import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getNegotiationHistory } from '@/lib/crm-field-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Input } from '@/components/ui/input'
import { Loader2, FileText, Briefcase, Wrench, DollarSign, TrendingUp } from 'lucide-react'
import api from '@/lib/api'

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')
const fmtMoney = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export function CrmNegotiationHistoryPage() {
    const [customerId, setCustomerId] = useState<number | null>(null)
    const [search, setSearch] = useState('')

    const searchQ = useQuery({
        queryKey: ['customers-neg-search', search],
        queryFn: () => api.get('/customers', { params: { search, per_page: 8, is_active: true } }).then(r => r.data?.data ?? []),
        enabled: search.length >= 2,
    })

    const { data, isLoading } = useQuery({
        queryKey: ['negotiation-history', customerId],
        queryFn: () => getNegotiationHistory(customerId!),
        enabled: !!customerId,
    })

    const typeIcons: Record<string, React.ElementType> = { quote: FileText, work_order: Wrench, deal: Briefcase }
    const typeLabels: Record<string, string> = { quote: 'Orçamento', work_order: 'Ordem de Serviço', deal: 'Negociação' }

    return (
        <div className="space-y-6">
            <PageHeader title="Histórico de Negociação" description="Timeline completa de orçamentos, OS e negociações por cliente" />
            <div className="max-w-md">
                <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
                {(searchQ.data ?? []).length > 0 && search.length >= 2 && (
                    <div className="border rounded-md max-h-40 overflow-auto mt-1">
                        {(searchQ.data ?? []).map((c: { id: number; name: string }) => (
                            <button key={c.id} className={`w-full text-left px-3 py-2 hover:bg-accent text-sm ${c.id === customerId ? 'bg-accent' : ''}`} onClick={() => { setCustomerId(c.id); setSearch(c.name) }}>{c.name}</button>
                        ))}
                    </div>
                )}
            </div>

            {customerId && isLoading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}

            {data && (
                <>
                    <div className="grid grid-cols-4 gap-4">
                        <Card><CardContent className="py-3 text-center"><p className="text-lg font-bold">{fmtMoney(data.totals.total_quoted)}</p><p className="text-xs text-muted-foreground">Total Orçado</p></CardContent></Card>
                        <Card><CardContent className="py-3 text-center"><p className="text-lg font-bold">{fmtMoney(data.totals.total_os)}</p><p className="text-xs text-muted-foreground">Total OS</p></CardContent></Card>
                        <Card><CardContent className="py-3 text-center"><p className="text-lg font-bold">{fmtMoney(data.totals.total_deals_won)}</p><p className="text-xs text-muted-foreground">Deals Ganhos</p></CardContent></Card>
                        <Card><CardContent className="py-3 text-center"><p className="text-lg font-bold">{fmtMoney(data.totals.avg_discount)}</p><p className="text-xs text-muted-foreground">Desconto Médio</p></CardContent></Card>
                    </div>

                    <div className="space-y-2">
                        {(data.timeline ?? []).map((item: Record<string, unknown>, i: number) => {
                            const Icon = typeIcons[item.type as string] ?? FileText
                            return (
                                <Card key={i} className="hover:shadow-sm transition-shadow">
                                    <CardContent className="py-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Icon className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">{typeLabels[item.type as string]} {String(item.quote_number ?? item.os_number ?? item.business_number ?? item.title ?? '')}</p>
                                                    <p className="text-sm text-muted-foreground">{fmtDate(item.created_at as string)}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{fmtMoney(Number(item.total || item.value || 0))}</span>
                                                <Badge variant="outline">{String(item.status)}</Badge>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}
