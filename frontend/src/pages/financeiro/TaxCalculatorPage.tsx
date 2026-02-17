import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Calculator, Receipt, Percent } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'

const fmtBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtPct = (val: number) => `${val.toFixed(2)}%`

interface Tax { tax: string; rate: number; amount: number }
interface CalcResult {
    gross_amount: number; regime: string; taxes: Tax[]
    total_tax: number; net_amount: number; effective_rate: number
}

const regimeLabels: Record<string, string> = {
    simples_nacional: 'Simples Nacional',
    lucro_presumido: 'Lucro Presumido',
    lucro_real: 'Lucro Real',
}

export function TaxCalculatorPage() {
    const [grossAmount, setGrossAmount] = useState('')
    const [serviceType, setServiceType] = useState('calibracao')
    const [taxRegime, setTaxRegime] = useState('simples_nacional')
    const [result, setResult] = useState<CalcResult | null>(null)

    const calcMut = useMutation({
        mutationFn: () => api.post('/financial/tax-calculation', {
            gross_amount: Number(grossAmount),
            service_type: serviceType,
            tax_regime: taxRegime,
        }),
        onSuccess: (res) => { setResult(res.data.data ?? null) },
        onError: (error: unknown) => {
            const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
            toast.error(msg ?? 'Erro no cálculo de tributos')
        },
    })

    return (
        <div className="space-y-5">
            <PageHeader title="Calculadora de Tributos" subtitle="Calcule impostos para valores de serviço" />

            <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                <div className="grid gap-4 sm:grid-cols-3">
                    <Input
                        label="Valor Bruto (R$) *"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={grossAmount}
                        onChange={e => setGrossAmount(e.target.value)}
                        required
                    />
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Tipo de Serviço *</label>
                        <select value={serviceType} onChange={e => setServiceType(e.target.value)} aria-label="Tipo de serviço" className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                            <option value="calibracao">Calibração</option>
                            <option value="manutencao">Manutenção</option>
                            <option value="consultoria">Consultoria</option>
                            <option value="outros">Outros</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Regime Tributário</label>
                        <select value={taxRegime} onChange={e => setTaxRegime(e.target.value)} aria-label="Regime tributário" className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                            {Object.entries(regimeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                </div>
                <div className="mt-4">
                    <Button onClick={() => calcMut.mutate()} loading={calcMut.isPending} disabled={!grossAmount}>
                        <Calculator className="h-4 w-4 mr-1" /> Calcular
                    </Button>
                </div>
            </div>

            {result && (
                <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                            <p className="text-xs font-medium uppercase text-surface-500">Valor Bruto</p>
                            <p className="mt-1 text-2xl font-bold text-surface-900">{fmtBRL(result.gross_amount)}</p>
                            <p className="text-xs text-surface-400">{regimeLabels[result.regime]}</p>
                        </div>
                        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                            <p className="text-xs font-medium uppercase text-surface-500">Total de Impostos</p>
                            <p className="mt-1 text-2xl font-bold text-red-600">{fmtBRL(result.total_tax)}</p>
                            <p className="text-xs text-surface-400">Taxa efetiva: {fmtPct(result.effective_rate)}</p>
                        </div>
                        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                            <p className="text-xs font-medium uppercase text-surface-500">Valor Líquido</p>
                            <p className="mt-1 text-2xl font-bold text-emerald-600">{fmtBRL(result.net_amount)}</p>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-subtle bg-surface-50">
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Imposto</th>
                                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Alíquota</th>
                                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {result.taxes.map(t => (
                                    <tr key={t.tax} className="hover:bg-surface-50 transition-colors">
                                        <td className="px-4 py-3 text-sm font-medium text-surface-900">{t.tax}</td>
                                        <td className="px-4 py-3 text-sm text-right text-surface-600">{fmtPct(t.rate)}</td>
                                        <td className="px-4 py-3 text-sm text-right font-semibold text-surface-900">{fmtBRL(t.amount)}</td>
                                    </tr>
                                ))}
                                <tr className="bg-surface-50 font-semibold">
                                    <td className="px-4 py-3 text-sm text-surface-900">TOTAL</td>
                                    <td className="px-4 py-3 text-sm text-right text-surface-600">{fmtPct(result.effective_rate)}</td>
                                    <td className="px-4 py-3 text-sm text-right text-red-600">{fmtBRL(result.total_tax)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
