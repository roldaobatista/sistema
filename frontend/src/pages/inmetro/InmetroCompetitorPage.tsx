import {
    useMarketShareTimeline, useSnapshotMarketShare,
    useCompetitorMovements, usePricingEstimate,
    useWinLossAnalysis, useRecordWinLoss,
} from '@/hooks/useInmetroAdvanced'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, Camera, Activity, DollarSign, Trophy, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'

export default function InmetroCompetitorPage() {
  const { hasPermission } = useAuthStore()

    const { data: timeline, isLoading: loadingTimeline } = useMarketShareTimeline()
    const { data: movements } = useCompetitorMovements()
    const { data: pricing } = usePricingEstimate()
    const { data: winLoss } = useWinLossAnalysis()
    const snapshotMut = useSnapshotMarketShare()

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Acompanhamento de Concorrentes</h1>
                    <p className="text-muted-foreground">Market share, movimentações e análise Win/Loss</p>
                </div>
                <Button onClick={() => snapshotMut.mutate()} disabled={snapshotMut.isPending}>
                    <Camera className={`w-4 h-4 mr-2 ${snapshotMut.isPending ? 'animate-pulse' : ''}`} />
                    Capturar Snapshot
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card><CardContent className="pt-6 flex items-center gap-3">
                    <TrendingUp className="w-8 h-8 text-blue-500" />
                    <div><p className="text-2xl font-bold">{timeline?.current_share ?? 'â€”'}%</p><p className="text-sm text-muted-foreground">Market Share Atual</p></div>
                </CardContent></Card>
                <Card><CardContent className="pt-6 flex items-center gap-3">
                    <Activity className="w-8 h-8 text-amber-500" />
                    <div><p className="text-2xl font-bold">{movements?.total_new ?? 0}</p><p className="text-sm text-muted-foreground">Movimentações</p></div>
                </CardContent></Card>
                <Card><CardContent className="pt-6 flex items-center gap-3">
                    <Trophy className="w-8 h-8 text-green-500" />
                    <div><p className="text-2xl font-bold">{winLoss?.wins ?? 0}</p><p className="text-sm text-muted-foreground">Vitórias</p></div>
                </CardContent></Card>
                <Card><CardContent className="pt-6 flex items-center gap-3">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                    <div><p className="text-2xl font-bold">{winLoss?.losses ?? 0}</p><p className="text-sm text-muted-foreground">Derrotas</p></div>
                </CardContent></Card>
            </div>

            <Tabs defaultValue="timeline">
                <TabsList>
                    <TabsTrigger value="timeline">Market Share</TabsTrigger>
                    <TabsTrigger value="movements">Movimentações</TabsTrigger>
                    <TabsTrigger value="pricing">Preços Estimados</TabsTrigger>
                    <TabsTrigger value="winloss">Win/Loss</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline"><Card><CardHeader><CardTitle><TrendingUp className="w-5 h-5 inline mr-2" />Evolução Market Share</CardTitle></CardHeader><CardContent>
                    {loadingTimeline ? <Skeleton className="h-32 w-full" /> : !timeline?.snapshots?.length ? (
                        <p className="text-center py-8 text-muted-foreground">Nenhum snapshot. Clique em "Capturar Snapshot".</p>
                    ) : (
                        <Table><TableHeader><TableRow><TableHead>Período</TableHead><TableHead>Total Instrumentos</TableHead><TableHead>Nosso Share</TableHead><TableHead>Variação</TableHead></TableRow></TableHeader>
                            <TableBody>{timeline.snapshots.map((s: any, i: number) => (
                                <TableRow key={i}><TableCell>{s.period}</TableCell><TableCell>{s.data?.total_instruments ?? 0}</TableCell>
                                    <TableCell><Badge>{s.data?.our_share ?? 0}%</Badge></TableCell>
                                    <TableCell>{i > 0 ? `${s.data?.our_share - timeline.snapshots[i - 1].data?.our_share > 0 ? '+' : ''}${(s.data?.our_share - timeline.snapshots[i - 1].data?.our_share).toFixed(1)}%` : 'â€”'}</TableCell></TableRow>
                            ))}</TableBody></Table>
                    )}
                </CardContent></Card></TabsContent>

                <TabsContent value="movements"><Card><CardHeader><CardTitle><Activity className="w-5 h-5 inline mr-2" />Movimentações de Concorrentes</CardTitle></CardHeader><CardContent>
                    {!movements?.movements?.length ? <p className="text-center py-8 text-muted-foreground">Sem movimentações recentes</p> : (
                        <Table><TableHeader><TableRow><TableHead>Concorrente</TableHead><TableHead>Tipo</TableHead><TableHead>Detalhe</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
                            <TableBody>{movements.movements.map((m: any, i: number) => (
                                <TableRow key={i}><TableCell className="font-medium">{m.competitor_name}</TableCell><TableCell><Badge variant="outline">{m.type}</Badge></TableCell><TableCell className="text-sm">{m.detail}</TableCell><TableCell>{m.date}</TableCell></TableRow>
                            ))}</TableBody></Table>
                    )}
                </CardContent></Card></TabsContent>

                <TabsContent value="pricing"><Card><CardHeader><CardTitle><DollarSign className="w-5 h-5 inline mr-2" />Estimativa de Preços</CardTitle></CardHeader><CardContent>
                    {!pricing?.estimates?.length ? <p className="text-center py-8 text-muted-foreground">Sem estimativas</p> : (
                        <Table><TableHeader><TableRow><TableHead>Concorrente</TableHead><TableHead>Tipo Serviço</TableHead><TableHead>Preço Est.</TableHead><TableHead>Nosso Preço</TableHead></TableRow></TableHeader>
                            <TableBody>{pricing.estimates.map((p: any, i: number) => (
                                <TableRow key={i}><TableCell>{p.competitor_name}</TableCell><TableCell>{p.service_type}</TableCell>
                                    <TableCell>R$ {(p.estimated_price ?? 0).toLocaleString('pt-BR')}</TableCell>
                                    <TableCell>R$ {(p.our_price ?? 0).toLocaleString('pt-BR')}</TableCell></TableRow>
                            ))}</TableBody></Table>
                    )}
                </CardContent></Card></TabsContent>

                <TabsContent value="winloss"><Card><CardHeader><CardTitle><Trophy className="w-5 h-5 inline mr-2" />Win/Loss Analysis</CardTitle></CardHeader><CardContent>
                    {!winLoss?.records?.length ? <p className="text-center py-8 text-muted-foreground">Nenhum registro</p> : (
                        <>
                            <div className="flex gap-3 mb-4">
                                <Badge className="bg-green-100 text-green-800">Vitórias: {winLoss.wins}</Badge>
                                <Badge className="bg-red-100 text-red-800">Derrotas: {winLoss.losses}</Badge>
                                <Badge className="bg-blue-100 text-blue-800">Win Rate: {winLoss.win_rate}%</Badge>
                            </div>
                            <Table><TableHeader><TableRow><TableHead>Resultado</TableHead><TableHead>Motivo</TableHead><TableHead>Valor</TableHead><TableHead>Notas</TableHead></TableRow></TableHeader>
                                <TableBody>{winLoss.records.map((r: any) => (
                                    <TableRow key={r.id}><TableCell><Badge variant={r.outcome === 'win' ? 'default' : 'destructive'}>{r.outcome === 'win' ? 'Vitória' : 'Derrota'}</Badge></TableCell>
                                        <TableCell>{r.reason}</TableCell><TableCell>R$ {(r.estimated_value ?? 0).toLocaleString('pt-BR')}</TableCell><TableCell className="text-sm">{r.notes || 'â€”'}</TableCell></TableRow>
                                ))}</TableBody></Table>
                        </>
                    )}
                </CardContent></Card></TabsContent>
            </Tabs>
        </div>
    )
}