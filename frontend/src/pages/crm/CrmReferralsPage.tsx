import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Gift, TrendingUp, Plus, UserPlus, Award, Star } from 'lucide-react'
import { crmFeaturesApi } from '@/lib/crm-features-api'
import type { CrmReferral } from '@/lib/crm-features-api'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { TableSkeleton } from '@/components/ui/tableskeleton'
import { EmptyState } from '@/components/ui/emptystate'
import { toast } from 'sonner'

const fmtBRL = (v: number | string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_MAP: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'danger' | 'secondary' }> = {
    pending: { label: 'Pendente', variant: 'warning' },
    contacted: { label: 'Contactado', variant: 'info' },
    converted: { label: 'Convertido', variant: 'success' },
    lost: { label: 'Perdido', variant: 'danger' },
}

export function CrmReferralsPage() {
    const qc = useQueryClient()
    const [showCreate, setShowCreate] = useState(false)
    const [filterStatus, setFilterStatus] = useState('')

    const { data: res, isLoading } = useQuery({
        queryKey: ['crm-referrals', filterStatus],
        queryFn: () => crmFeaturesApi.getReferrals(filterStatus ? { status: filterStatus } : undefined),
    })
    const referrals: CrmReferral[] = res?.data?.data ?? res?.data ?? []

    const { data: statsRes } = useQuery({
        queryKey: ['crm-referral-stats'],
        queryFn: () => crmFeaturesApi.getReferralStats(),
    })
    const stats = statsRes?.data ?? {}

    const createMut = useMutation({
        mutationFn: (data: Partial<CrmReferral>) => crmFeaturesApi.createReferral(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['crm-referrals'] })
            qc.invalidateQueries({ queryKey: ['crm-referral-stats'] })
            setShowCreate(false)
            toast.success('Indicação registrada com sucesso')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao registrar indicação'),
    })

    const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        createMut.mutate({
            referrer_customer_id: Number(fd.get('referrer_customer_id')),
            referred_name: fd.get('referred_name') as string,
            referred_email: (fd.get('referred_email') as string) || null,
            referred_phone: (fd.get('referred_phone') as string) || null,
            reward_type: (fd.get('reward_type') as string) || null,
            reward_value: Number(fd.get('reward_value')) || null,
        })
    }

    const topReferrers: { name: string; count: number }[] = stats.top_referrers ?? []

    return (
        <div className='space-y-6'>
            <PageHeader
                title='Programa de Indicações'
                subtitle='Gerencie indicações de clientes e acompanhe conversões.'
                count={referrals.length}
                icon={Users}
            >
                <Button
                    size='sm'
                    onClick={() => setShowCreate(true)}
                    icon={<Plus className='h-4 w-4' />}
                >
                    Nova Indicação
                </Button>
            </PageHeader>

            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
                <div className='rounded-xl border border-default bg-surface-0 p-5 shadow-card'>
                    <div className='flex items-center gap-3'>
                        <div className='h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600'>
                            <UserPlus className='h-5 w-5' />
                        </div>
                        <div>
                            <p className='text-sm font-medium text-surface-500'>Total de Indicações</p>
                            <h3 className='text-2xl font-bold text-surface-900'>{stats.total ?? referrals.length}</h3>
                        </div>
                    </div>
                </div>
                <div className='rounded-xl border border-default bg-surface-0 p-5 shadow-card'>
                    <div className='flex items-center gap-3'>
                        <div className='h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600'>
                            <TrendingUp className='h-5 w-5' />
                        </div>
                        <div>
                            <p className='text-sm font-medium text-surface-500'>Convertidas</p>
                            <h3 className='text-2xl font-bold text-surface-900'>{stats.converted ?? 0}</h3>
                        </div>
                    </div>
                </div>
                <div className='rounded-xl border border-default bg-surface-0 p-5 shadow-card'>
                    <div className='flex items-center gap-3'>
                        <div className='h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600'>
                            <Award className='h-5 w-5' />
                        </div>
                        <div>
                            <p className='text-sm font-medium text-surface-500'>Taxa de Conversão</p>
                            <h3 className='text-2xl font-bold text-surface-900'>{stats.conversion_rate ?? 0}%</h3>
                        </div>
                    </div>
                </div>
                <div className='rounded-xl border border-default bg-surface-0 p-5 shadow-card'>
                    <div className='flex items-center gap-3'>
                        <div className='h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600'>
                            <Gift className='h-5 w-5' />
                        </div>
                        <div>
                            <p className='text-sm font-medium text-surface-500'>Recompensas Pagas</p>
                            <h3 className='text-2xl font-bold text-surface-900'>{fmtBRL(stats.total_rewards ?? 0)}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {topReferrers.length > 0 && (
                <div className='rounded-xl border border-default bg-surface-0 p-6 shadow-card'>
                    <h3 className='font-semibold text-surface-900 mb-4 flex items-center gap-2'>
                        <Star className='h-4 w-4 text-amber-500' /> Top Indicadores
                    </h3>
                    <div className='space-y-2'>
                        {topReferrers.slice(0, 5).map((r, idx) => (
                            <div key={r.name} className='flex items-center gap-3 text-sm'>
                                <span className='w-6 text-center font-bold text-surface-400'>{idx + 1}</span>
                                <span className='flex-1 font-medium text-surface-900 truncate'>{r.name}</span>
                                <Badge variant='brand'>{r.count} indicações</Badge>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className='bg-surface-0 border border-default rounded-xl overflow-hidden shadow-card'>
                <div className='p-4 border-b border-default flex flex-wrap items-center justify-between gap-3'>
                    <h2 className='font-semibold text-surface-900'>Indicações</h2>
                    <div className='flex items-center gap-2'>
                        <label className='text-xs font-medium text-surface-500'>Status:</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className='h-8 rounded-lg border-default text-xs px-2 w-32'
                        >
                            <option value=''>Todos</option>
                            {Object.entries(STATUS_MAP).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {isLoading ? (
                    <TableSkeleton rows={6} cols={7} />
                ) : referrals.length === 0 ? (
                    <EmptyState
                        icon={Users}
                        title='Nenhuma indicação encontrada'
                        message='Registre a primeira indicação para começar a acompanhar o programa.'
                        action={{ label: 'Nova Indicação', onClick: () => setShowCreate(true), icon: <Plus className='h-4 w-4' /> }}
                    />
                ) : (
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm'>
                            <thead className='bg-surface-50 text-surface-500 border-b border-default'>
                                <tr>
                                    <th className='px-4 py-3 text-left font-medium'>Indicador</th>
                                    <th className='px-4 py-3 text-left font-medium'>Indicado</th>
                                    <th className='px-4 py-3 text-left font-medium'>Contato</th>
                                    <th className='px-4 py-3 text-center font-medium'>Status</th>
                                    <th className='px-4 py-3 text-left font-medium'>Recompensa</th>
                                    <th className='px-4 py-3 text-left font-medium'>Negócio</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-subtle'>
                                {referrals.map((r) => {
                                    const s = STATUS_MAP[r.status] ?? STATUS_MAP.pending
                                    return (
                                        <tr key={r.id} className='hover:bg-surface-50 transition-colors'>
                                            <td className='px-4 py-3 font-medium text-surface-900'>
                                                {r.referrer?.name ?? `#${r.referrer_customer_id}`}
                                            </td>
                                            <td className='px-4 py-3 text-surface-700'>
                                                {r.referred?.name ?? r.referred_name}
                                            </td>
                                            <td className='px-4 py-3 text-surface-500 text-xs'>
                                                {r.referred_email && <span className='block'>{r.referred_email}</span>}
                                                {r.referred_phone && <span className='block'>{r.referred_phone}</span>}
                                                {!r.referred_email && !r.referred_phone && '—'}
                                            </td>
                                            <td className='px-4 py-3 text-center'>
                                                <Badge variant={s.variant}>{s.label}</Badge>
                                            </td>
                                            <td className='px-4 py-3 text-surface-600'>
                                                {r.reward_type ? (
                                                    <span className='flex items-center gap-1'>
                                                        <Gift className='h-3 w-3' />
                                                        {r.reward_value ? fmtBRL(r.reward_value) : r.reward_type}
                                                        {r.reward_given && <Badge variant='success' size='xs'>Pago</Badge>}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td className='px-4 py-3 text-surface-600'>
                                                {r.deal ? (
                                                    <span className='text-xs'>
                                                        {r.deal.title}
                                                        <span className='block text-emerald-600 font-medium'>{fmtBRL(r.deal.value)}</span>
                                                    </span>
                                                ) : '—'}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal open={showCreate} onOpenChange={setShowCreate} title='Nova Indicação'>
                <form onSubmit={handleCreate} className='space-y-4'>
                    <Input label='ID do Cliente Indicador *' name='referrer_customer_id' type='number' required placeholder='Ex: 42' />
                    <Input label='Nome do Indicado *' name='referred_name' required placeholder='Nome completo' />
                    <div className='grid grid-cols-2 gap-4'>
                        <Input label='E-mail' name='referred_email' type='email' placeholder='email@exemplo.com' />
                        <Input label='Telefone' name='referred_phone' placeholder='(11) 99999-0000' />
                    </div>
                    <div className='grid grid-cols-2 gap-4'>
                        <div>
                            <label className='text-xs font-medium text-surface-700 mb-1 block'>Tipo de Recompensa</label>
                            <select name='reward_type' className='w-full rounded-lg border-default text-sm focus:ring-brand-500 focus:border-brand-500'>
                                <option value=''>Nenhuma</option>
                                <option value='discount'>Desconto</option>
                                <option value='cash'>Dinheiro</option>
                                <option value='credit'>Crédito</option>
                                <option value='gift'>Brinde</option>
                            </select>
                        </div>
                        <Input label='Valor da Recompensa' name='reward_value' type='number' step='0.01' placeholder='0,00' />
                    </div>
                    <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                        <Button variant='outline' type='button' onClick={() => setShowCreate(false)}>Cancelar</Button>
                        <Button type='submit' loading={createMut.isPending}>Registrar Indicação</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
