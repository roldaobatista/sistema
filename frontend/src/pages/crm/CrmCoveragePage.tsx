import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPortfolioCoverage } from '@/lib/crm-field-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Users, UserCheck, UserX, BarChart3 } from 'lucide-react'

export function CrmCoveragePage() {
    const [period, setPeriod] = useState('30')
    const { data, isLoading } = useQuery({ queryKey: ['portfolio-coverage', period], queryFn: () => getPortfolioCoverage({ period: Number(period) }) })
    const summary = data?.summary
    const bySeller = data?.by_seller ?? {}
    const byRating = data?.by_rating ?? {}

    return (
        <div className="space-y-6">
            <PageHeader title="Cobertura de Carteira" description="Métricas de visitação e cobertura por vendedor e rating" />
            <Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">7 dias</SelectItem><SelectItem value="15">15 dias</SelectItem><SelectItem value="30">30 dias</SelectItem><SelectItem value="60">60 dias</SelectItem><SelectItem value="90">90 dias</SelectItem></SelectContent></Select>

            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : summary && (
                <>
                    <div className="grid grid-cols-4 gap-4">
                        <Card><CardContent className="py-4 text-center"><Users className="h-6 w-6 mx-auto mb-1 text-muted-foreground" /><p className="text-2xl font-bold">{summary.total_clients}</p><p className="text-xs text-muted-foreground">Total Clientes</p></CardContent></Card>
                        <Card className="bg-green-50 border-green-200"><CardContent className="py-4 text-center"><UserCheck className="h-6 w-6 mx-auto mb-1 text-green-600" /><p className="text-2xl font-bold text-green-700">{summary.visited}</p><p className="text-xs text-muted-foreground">Contatados</p></CardContent></Card>
                        <Card className="bg-red-50 border-red-200"><CardContent className="py-4 text-center"><UserX className="h-6 w-6 mx-auto mb-1 text-red-600" /><p className="text-2xl font-bold text-red-700">{summary.not_visited}</p><p className="text-xs text-muted-foreground">Não Contatados</p></CardContent></Card>
                        <Card className={summary.coverage_percent >= 80 ? 'bg-green-50 border-green-200' : summary.coverage_percent >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}><CardContent className="py-4 text-center"><BarChart3 className="h-6 w-6 mx-auto mb-1" /><p className="text-2xl font-bold">{summary.coverage_percent}%</p><p className="text-xs text-muted-foreground">Cobertura</p></CardContent></Card>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Card><CardHeader><CardTitle className="text-base">Por Vendedor</CardTitle></CardHeader><CardContent>
                            {Object.entries(bySeller).map(([name, info]: [string, unknown]) => { const s = info as { total: number; visited: number; coverage: number; not_visited: number }; return (
                                <div key={name} className="flex items-center justify-between py-2 border-b last:border-0">
                                    <span className="text-sm font-medium">{name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">{s.visited}/{s.total}</span>
                                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${s.coverage}%` }} /></div>
                                        <Badge variant={s.coverage >= 80 ? 'secondary' : s.coverage >= 50 ? 'outline' : 'destructive'} className="text-xs w-14 justify-center">{s.coverage}%</Badge>
                                    </div>
                                </div>
                            )})}
                        </CardContent></Card>

                        <Card><CardHeader><CardTitle className="text-base">Por Rating</CardTitle></CardHeader><CardContent>
                            {Object.entries(byRating).map(([rating, info]: [string, unknown]) => { const s = info as { total: number; visited: number; coverage: number }; return (
                                <div key={rating} className="flex items-center justify-between py-2 border-b last:border-0">
                                    <Badge variant="outline">{rating || 'Sem rating'}</Badge>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">{s.visited}/{s.total}</span>
                                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${s.coverage}%` }} /></div>
                                        <Badge variant={s.coverage >= 80 ? 'secondary' : 'outline'} className="text-xs w-14 justify-center">{s.coverage}%</Badge>
                                    </div>
                                </div>
                            )})}
                        </CardContent></Card>
                    </div>
                </>
            )}
        </div>
    )
}
