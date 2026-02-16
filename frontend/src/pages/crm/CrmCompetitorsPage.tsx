import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Swords, Plus, Trophy, TrendingUp, TrendingDown, Minus, Target } from 'lucide-react'
import { crmFeaturesApi } from '@/lib/crm-features-api'
import type { CrmDealCompetitor } from '@/lib/crm-features-api'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { TableSkeleton } from '@/components/ui/tableskeleton'
import { EmptyState } from '@/components/ui/emptystate'
import { toast } from 'sonner'

const fmtBRL = (v: number | string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtPct = (v: number) => `${v.toFixed(1)}%`

export function CrmCompetitorsPage() {
    const qc = useQueryClient()
    const [showAdd, setShowAdd] = useState(false)
    const [months, setMonths] = useState(12)

    const { data: res, isLoading } = useQuery({
        queryKey: ['crm-competitors', months],
        queryFn: () => crmFeaturesApi.getCompetitiveMatrix({ months }),
    })
    const competitors: CrmDealCompetitor[] = res?.data ?? []

    const addMut = useMutation({
        mutationFn: (data: { deal_id: number; competitor_name: string; competitor_price?: number; strengths?: string; weaknesses?: string }) =>
            crmFeaturesApi.addDealCompetitor(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['crm-competitors'] })
            setShowAdd(false)
            toast.success('Concorrente adicionado ao negócio')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao adicionar concorrente'),
    })

    const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        addMut.mutate({
            deal_id: Number(fd.get('deal_id')),
            competitor_name: fd.get('competitor_name') as string,
            competitor_price: Number(fd.get('competitor_price')) || undefined,
            strengths: (fd.get('strengths') as string) || undefined,
            weaknesses: (fd.get('weaknesses') as string) || undefined,
        })
    }

    const totalEncounters = competitors.reduce((sum, c) => sum + c.total_encounters, 0)
    const totalWins = competitors.reduce((sum, c) => sum + c.wins, 0)
    const totalLosses = competitors.reduce((sum, c) => sum + c.losses, 0)
    const overallWinRate = totalEncounters > 0 ? (totalWins / totalEncounters) * 100 : 0

    return (
        <div className='space-y-6'>
            <PageHeader
                title='Matriz Competitiva'
                subtitle='Analise o desempenho contra concorrentes em negócios disputados.'
                count={competitors.length}
                icon={Swords}
            >
                <Button
                    size='sm'
                    onClick={() => setShowAdd(true)}
                    icon={<Plus className='h-4 w-4' />}
                >
                    Registrar Concorrente
                </Button>
            </PageHeader>

            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
                <div className='rounded-xl border border-default bg-surface-0 p-5 shadow-card'>
                    <div className='flex items-center gap-3'>
                        <div className='h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600'>
                            <Swords className='h-5 w-5' />
                        </div>
                        <div>
                            <p className='text-sm font-medium text-surface-500'>Disputas</p>
                            <h3 className='text-2xl font-bold text-surface-900'>{totalEncounters}</h3>
                        </div>
                    </div>
                </div>
                <div className='rounded-xl border border-default bg-surface-0 p-5 shadow-card'>
                    <div className='flex items-center gap-3'>
                        <div className='h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600'>
                            <Trophy className='h-5 w-5' />
                        </div>
                        <div>
                            <p className='text-sm font-medium text-surface-500'>Vitórias</p>
                            <h3 className='text-2xl font-bold text-emerald-600'>{totalWins}</h3>
                        </div>
                    </div>
                </div>
                <div className='rounded-xl border border-default bg-surface-0 p-5 shadow-card'>
                    <div className='flex items-center gap-3'>
                        <div className='h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600'>
                            <TrendingDown className='h-5 w-5' />
                        </div>
                        <div>
                            <p className='text-sm font-medium text-surface-500'>Derrotas</p>
                            <h3 className='text-2xl font-bold text-red-600'>{totalLosses}</h3>
                        </div>
                    </div>
                </div>
                <div className='rounded-xl border border-default bg-surface-0 p-5 shadow-card'>
                    <div className='flex items-center gap-3'>
                        <div className='h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600'>
                            <Target className='h-5 w-5' />
                        </div>
                        <div>
                            <p className='text-sm font-medium text-surface-500'>Win Rate Geral</p>
                            <h3 className='text-2xl font-bold text-surface-900'>{fmtPct(overallWinRate)}</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className='bg-surface-0 border border-default rounded-xl overflow-hidden shadow-card'>
                <div className='p-4 border-b border-default flex flex-wrap items-center justify-between gap-3'>
                    <h2 className='font-semibold text-surface-900'>Comparativo de Concorrentes</h2>
                    <div className='flex items-center gap-2'>
                        <label className='text-xs font-medium text-surface-500'>Período:</label>
                        <select
                            value={months}
                            onChange={(e) => setMonths(Number(e.target.value))}
                            className='h-8 rounded-lg border-default text-xs px-2 w-32'
                        >
                            <option value={3}>Últimos 3 meses</option>
                            <option value={6}>Últimos 6 meses</option>
                            <option value={12}>Últimos 12 meses</option>
                            <option value={24}>Últimos 24 meses</option>
                        </select>
                    </div>
                </div>

                {isLoading ? (
                    <TableSkeleton rows={5} cols={7} />
                ) : competitors.length === 0 ? (
                    <EmptyState
                        icon={Swords}
                        title='Nenhum concorrente registrado'
                        message='Adicione concorrentes aos negócios para gerar a matriz competitiva.'
                        action={{ label: 'Registrar Concorrente', onClick: () => setShowAdd(true), icon: <Plus className='h-4 w-4' /> }}
                    />
                ) : (
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm'>
                            <thead className='bg-surface-50 text-surface-500 border-b border-default'>
                                <tr>
                                    <th className='px-4 py-3 text-left font-medium'>Concorrente</th>
                                    <th className='px-4 py-3 text-center font-medium'>Disputas</th>
                                    <th className='px-4 py-3 text-center font-medium'>Vitórias</th>
                                    <th className='px-4 py-3 text-center font-medium'>Derrotas</th>
                                    <th className='px-4 py-3 text-center font-medium'>Win Rate</th>
                                    <th className='px-4 py-3 text-right font-medium'>Preço Médio Deles</th>
                                    <th className='px-4 py-3 text-right font-medium'>Nosso Preço Médio</th>
                                    <th className='px-4 py-3 text-center font-medium'>Diferença</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-subtle'>
                                {competitors.map((c) => {
                                    const winRate = c.win_rate
                                    const priceDiff = c.price_diff
                                    return (
                                        <tr key={c.competitor_name} className='hover:bg-surface-50 transition-colors'>
                                            <td className='px-4 py-3 font-medium text-surface-900'>
                                                {c.competitor_name}
                                            </td>
                                            <td className='px-4 py-3 text-center tabular-nums text-surface-700'>
                                                {c.total_encounters}
                                            </td>
                                            <td className='px-4 py-3 text-center tabular-nums text-emerald-600 font-semibold'>
                                                {c.wins}
                                            </td>
                                            <td className='px-4 py-3 text-center tabular-nums text-red-600 font-semibold'>
                                                {c.losses}
                                            </td>
                                            <td className='px-4 py-3 text-center'>
                                                <WinRateBadge rate={winRate} />
                                            </td>
                                            <td className='px-4 py-3 text-right tabular-nums text-surface-600'>
                                                {c.avg_price ? fmtBRL(c.avg_price) : '—'}
                                            </td>
                                            <td className='px-4 py-3 text-right tabular-nums text-surface-700 font-medium'>
                                                {c.our_avg_price ? fmtBRL(c.our_avg_price) : '—'}
                                            </td>
                                            <td className='px-4 py-3 text-center'>
                                                <PriceDiffBadge diff={priceDiff} />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {competitors.length > 0 && (
                <div className='rounded-xl border border-default bg-surface-0 p-6 shadow-card'>
                    <h3 className='font-semibold text-surface-900 mb-4'>Win Rate por Concorrente</h3>
                    <div className='space-y-3'>
                        {competitors
                            .sort((a, b) => b.win_rate - a.win_rate)
                            .map((c) => (
                                <div key={c.competitor_name}>
                                    <div className='flex justify-between text-xs mb-1'>
                                        <span className='font-medium text-surface-700'>{c.competitor_name}</span>
                                        <span className='text-surface-500'>
                                            {fmtPct(c.win_rate)} ({c.wins}W / {c.losses}L)
                                        </span>
                                    </div>
                                    <div className='h-3 rounded-full bg-surface-100 overflow-hidden flex'>
                                        <div
                                            className='h-full bg-emerald-500 transition-all'
                                            style={{ width: `${c.win_rate}%` }}
                                        />
                                        <div
                                            className='h-full bg-red-400 transition-all'
                                            style={{ width: `${100 - c.win_rate}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            <Modal open={showAdd} onOpenChange={setShowAdd} title='Registrar Concorrente em Negócio'>
                <form onSubmit={handleAdd} className='space-y-4'>
                    <Input label='ID do Negócio *' name='deal_id' type='number' required placeholder='Ex: 15' />
                    <Input label='Nome do Concorrente *' name='competitor_name' required placeholder='Ex: Empresa XYZ' />
                    <Input label='Preço do Concorrente (R$)' name='competitor_price' type='number' step='0.01' placeholder='0,00' />
                    <div>
                        <label className='text-xs font-medium text-surface-700 mb-1 block'>Pontos Fortes</label>
                        <textarea
                            name='strengths'
                            rows={2}
                            placeholder='Pontos fortes do concorrente...'
                            className='w-full rounded-lg border-default text-sm focus:ring-brand-500 focus:border-brand-500 px-3 py-2'
                        />
                    </div>
                    <div>
                        <label className='text-xs font-medium text-surface-700 mb-1 block'>Pontos Fracos</label>
                        <textarea
                            name='weaknesses'
                            rows={2}
                            placeholder='Pontos fracos do concorrente...'
                            className='w-full rounded-lg border-default text-sm focus:ring-brand-500 focus:border-brand-500 px-3 py-2'
                        />
                    </div>
                    <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                        <Button variant='outline' type='button' onClick={() => setShowAdd(false)}>Cancelar</Button>
                        <Button type='submit' loading={addMut.isPending}>Adicionar</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

function WinRateBadge({ rate }: { rate: number }) {
    if (rate >= 60) {
        return (
            <Badge variant='success' className='gap-1'>
                <TrendingUp className='h-3 w-3' /> {fmtPct(rate)}
            </Badge>
        )
    }
    if (rate >= 40) {
        return (
            <Badge variant='warning' className='gap-1'>
                <Minus className='h-3 w-3' /> {fmtPct(rate)}
            </Badge>
        )
    }
    return (
        <Badge variant='danger' className='gap-1'>
            <TrendingDown className='h-3 w-3' /> {fmtPct(rate)}
        </Badge>
    )
}

function PriceDiffBadge({ diff }: { diff: number | null }) {
    if (diff === null || diff === undefined) return <span className='text-surface-400'>—</span>
    if (diff > 0) {
        return <Badge variant='success'>-{fmtPct(Math.abs(diff))}</Badge>
    }
    if (diff < 0) {
        return <Badge variant='danger'>+{fmtPct(Math.abs(diff))}</Badge>
    }
    return <Badge variant='secondary'>0%</Badge>
}
