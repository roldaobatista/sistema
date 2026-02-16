import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCommercialProductivity } from '@/lib/crm-field-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/pageheader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, BarChart3, MapPin, Phone, Mail, MessageCircle, Trophy, DollarSign } from 'lucide-react'

const fmtMoney = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export function CrmProductivityPage() {
    const [period, setPeriod] = useState('30')
    const { data, isLoading } = useQuery({ queryKey: ['commercial-productivity', period], queryFn: () => getCommercialProductivity({ period: Number(period) }) })
    const sellers = data?.sellers ?? []

    return (
        <div className="space-y-6">
            <PageHeader title="Produtividade Comercial" description="Métricas de atividade e resultado do time de vendas" />
            <Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">7 dias</SelectItem><SelectItem value="15">15 dias</SelectItem><SelectItem value="30">30 dias</SelectItem><SelectItem value="60">60 dias</SelectItem><SelectItem value="90">90 dias</SelectItem></SelectContent></Select>

            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : (
                <div className="overflow-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b bg-muted/50"><th className="text-left py-3 px-2">Vendedor</th><th className="text-center px-2"><MapPin className="h-4 w-4 mx-auto" /><span className="text-xs">Visitas</span></th><th className="text-center px-2"><span className="text-xs">Vis/Dia</span></th><th className="text-center px-2"><span className="text-xs">Duração Méd.</span></th><th className="text-center px-2"><Phone className="h-4 w-4 mx-auto" /><span className="text-xs">Ligações</span></th><th className="text-center px-2"><MessageCircle className="h-4 w-4 mx-auto" /><span className="text-xs">WhatsApp</span></th><th className="text-center px-2"><Mail className="h-4 w-4 mx-auto" /><span className="text-xs">Emails</span></th><th className="text-center px-2"><Trophy className="h-4 w-4 mx-auto" /><span className="text-xs">Deals</span></th><th className="text-right px-2"><DollarSign className="h-4 w-4 ml-auto" /><span className="text-xs">Valor Deals</span></th><th className="text-center px-2"><span className="text-xs">Orçamentos</span></th></tr></thead>
                        <tbody>
                            {sellers.map((s: Record<string, unknown>) => (
                                <tr key={s.user_id as number} className="border-b hover:bg-muted/50">
                                    <td className="py-3 px-2 font-medium">{s.user_name as string}</td>
                                    <td className="text-center px-2 font-bold">{s.visits as number}</td>
                                    <td className="text-center px-2">{s.visits_per_day as number}</td>
                                    <td className="text-center px-2">{s.avg_visit_duration as number}min</td>
                                    <td className="text-center px-2">{s.calls as number}</td>
                                    <td className="text-center px-2">{s.whatsapp as number}</td>
                                    <td className="text-center px-2">{s.emails as number}</td>
                                    <td className="text-center px-2 font-bold text-green-700">{s.deals_won as number}</td>
                                    <td className="text-right px-2">{fmtMoney(s.deals_value as number)}</td>
                                    <td className="text-center px-2">{s.quotes_generated as number}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
