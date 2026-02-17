import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGamificationDashboard, recalculateGamification } from '@/lib/crm-field-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, Trophy, Medal, RefreshCw, Star, MapPin, Briefcase, Users, Target, Handshake } from 'lucide-react'

const fmtMoney = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export function CrmGamificationPage() {
    const qc = useQueryClient()
    const { data, isLoading } = useQuery({ queryKey: ['gamification'], queryFn: getGamificationDashboard })
    const recalcMut = useMutation({ mutationFn: recalculateGamification, onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['gamification'] }); toast.success(d.message) } })

    const leaderboard = data?.leaderboard ?? []
    const rankIcons = [Trophy, Medal, Star]
    const rankColors = ['text-amber-500', 'text-surface-400', 'text-amber-700']

    return (
        <div className="space-y-6">
            <PageHeader title="Gamificação Comercial" description="Ranking e conquistas do time de vendas" />
            <div className="flex justify-end"><Button onClick={() => recalcMut.mutate()} disabled={recalcMut.isPending}>{recalcMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}Recalcular</Button></div>

            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : (
                <>
                    {leaderboard.length > 0 && (
                        <div className="grid grid-cols-3 gap-4">
                            {leaderboard.slice(0, 3).map((s: Record<string, unknown>, i: number) => {
                                const Icon = rankIcons[i] ?? Star
                                return (
                                    <Card key={s.id as number} className={i === 0 ? 'border-amber-300 bg-amber-50' : ''}>
                                        <CardContent className="py-6 text-center">
                                            <Icon className={`h-8 w-8 mx-auto mb-2 ${rankColors[i] ?? 'text-muted-foreground'}`} />
                                            <p className="text-lg font-bold">{(s.user as Record<string, unknown>)?.name as string}</p>
                                            <p className="text-3xl font-bold text-primary mt-1">{s.total_points as number}</p>
                                            <p className="text-sm text-muted-foreground">pontos</p>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}

                    <Card><CardHeader><CardTitle className="text-base">Ranking Completo - {data?.period}</CardTitle></CardHeader><CardContent>
                        <table className="w-full text-sm">
                            <thead><tr className="border-b bg-muted/50"><th className="text-center py-2 px-2">#</th><th className="text-left px-2">Vendedor</th><th className="text-center px-2"><MapPin className="h-3.5 w-3.5 mx-auto" /></th><th className="text-center px-2"><Briefcase className="h-3.5 w-3.5 mx-auto" /></th><th className="text-center px-2"><Users className="h-3.5 w-3.5 mx-auto" /></th><th className="text-center px-2"><Target className="h-3.5 w-3.5 mx-auto" /></th><th className="text-center px-2"><Star className="h-3.5 w-3.5 mx-auto" /></th><th className="text-center px-2"><Handshake className="h-3.5 w-3.5 mx-auto" /></th><th className="text-right px-2">Pontos</th></tr></thead>
                            <tbody>
                                {leaderboard.map((s: Record<string, unknown>) => (
                                    <tr key={s.id as number} className="border-b hover:bg-muted/50">
                                        <td className="text-center py-2 px-2 font-bold">{s.rank_position as number}</td>
                                        <td className="px-2 font-medium">{(s.user as Record<string, unknown>)?.name as string}</td>
                                        <td className="text-center px-2">{s.visits_count as number}</td>
                                        <td className="text-center px-2">{s.deals_won as number}</td>
                                        <td className="text-center px-2">{s.activities_count as number}</td>
                                        <td className="text-center px-2">{s.coverage_percent as number}%</td>
                                        <td className="text-center px-2">{s.csat_avg as number}</td>
                                        <td className="text-center px-2">{s.commitments_on_time as number}/{s.commitments_total as number}</td>
                                        <td className="text-right px-2 font-bold text-primary">{s.total_points as number}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent></Card>
                </>
            )}
        </div>
    )
}
