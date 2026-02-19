import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Calculator, CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import type { SimulationResult } from './types'
import { fmtBRL } from './utils'

export function CommissionSimulatorTab() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('commissions.rule.create')
    const [woId, setWoId] = useState('')
    const [showGenConfirm, setShowGenConfirm] = useState(false)
    const simMut = useMutation({
        mutationFn: (workOrderId: string) => api.post('/commission-simulate', { work_order_id: Number(workOrderId) }),
        onSuccess: () => { toast.success('Simulação concluída') },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao simular comissão'),
    })
    const genMut = useMutation({
        mutationFn: (workOrderId: string) => api.post('/commission-events/generate', { work_order_id: Number(workOrderId) }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['commission-events'] });
            qc.invalidateQueries({ queryKey: ['commission-overview'] }); toast.success('Comissões geradas com sucesso!')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao gerar comissões')
    })
    const results: SimulationResult[] = simMut.data?.data ?? []

    return (
        <>
            <div className='space-y-4'>
                <div className='bg-surface-0 border border-default rounded-xl p-6 shadow-card'>
                    <div className='flex items-center gap-3 mb-4'>
                        <div className='h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600'>
                            <Calculator className='h-5 w-5' />
                        </div>
                        <div>
                            <h2 className='font-semibold text-surface-900'>Simulador de Comissão</h2>
                            <p className='text-xs text-surface-500'>Insira o ID da OS para pré-visualizar as comissões que seriam geradas — sem salvar no banco.</p>
                        </div>
                    </div>
                    <div className='flex gap-3 items-end'>
                        <div>
                            <label className='text-xs font-medium text-surface-700 mb-1 block'>ID da Ordem de Serviço</label>
                            <Input type='number' placeholder='Ex: 123' value={woId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWoId(e.target.value)} className='w-40' />
                        </div>
                        <Button onClick={() => { if (woId) simMut.mutate(woId) }} loading={simMut.isPending} disabled={!woId} icon={<Calculator className='h-4 w-4' />}>Simular</Button>
                    </div>
                </div>

                {simMut.isSuccess && (
                    <div className='bg-surface-0 border border-default rounded-xl overflow-hidden shadow-card'>
                        <div className='p-4 border-b border-default'>
                            <h3 className='font-semibold text-surface-900'>Resultado da Simulação</h3>
                            <p className='text-xs text-surface-500'>OS #{woId} — {results.length} comissão(ões) simulada(s)</p>
                        </div>
                        {results.length === 0 ? (
                            <div className='p-12 text-center'>
                                <Calculator className='h-8 w-8 mx-auto text-surface-300 mb-2' />
                                <p className='text-surface-500'>Nenhuma regra de comissão se aplica a esta OS.</p>
                            </div>
                        ) : (
                            <div className='overflow-x-auto'>
                                <table className='w-full text-sm'>
                                    <thead className='bg-surface-50 text-surface-500 border-b border-default'>
                                        <tr>
                                            <th className='px-4 py-3 text-left font-medium'>Regra</th>
                                            <th className='px-4 py-3 text-left font-medium'>Beneficiário</th>
                                            <th className='px-4 py-3 text-left font-medium'>Tipo Cálculo</th>
                                            <th className='px-4 py-3 text-right font-medium'>Base</th>
                                            <th className='px-4 py-3 text-right font-medium'>Taxa / Valor</th>
                                            <th className='px-4 py-3 text-right font-medium'>Comissão</th>
                                        </tr>
                                    </thead>
                                    <tbody className='divide-y divide-subtle'>
                                        {results.map((sim, idx) => (
                                            <tr key={idx} className='hover:bg-surface-50 transition-colors'>
                                                <td className='px-4 py-3 font-medium text-surface-900'>{sim.rule_name ?? sim.rule?.name ?? `Regra #${sim.rule_id}`}</td>
                                                <td className='px-4 py-3 text-surface-700'>{sim.user_name ?? sim.user?.name ?? `User #${sim.user_id}`}</td>
                                                <td className='px-4 py-3'>
                                                    <Badge variant='outline' className='text-xs'>{sim.calculation_type?.replace(/_/g, ' ')}</Badge>
                                                </td>
                                                <td className='px-4 py-3 text-right text-surface-600'>{fmtBRL(sim.base_amount ?? 0)}</td>
                                                <td className='px-4 py-3 text-right text-surface-600'>{sim.rate ? `${sim.rate}%` : fmtBRL(sim.fixed_amount ?? 0)}</td>
                                                <td className='px-4 py-3 text-right font-semibold text-emerald-600'>{fmtBRL(sim.commission_amount ?? 0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className='bg-surface-50 border-t border-default'>
                                        <tr>
                                            <td colSpan={5} className='px-4 py-3 text-right font-semibold text-surface-700'>Total Simulado:</td>
                                            <td className='px-4 py-3 text-right font-bold text-emerald-600 text-base'>{fmtBRL(results.reduce((sum, s) => sum + Number(s.commission_amount ?? 0), 0))}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                        {results.length > 0 && canCreate && (
                            <div className='p-4 border-t border-default flex justify-end'>
                                <Button onClick={() => setShowGenConfirm(true)}
                                    loading={genMut.isPending} className='bg-emerald-600 hover:bg-emerald-700 text-white'
                                    icon={<CheckCircle className='h-4 w-4' />}>Gerar Comissões</Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Modal open={showGenConfirm} onOpenChange={setShowGenConfirm} title='Gerar Comissões'>
                <p className='text-sm text-surface-600 py-2'>
                    Deseja gerar {results.length} comissão(ões) para a OS #{woId}? Esta ação criará eventos reais no sistema.
                </p>
                <div className='flex justify-end gap-2 pt-4 border-t border-surface-100'>
                    <Button variant='outline' onClick={() => setShowGenConfirm(false)}>Cancelar</Button>
                    <Button className='bg-emerald-600 hover:bg-emerald-700 text-white' loading={genMut.isPending}
                        onClick={() => { genMut.mutate(woId); setShowGenConfirm(false) }}>Confirmar Geração</Button>
                </div>
            </Modal>
        </>
    )
}
