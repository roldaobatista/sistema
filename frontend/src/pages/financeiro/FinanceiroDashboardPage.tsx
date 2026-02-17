import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/pageheader'
import { Card } from '@/components/ui/card'
import {
    Building2, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Receipt,
    ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, RotateCcw, Zap, Wallet,
    FileText, BarChart3,
} from 'lucide-react'

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

interface ConsolidatedData {
    period: string
    totals: {
        receivables_open: number
        receivables_overdue: number
        received_month: number
        payables_open: number
        payables_overdue: number
        paid_month: number
        expenses_month: number
        invoiced_month: number
    }
    balance: number
    per_tenant: { tenant_id: number; tenant_name: string }[]
}

const shortcuts = [
    { label: 'Contas a Receber', path: '/financeiro/receber', icon: ArrowDownToLine },
    { label: 'Contas a Pagar', path: '/financeiro/pagar', icon: ArrowUpFromLine },
    { label: 'Fluxo de Caixa', path: '/financeiro/fluxo-caixa', icon: BarChart3 },
    { label: 'Fluxo Caixa Semanal', path: '/financeiro/fluxo-caixa-semanal', icon: Wallet },
    { label: 'Régua de Cobrança', path: '/financeiro/regua-cobranca', icon: ArrowDownToLine },
    { label: 'Renegociação', path: '/financeiro/renegociacao', icon: RotateCcw },
    { label: 'Cobrança Automática', path: '/financeiro/cobranca-automatica', icon: Zap },
    { label: 'Consolidado', path: '/financeiro/consolidado', icon: Building2 },
    { label: 'Relatórios', path: '/relatorios', icon: FileText },
]

export function FinanceiroDashboardPage() {
    const { data, isLoading, isError } = useQuery<ConsolidatedData>({
        queryKey: ['financial-consolidated'],
        queryFn: () => api.get('/financial/consolidated').then(r => r.data),
    })

    const totals = data?.totals

    return (
        <div className="space-y-6">
            <PageHeader
                title="Financeiro"
                subtitle="Visão geral e atalhos do módulo"
                icon={<DollarSign className="h-6 w-6" />}
            />

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
                </div>
            ) : isError ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <AlertTriangle className="mb-3 h-12 w-12 text-red-300" />
                    <p className="text-sm font-medium text-red-600">Erro ao carregar dados financeiros</p>
                    <p className="mt-1 text-xs text-surface-400">Tente novamente mais tarde</p>
                </div>
            ) : totals ? (
                <>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-green-100 p-2.5 dark:bg-green-900/30">
                                    <TrendingUp className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-content-secondary">A Receber</p>
                                    <p className="text-lg font-bold text-green-600">{formatCurrency(totals.receivables_open)}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-red-100 p-2.5 dark:bg-red-900/30">
                                    <TrendingDown className="h-5 w-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-content-secondary">A Pagar</p>
                                    <p className="text-lg font-bold text-red-600">{formatCurrency(totals.payables_open)}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-amber-100 p-2.5 dark:bg-amber-900/30">
                                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-content-secondary">Vencidos</p>
                                    <p className="text-lg font-bold text-amber-600">{formatCurrency(totals.receivables_overdue)}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/30">
                                    <DollarSign className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-content-secondary">Saldo</p>
                                    <p className={`text-lg font-bold ${data!.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(data!.balance)}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <Receipt className="h-5 w-5 text-green-500" />
                                <div>
                                    <p className="text-xs text-content-secondary">Recebido no mês</p>
                                    <p className="text-base font-semibold">{formatCurrency(totals.received_month)}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <ArrowUpFromLine className="h-5 w-5 text-red-500" />
                                <div>
                                    <p className="text-xs text-content-secondary">Pago no mês</p>
                                    <p className="text-base font-semibold">{formatCurrency(totals.paid_month)}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <TrendingDown className="h-5 w-5 text-orange-500" />
                                <div>
                                    <p className="text-xs text-content-secondary">Despesas no mês</p>
                                    <p className="text-base font-semibold">{formatCurrency(totals.expenses_month)}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-purple-500" />
                                <div>
                                    <p className="text-xs text-content-secondary">Faturado no mês</p>
                                    <p className="text-base font-semibold">{formatCurrency(totals.invoiced_month)}</p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <Card className="p-5">
                        <h3 className="mb-4 text-sm font-semibold text-content-primary">Atalhos</h3>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {shortcuts.map(({ label, path, icon: Icon }) => (
                                <Link
                                    key={path}
                                    to={path}
                                    className="flex items-center gap-3 rounded-lg border border-subtle bg-surface-0 p-4 transition-colors hover:bg-surface-50 hover:border-brand-300 dark:hover:bg-surface-800 dark:hover:border-brand-700"
                                >
                                    <div className="rounded-lg bg-brand-100 p-2">
                                        <Icon className="h-5 w-5 text-brand-600" />
                                    </div>
                                    <span className="text-sm font-medium text-content-primary">{label}</span>
                                </Link>
                            ))}
                        </div>
                    </Card>
                </>
            ) : (
                <Card className="p-8 text-center text-content-secondary">
                    Nenhum dado financeiro disponível.
                </Card>
            )}
        </div>
    )
}
