import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/pageheader'
import { Card } from '@/components/ui/card'
import { Building2, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Receipt, CreditCard, FileText, ShieldAlert } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

interface TenantRow {
    tenant_id: number
    tenant_name: string
    tenant_document: string | null
    receivables_open: number
    receivables_overdue: number
    received_month: number
    payables_open: number
    payables_overdue: number
    paid_month: number
    expenses_month: number
    invoiced_month: number
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
    per_tenant: TenantRow[]
}

export function ConsolidatedFinancialPage() {
    const { hasRole } = useAuthStore()
    const isSuperAdmin = hasRole('super_admin')

    const { data, isLoading, isError } = useQuery<ConsolidatedData>({
        queryKey: ['financial-consolidated'],
        queryFn: () => api.get('/financial/consolidated').then(r => r.data),
        enabled: isSuperAdmin,
    })

    const totals = data?.totals
    const perTenant = data?.per_tenant ?? []

    if (!isSuperAdmin) {
        return (
            <div className="space-y-6">
                <PageHeader
                    title="Financeiro Consolidado"
                    subtitle="Visão unificada de todas as empresas"
                    icon={<Building2 className="h-6 w-6" />}
                />
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <ShieldAlert className="h-12 w-12 text-amber-400 mb-3" />
                    <p className="text-sm font-medium">Acesso restrito</p>
                    <p className="text-sm text-content-secondary mt-1">
                        Esta página está disponível apenas para administradores do sistema.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Financeiro Consolidado"
                subtitle="Visão unificada de todas as empresas"
                icon={<Building2 className="h-6 w-6" />}
            />

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
                </div>
            ) : isError ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <AlertTriangle className="h-12 w-12 text-red-300 mb-3" />
                    <p className="text-sm font-medium text-red-600">Erro ao carregar dados financeiros</p>
                    <p className="text-xs text-surface-400 mt-1">Tente novamente mais tarde</p>
                </div>
            ) : totals ? (
                <>
                    {/* KPIs consolidados */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-green-100 p-2.5 dark:bg-green-900/30">
                                    <TrendingUp className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-content-secondary">A Receber (em aberto)</p>
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
                                    <p className="text-xs text-content-secondary">A Pagar (em aberto)</p>
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
                                    <p className="text-xs text-content-secondary">Vencidos (receber)</p>
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
                                    <p className="text-xs text-content-secondary">Saldo (Receber - Pagar)</p>
                                    <p className={`text-lg font-bold ${data!.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(data!.balance)}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Resumo do mês */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                                <CreditCard className="h-5 w-5 text-red-500" />
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

                    {/* Tabela por empresa */}
                    <Card className="overflow-hidden">
                        <div className="px-5 py-4 border-b border-subtle">
                            <h3 className="text-sm font-semibold text-content-primary">Detalhamento por Empresa</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-surface-50 dark:bg-surface-800">
                                        <th className="text-left px-4 py-3 font-medium text-content-secondary">Empresa</th>
                                        <th className="text-left px-4 py-3 font-medium text-content-secondary">CNPJ</th>
                                        <th className="text-right px-4 py-3 font-medium text-content-secondary">A Receber</th>
                                        <th className="text-right px-4 py-3 font-medium text-content-secondary">Vencido</th>
                                        <th className="text-right px-4 py-3 font-medium text-content-secondary">A Pagar</th>
                                        <th className="text-right px-4 py-3 font-medium text-content-secondary">Despesas Mês</th>
                                        <th className="text-right px-4 py-3 font-medium text-content-secondary">Faturado Mês</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-subtle">
                                    {perTenant.map(row => (
                                        <tr key={row.tenant_id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                                            <td className="px-4 py-3 font-medium">{row.tenant_name}</td>
                                            <td className="px-4 py-3 text-content-secondary">{row.tenant_document || '—'}</td>
                                            <td className="px-4 py-3 text-right text-green-600">{formatCurrency(row.receivables_open)}</td>
                                            <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(row.receivables_overdue)}</td>
                                            <td className="px-4 py-3 text-right text-red-600">{formatCurrency(row.payables_open)}</td>
                                            <td className="px-4 py-3 text-right">{formatCurrency(row.expenses_month)}</td>
                                            <td className="px-4 py-3 text-right">{formatCurrency(row.invoiced_month)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                {perTenant.length > 1 && (
                                    <tfoot>
                                        <tr className="bg-surface-100 dark:bg-surface-700 font-semibold">
                                            <td className="px-4 py-3" colSpan={2}>TOTAL</td>
                                            <td className="px-4 py-3 text-right text-green-600">{formatCurrency(totals.receivables_open)}</td>
                                            <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(totals.receivables_overdue)}</td>
                                            <td className="px-4 py-3 text-right text-red-600">{formatCurrency(totals.payables_open)}</td>
                                            <td className="px-4 py-3 text-right">{formatCurrency(totals.expenses_month)}</td>
                                            <td className="px-4 py-3 text-right">{formatCurrency(totals.invoiced_month)}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
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
