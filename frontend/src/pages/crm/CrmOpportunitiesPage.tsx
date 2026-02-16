import { useQuery } from '@tanstack/react-query'
import { getLatentOpportunities } from '@/lib/crm-field-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { Loader2, Lightbulb, Wrench, UserX, FileText, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    calibration_expiring: { label: 'Calibração Vencendo', icon: Wrench, color: 'text-orange-600' },
    inactive_customer: { label: 'Cliente Inativo', icon: UserX, color: 'text-red-600' },
    contract_renewal: { label: 'Renovação de Contrato', icon: FileText, color: 'text-blue-600' },
}

export function CrmOpportunitiesPage() {
    const navigate = useNavigate()
    const { data, isLoading } = useQuery({ queryKey: ['latent-opportunities'], queryFn: getLatentOpportunities })
    const opportunities = data?.opportunities ?? []
    const summary = data?.summary ?? {}

    return (
        <div className="space-y-6">
            <PageHeader title="Oportunidades Latentes" description="Oportunidades identificadas automaticamente que ninguém está perseguindo" />

            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : (
                <>
                    <div className="grid grid-cols-4 gap-4">
                        <Card><CardContent className="py-4 text-center"><p className="text-2xl font-bold">{summary.total ?? 0}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
                        <Card className="bg-orange-50"><CardContent className="py-4 text-center"><Wrench className="h-5 w-5 mx-auto mb-1 text-orange-600" /><p className="text-2xl font-bold">{summary.calibration_expiring ?? 0}</p><p className="text-xs text-muted-foreground">Calibrações</p></CardContent></Card>
                        <Card className="bg-red-50"><CardContent className="py-4 text-center"><UserX className="h-5 w-5 mx-auto mb-1 text-red-600" /><p className="text-2xl font-bold">{summary.inactive_customers ?? 0}</p><p className="text-xs text-muted-foreground">Clientes Inativos</p></CardContent></Card>
                        <Card className="bg-blue-50"><CardContent className="py-4 text-center"><FileText className="h-5 w-5 mx-auto mb-1 text-blue-600" /><p className="text-2xl font-bold">{summary.contract_renewals ?? 0}</p><p className="text-xs text-muted-foreground">Contratos</p></CardContent></Card>
                    </div>
                    <div className="space-y-2">
                        {opportunities.map((opp: Record<string, unknown>, i: number) => {
                            const tc = typeConfig[opp.type as string] ?? typeConfig.calibration_expiring
                            const Icon = tc.icon
                            const customer = opp.customer as Record<string, unknown> | null
                            return (
                                <Card key={i} className="hover:shadow-sm transition-shadow">
                                    <CardContent className="py-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Icon className={`h-5 w-5 ${tc.color}`} />
                                                <div>
                                                    <p className="font-medium">{customer?.name as string}</p>
                                                    <p className="text-sm text-muted-foreground">{opp.detail as string}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline">{tc.label}</Badge>
                                                <Badge variant={opp.priority === 'high' ? 'destructive' : 'secondary'}>{opp.priority === 'high' ? 'Alta' : 'Média'}</Badge>
                                                {customer?.id && <Button size="sm" variant="outline" onClick={() => navigate(`/crm/clientes/${customer.id}`)}><ArrowRight className="h-3.5 w-3.5" /></Button>}
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
