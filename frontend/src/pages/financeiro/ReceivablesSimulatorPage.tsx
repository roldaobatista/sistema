import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Calculator, TrendingDown, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'

const fmtBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

interface SimResult {
    id: number; customer: string; due_date: string; days_to_maturity: number
    face_value: number; present_value: number; discount: number; effective_rate: number
}

interface Summary {
    total_receivables: number; total_face_value: number; total_present_value: number
    total_discount: number; average_discount_rate: number; monthly_rate_used: number
}

export function ReceivablesSimulatorPage() {
    const [monthlyRate, setMonthlyRate] = useState('2')
    const [minAmount, setMinAmount] = useState('')
    const [results, setResults] = useState<SimResult[]>([])
    const [summary, setSummary] = useState<Summary | null>(null)

    const simMut = useMutation({
        mutationFn: () => api.post('/financial/receivables-simulator', {
            monthly_rate: Number(monthlyRate),
            min_amount: minAmount ? Number(minAmount) : undefined,
        }),
        onSuccess: (res) => {
            setResults(res.data.data ?? [])
            setSummary(res.data.summary ?? null)
        },
        onError: (error: unknown) => {
            const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
            toast.error(msg ?? 'Erro na simulação')
        },
    })

    return (
        <div className="space-y-5">
            <PageHeader title="Simulador de Antecipação" subtitle="Simule a antecipação de recebíveis com taxa de desconto" />

            <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                <div className="flex flex-wrap items-end gap-4">
                    <Input
                        label="Taxa mensal (%)"
                        type="number"
                        step="0.01"
                        min="0"
                        max="10"
                        value={monthlyRate}
                        onChange={e => setMonthlyRate(e.target.value)}
                        className="w-36"
                    />
                    <Input
                        label="Valor mínimo (R$)"
                        type="number"
                        step="0.01"
                        min="0"
                        value={minAmount}
                        onChange={e => setMinAmount(e.target.value)}
                        placeholder="Opcional"
                        className="w-40"
                    />
                    <Button onClick={() => simMut.mutate()} loading={simMut.isPending}>
                        <Calculator className="h-4 w-4 mr-1" /> Simular
                    </Button>
                </div>
            </div>

            {summary && (
                <div className="grid gap-4 sm:grid-cols-4">
                    <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                        <p className="text-xs font-medium uppercase text-surface-500">Recebíveis</p>
                        <p className="mt-1 text-2xl font-bold text-surface-900">{summary.total_receivables}</p>
                    </div>
                    <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                        <p className="text-xs font-medium uppercase text-surface-500">Valor de Face</p>
                        <p className="mt-1 text-2xl font-bold text-surface-900">{fmtBRL(summary.total_face_value)}</p>
                    </div>
                    <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                        <p className="text-xs font-medium uppercase text-surface-500">Valor Presente</p>
                        <p className="mt-1 text-2xl font-bold text-emerald-600">{fmtBRL(summary.total_present_value)}</p>
                    </div>
                    <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                        <p className="text-xs font-medium uppercase text-surface-500">Desconto Total</p>
                        <p className="mt-1 text-2xl font-bold text-red-600">{fmtBRL(summary.total_discount)}</p>
                        <p className="text-xs text-surface-400">({summary.average_discount_rate}%)</p>
                    </div>
                </div>
            )}

            {results.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-subtle bg-surface-50">
                                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Cliente</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Vencimento</th>
                                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Dias</th>
                                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Valor Face</th>
                                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Valor Presente</th>
                                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Desconto</th>
                                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Taxa Ef. %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                            {results.map(r => (
                                <tr key={r.id} className="hover:bg-surface-50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-medium text-surface-900">{r.customer}</td>
                                    <td className="px-4 py-3 text-sm text-surface-500">{fmtDate(r.due_date)}</td>
                                    <td className="px-4 py-3 text-sm text-right text-surface-600">{r.days_to_maturity}</td>
                                    <td className="px-4 py-3 text-sm text-right text-surface-900">{fmtBRL(r.face_value)}</td>
                                    <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-600">{fmtBRL(r.present_value)}</td>
                                    <td className="px-4 py-3 text-sm text-right text-red-600">{fmtBRL(r.discount)}</td>
                                    <td className="px-4 py-3 text-sm text-right text-surface-600">{r.effective_rate}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : !simMut.isPending && simMut.isSuccess ? (
                <div className="rounded-xl border border-default bg-surface-0 p-6 shadow-card">
                    <EmptyState icon={<DollarSign className="h-6 w-6 text-surface-300" />} message="Nenhum recebível pendente encontrado para simulação" />
                </div>
            ) : null}
        </div>
    )
}
