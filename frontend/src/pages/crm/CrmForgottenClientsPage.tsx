import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getForgottenClients } from '@/lib/crm-field-api'
import type { ForgottenClientsData } from '@/lib/crm-field-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Loader2, AlertCircle, AlertTriangle, UserX, Clock, Users, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

const urgencyConfig: Record<string, { label: string; color: string; bgClass: string }> = {
    critical: { label: '+90 dias', color: 'destructive', bgClass: 'bg-red-50 border-red-200' },
    high: { label: '60-90 dias', color: 'warning', bgClass: 'bg-orange-50 border-orange-200' },
    medium: { label: '30-60 dias', color: 'secondary', bgClass: 'bg-amber-50 border-amber-200' },
    low: { label: '<30 dias', color: 'outline', bgClass: 'bg-gray-50' },
}

export function CrmForgottenClientsPage() {
    const navigate = useNavigate()
    const { data, isLoading } = useQuery<ForgottenClientsData>({ queryKey: ['forgotten-clients'], queryFn: getForgottenClients })
    const stats = data?.stats
    const customers = data?.customers ?? []

    return (
        <div className="space-y-6">
            <PageHeader title="Nenhum Cliente Esquecido" description="Clientes sem agendamento futuro - meta: zero clientes aqui" />

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : (
                <>
                    <div className="grid grid-cols-4 gap-4">
                        <Card className={stats?.total_forgotten === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                            <CardContent className="py-4 text-center"><p className="text-3xl font-bold">{stats?.total_forgotten ?? 0}</p><p className="text-sm text-muted-foreground">Total Esquecidos</p></CardContent>
                        </Card>
                        <Card className="bg-red-50 border-red-200"><CardContent className="py-4 text-center"><p className="text-3xl font-bold text-red-700">{stats?.critical ?? 0}</p><p className="text-sm text-muted-foreground">Crítico (+90d)</p></CardContent></Card>
                        <Card className="bg-orange-50 border-orange-200"><CardContent className="py-4 text-center"><p className="text-3xl font-bold text-orange-700">{stats?.high ?? 0}</p><p className="text-sm text-muted-foreground">Alto (60-90d)</p></CardContent></Card>
                        <Card className="bg-amber-50 border-amber-200"><CardContent className="py-4 text-center"><p className="text-3xl font-bold text-amber-700">{stats?.medium ?? 0}</p><p className="text-sm text-muted-foreground">Médio (30-60d)</p></CardContent></Card>
                    </div>

                    {stats?.by_seller && Object.keys(stats.by_seller).length > 0 && (
                        <Card>
                            <CardHeader><CardTitle className="text-base">Por Vendedor</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {Object.entries(stats.by_seller).map(([name, count]) => (
                                        <div key={name} className="flex items-center justify-between p-2 bg-muted/50 rounded"><span className="text-sm">{name}</span><Badge variant="secondary">{count as number}</Badge></div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="space-y-2">
                        {customers.map(c => {
                            const uc = urgencyConfig[c.urgency] ?? urgencyConfig.low
                            return (
                                <Card key={c.id} className={`${uc.bgClass} hover:shadow-sm transition-shadow`}>
                                    <CardContent className="py-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <UserX className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">{c.name}</p>
                                                    <p className="text-sm text-muted-foreground">{c.address_city ?? '-'} · {c.assigned_seller?.name ?? 'Sem vendedor'} · {c.days_since_contact < 999 ? `${c.days_since_contact} dias sem contato` : 'Nunca contatado'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {c.rating && <Badge variant="outline">{c.rating}</Badge>}
                                                <Badge variant={uc.color as 'default'}>{uc.label}</Badge>
                                                <Button size="sm" variant="outline" onClick={() => navigate(`/crm/clientes/${c.id}`)}><ArrowRight className="h-3.5 w-3.5" /></Button>
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
