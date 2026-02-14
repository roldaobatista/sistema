import { useState } from 'react'
import { toast } from 'sonner'
import {
    useComplianceChecklists, useCreateChecklist,
    useComplianceInstrumentTypes, useDetectAnomalies,
    useCorporateGroups, useRenewalProbability,
} from '@/hooks/useInmetroAdvanced'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ShieldCheck, Plus, AlertTriangle, Building2, BarChart3, FileCheck } from 'lucide-react'

export default function InmetroCompliancePage() {
    const [typeFilter] = useState('')
    const { data: checklists, isLoading } = useComplianceChecklists(typeFilter || undefined)
    const { data: anomalies } = useDetectAnomalies()
    const { data: groups } = useCorporateGroups()
    const { data: renewal } = useRenewalProbability()
    const createMut = useCreateChecklist()
    const [form, setForm] = useState({ instrument_type: '', title: '', items: [''], regulation_reference: '' })

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Compliance & Regulatório</h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card><CardContent className="pt-6 flex items-center gap-3">
                    <FileCheck className="w-8 h-8 text-blue-500" />
                    <div><p className="text-2xl font-bold">{Array.isArray(checklists) ? checklists.length : 0}</p><p className="text-sm text-muted-foreground">Checklists</p></div>
                </CardContent></Card>
                <Card><CardContent className="pt-6 flex items-center gap-3">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                    <div><p className="text-2xl font-bold">{anomalies?.total_anomalies ?? 0}</p><p className="text-sm text-muted-foreground">Anomalias</p></div>
                </CardContent></Card>
                <Card><CardContent className="pt-6 flex items-center gap-3">
                    <Building2 className="w-8 h-8 text-purple-500" />
                    <div><p className="text-2xl font-bold">{groups?.total_groups ?? 0}</p><p className="text-sm text-muted-foreground">Grupos Corp.</p></div>
                </CardContent></Card>
                <Card><CardContent className="pt-6 flex items-center gap-3">
                    <BarChart3 className="w-8 h-8 text-green-500" />
                    <div><p className="text-2xl font-bold">{renewal?.total_customers ?? 0}</p><p className="text-sm text-muted-foreground">Monitorados</p></div>
                </CardContent></Card>
            </div>

            <Tabs defaultValue="checklists">
                <TabsList>
                    <TabsTrigger value="checklists">Checklists</TabsTrigger>
                    <TabsTrigger value="anomalies">Anomalias</TabsTrigger>
                    <TabsTrigger value="groups">Grupos</TabsTrigger>
                    <TabsTrigger value="renewal">Renovação</TabsTrigger>
                </TabsList>

                <TabsContent value="checklists">
                    <Card>
                        <CardHeader className="flex-row justify-between items-center">
                            <CardTitle><ShieldCheck className="w-5 h-5 inline mr-2" />Checklists</CardTitle>
                            <Dialog>
                                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo</Button></DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>Criar Checklist</DialogTitle></DialogHeader>
                                    <div className="space-y-3">
                                        <div><Label>Tipo</Label><Input value={form.instrument_type} onChange={e => setForm(f => ({ ...f, instrument_type: e.target.value }))} /></div>
                                        <div><Label>Título</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                                        <div><Label>Regulação</Label><Input value={form.regulation_reference} onChange={e => setForm(f => ({ ...f, regulation_reference: e.target.value }))} /></div>
                                        <div>
                                            <Label>Itens</Label>
                                            {form.items.map((it, i) => <Input key={i} className="mt-1" value={it} onChange={e => setForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? e.target.value : x) }))} />)}
                                            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setForm(f => ({ ...f, items: [...f.items, ''] }))}><Plus className="w-3 h-3 mr-1" />Item</Button>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                                        <Button onClick={() => createMut.mutate({ ...form, items: form.items.filter(Boolean) })} disabled={createMut.isPending}>Criar</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <Skeleton className="h-32 w-full" /> : !Array.isArray(checklists) || !checklists.length ? (
                                <p className="text-center py-8 text-muted-foreground">Nenhum checklist</p>
                            ) : (
                                <Table><TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Tipo</TableHead><TableHead>Regulação</TableHead><TableHead>Itens</TableHead></TableRow></TableHeader>
                                    <TableBody>{checklists.map((cl: any) => (
                                        <TableRow key={cl.id}><TableCell className="font-medium">{cl.title}</TableCell><TableCell><Badge variant="outline">{cl.instrument_type}</Badge></TableCell><TableCell>{cl.regulation_reference || 'â€”'}</TableCell><TableCell>{Array.isArray(cl.items) ? cl.items.length : 0}</TableCell></TableRow>
                                    ))}</TableBody></Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="anomalies"><Card><CardHeader><CardTitle><AlertTriangle className="w-5 h-5 inline mr-2" />Anomalias</CardTitle></CardHeader><CardContent>
                    {!anomalies?.anomalies?.length ? <p className="text-center py-8 text-muted-foreground">Nenhuma anomalia âœ“</p> : (
                        <Table><TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Severidade</TableHead><TableHead>Detalhe</TableHead></TableRow></TableHeader>
                            <TableBody>{anomalies.anomalies.map((a: any, i: number) => (
                                <TableRow key={i}><TableCell>{a.type}</TableCell><TableCell><Badge variant={a.severity === 'high' ? 'destructive' : 'secondary'}>{a.severity}</Badge></TableCell><TableCell>{a.detail}</TableCell></TableRow>
                            ))}</TableBody></Table>
                    )}
                </CardContent></Card></TabsContent>

                <TabsContent value="groups"><Card><CardHeader><CardTitle><Building2 className="w-5 h-5 inline mr-2" />Grupos Corporativos</CardTitle></CardHeader><CardContent>
                    {!groups?.groups?.length ? <p className="text-center py-8 text-muted-foreground">Nenhum grupo</p> : (
                        <Table><TableHeader><TableRow><TableHead>CNPJ Raiz</TableHead><TableHead>Filiais</TableHead><TableHead>Receita</TableHead></TableRow></TableHeader>
                            <TableBody>{groups.groups.map((g: any) => (
                                <TableRow key={g.cnpj_root}><TableCell className="font-mono">{g.cnpj_root}</TableCell><TableCell><Badge>{g.branches}</Badge></TableCell><TableCell>R$ {(g.total_revenue ?? 0).toLocaleString('pt-BR')}</TableCell></TableRow>
                            ))}</TableBody></Table>
                    )}
                </CardContent></Card></TabsContent>

                <TabsContent value="renewal"><Card><CardHeader><CardTitle><BarChart3 className="w-5 h-5 inline mr-2" />Probabilidade de Renovação</CardTitle></CardHeader><CardContent>
                    {!renewal?.predictions?.length ? <p className="text-center py-8 text-muted-foreground">Sem dados</p> : (
                        <>
                            <div className="flex gap-3 mb-4">
                                <Badge className="bg-red-100 text-red-800">Alto: {renewal.high_risk}</Badge>
                                <Badge className="bg-amber-100 text-amber-800">Médio: {renewal.medium_risk}</Badge>
                                <Badge className="bg-green-100 text-green-800">Baixo: {renewal.low_risk}</Badge>
                            </div>
                            <Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Prob.</TableHead><TableHead>Risco</TableHead><TableHead>Fatores</TableHead></TableRow></TableHeader>
                                <TableBody>{renewal.predictions.map((p: any) => (
                                    <TableRow key={p.owner_id}><TableCell className="font-medium">{p.customer_name}</TableCell><TableCell>{p.probability}%</TableCell>
                                        <TableCell><Badge variant={p.risk_level === 'high_risk' ? 'destructive' : 'secondary'}>{p.risk_level === 'high_risk' ? 'Alto' : p.risk_level === 'medium_risk' ? 'Médio' : 'Baixo'}</Badge></TableCell>
                                        <TableCell className="text-xs max-w-xs">{p.factors?.join(', ')}</TableCell></TableRow>
                                ))}</TableBody></Table>
                        </>
                    )}
                </CardContent></Card></TabsContent>
            </Tabs>
        </div>
    )
}