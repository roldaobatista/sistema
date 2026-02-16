import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, FileCheck, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react'
import { crmFeaturesApi } from '@/lib/crm-features-api'
import type { CrmContractRenewal } from '@/lib/crm-features-api'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { TableSkeleton } from '@/components/ui/tableskeleton'
import { EmptyState } from '@/components/ui/emptystate'
import { toast } from 'sonner'

const fmtBRL = (v: number | string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

const STATUS_MAP: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'danger' | 'secondary' }> = {
    pending: { label: 'Pendente', variant: 'warning' },
    contacted: { label: 'Contactado', variant: 'info' },
    renewed: { label: 'Renovado', variant: 'success' },
    lost: { label: 'Perdido', variant: 'danger' },
    cancelled: { label: 'Cancelado', variant: 'secondary' },
}

export function CrmRenewalsPage() {
    const qc = useQueryClient()
    const [updateModal, setUpdateModal] = useState<CrmContractRenewal | null>(null)
    const [selectedStatus, setSelectedStatus] = useState('')
    const [renewalValue, setRenewalValue] = useState('')
    const [filterStatus, setFilterStatus] = useState('')

    const { data: res, isLoading } = useQuery({
        queryKey: ['crm-renewals', filterStatus],
        queryFn: () => crmFeaturesApi.getRenewals(filterStatus ? { status: filterStatus } : undefined),
    })
    const renewals: CrmContractRenewal[] = Array.isArray(res?.data) ? res.data : (res?.data as { data?: CrmContractRenewal[] })?.data ?? []

    const generateMut = useMutation({
        mutationFn: () => crmFeaturesApi.generateRenewals(),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-renewals'] }); toast.success('Renovações geradas com sucesso') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao gerar renovações'),
    })

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<CrmContractRenewal> }) => crmFeaturesApi.updateRenewal(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['crm-renewals'] })
            setUpdateModal(null)
            toast.success('Renovação atualizada com sucesso')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao atualizar renovação'),
    })

    const openUpdateModal = (renewal: CrmContractRenewal) => {
        setUpdateModal(renewal)
        setSelectedStatus(renewal.status)
        setRenewalValue(renewal.renewal_value?.toString() ?? renewal.current_value?.toString() ?? '')
    }

    const handleUpdate = () => {
        if (!updateModal) return
        updateMut.mutate({
            id: updateModal.id,
            data: { status: selectedStatus, renewal_value: Number(renewalValue) || null },
        })
    }

    const statusCounts = renewals.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    return (
        <div className='space-y-6'>
            <PageHeader
                title='Renovações de Contrato'
                subtitle='Gerencie e acompanhe as renovações de contratos dos clientes.'
                count={renewals.length}
                icon={FileCheck}
            >
                <Button
                    variant='outline'
                    size='sm'
                    onClick={() => qc.invalidateQueries({ queryKey: ['crm-renewals'] })}
                    icon={<RefreshCw className='h-4 w-4' />}
                >
                    Atualizar
                </Button>
                <Button
                    size='sm'
                    onClick={() => generateMut.mutate()}
                    loading={generateMut.isPending}
                    icon={<FileCheck className='h-4 w-4' />}
                >
                    Gerar Renovações
                </Button>
            </PageHeader>

            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
                {[
                    { key: 'pending', icon: Clock, color: 'amber', label: 'Pendentes' },
                    { key: 'contacted', icon: AlertTriangle, color: 'sky', label: 'Contactados' },
                    { key: 'renewed', icon: CheckCircle, color: 'emerald', label: 'Renovados' },
                    { key: 'lost', icon: XCircle, color: 'red', label: 'Perdidos' },
                ].map(({ key, icon: Icon, color, label }) => (
                    <div key={key} className='rounded-xl border border-default bg-surface-0 p-5 shadow-card'>
                        <div className='flex items-center gap-3'>
                            <div className={`h-10 w-10 rounded-full bg-${color}-100 flex items-center justify-center text-${color}-600`}>
                                <Icon className='h-5 w-5' />
                            </div>
                            <div>
                                <p className='text-sm font-medium text-surface-500'>{label}</p>
                                <h3 className='text-2xl font-bold text-surface-900'>{statusCounts[key] ?? 0}</h3>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className='bg-surface-0 border border-default rounded-xl overflow-hidden shadow-card'>
                <div className='p-4 border-b border-default flex flex-wrap items-center justify-between gap-3'>
                    <h2 className='font-semibold text-surface-900'>Lista de Renovações</h2>
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
                    <TableSkeleton rows={6} cols={6} />
                ) : renewals.length === 0 ? (
                    <EmptyState
                        icon={FileCheck}
                        title='Nenhuma renovação encontrada'
                        message='Clique em "Gerar Renovações" para identificar contratos próximos do vencimento.'
                    />
                ) : (
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm'>
                            <thead className='bg-surface-50 text-surface-500 border-b border-default'>
                                <tr>
                                    <th className='px-4 py-3 text-left font-medium'>Cliente</th>
                                    <th className='px-4 py-3 text-left font-medium'>Negócio</th>
                                    <th className='px-4 py-3 text-center font-medium'>Vencimento</th>
                                    <th className='px-4 py-3 text-right font-medium'>Valor Atual</th>
                                    <th className='px-4 py-3 text-right font-medium'>Valor Renovação</th>
                                    <th className='px-4 py-3 text-center font-medium'>Status</th>
                                    <th className='px-4 py-3 text-right font-medium'>Ações</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-subtle'>
                                {renewals.map((r) => {
                                    const s = STATUS_MAP[r.status] ?? STATUS_MAP.pending
                                    return (
                                        <tr key={r.id} className='hover:bg-surface-50 transition-colors'>
                                            <td className='px-4 py-3 font-medium text-surface-900'>
                                                {r.customer?.name ?? `#${r.customer_id}`}
                                            </td>
                                            <td className='px-4 py-3 text-surface-600'>
                                                {r.deal?.title ?? '—'}
                                            </td>
                                            <td className='px-4 py-3 text-center text-surface-600'>
                                                {fmtDate(r.contract_end_date)}
                                            </td>
                                            <td className='px-4 py-3 text-right tabular-nums text-surface-700'>
                                                {fmtBRL(r.current_value)}
                                            </td>
                                            <td className='px-4 py-3 text-right tabular-nums font-semibold text-emerald-600'>
                                                {r.renewal_value ? fmtBRL(r.renewal_value) : '—'}
                                            </td>
                                            <td className='px-4 py-3 text-center'>
                                                <Badge variant={s.variant}>{s.label}</Badge>
                                            </td>
                                            <td className='px-4 py-3 text-right'>
                                                <Button
                                                    size='sm'
                                                    variant='outline'
                                                    className='h-7 text-xs'
                                                    onClick={() => openUpdateModal(r)}
                                                >
                                                    Atualizar
                                                </Button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal
                open={!!updateModal}
                onOpenChange={() => setUpdateModal(null)}
                title='Atualizar Renovação'
            >
                <div className='space-y-4'>
                    <div className='bg-surface-50 rounded-lg p-3 text-sm'>
                        <p className='font-medium text-surface-900'>{updateModal?.customer?.name}</p>
                        <p className='text-surface-500'>Vencimento: {updateModal?.contract_end_date ? fmtDate(updateModal.contract_end_date) : '—'}</p>
                        <p className='text-surface-500'>Valor atual: {fmtBRL(updateModal?.current_value ?? 0)}</p>
                    </div>

                    <div>
                        <label className='text-xs font-medium text-surface-700 mb-1 block'>Status</label>
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className='w-full rounded-lg border-default text-sm focus:ring-brand-500 focus:border-brand-500'
                        >
                            {Object.entries(STATUS_MAP).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className='text-xs font-medium text-surface-700 mb-1 block'>Valor da Renovação (R$)</label>
                        <input
                            type='number'
                            step='0.01'
                            min='0'
                            value={renewalValue}
                            onChange={(e) => setRenewalValue(e.target.value)}
                            className='w-full rounded-lg border-default text-sm focus:ring-brand-500 focus:border-brand-500 px-3 py-2'
                            placeholder='0,00'
                        />
                    </div>

                    <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                        <Button variant='outline' onClick={() => setUpdateModal(null)}>Cancelar</Button>
                        <Button onClick={handleUpdate} loading={updateMut.isPending}>Salvar</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
