import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/pageheader'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/emptystate'
import { AlertTriangle, ArrowDownToLine, Calendar, User } from 'lucide-react'

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')

type BucketKey = 'current' | '1_30' | '31_60' | '61_90' | 'over_90'

interface AgingItem {
    id: number
    customer_name: string
    description: string
    amount: number
    due_date: string
    days_overdue: number
}

interface Bucket {
    label: string
    total: number
    count: number
    items: AgingItem[]
}

type ApiData = {
    buckets: Record<BucketKey, Bucket>
    total_outstanding: number
    total_overdue: number
    total_records: number
}

const bucketOrder: BucketKey[] = ['current', '1_30', '31_60', '61_90', 'over_90']
const bucketColors: Record<BucketKey, string> = {
    current: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
    '1_30': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    '31_60': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    '61_90': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    over_90: 'bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-300',
}

export function AgingReceivablesPage() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['financial-aging-report'],
        queryFn: async () => {
            const res = await api.get('/financial/aging-report')
            return (res.data?.data ?? res.data) as ApiData
        },
    })

    const buckets = data?.buckets ?? ({} as Partial<Record<BucketKey, Bucket>>)
    const totalOverdue = data?.total_overdue ?? 0
    const totalOutstanding = data?.total_outstanding ?? 0

    if (isLoading) {
        return (
            <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            </div>
        )
    }

    if (isError) {
        return (
            <div className="space-y-6">
                <PageHeader title="Régua de Cobrança" subtitle="Envelhecimento de contas a receber" icon={<ArrowDownToLine className="h-6 w-6" />} />
                <Card className="p-8 text-center text-red-600">Erro ao carregar régua de cobrança. Tente novamente.</Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Régua de Cobrança"
                subtitle="Envelhecimento de contas a receber (a vencer e vencidas)"
                icon={<ArrowDownToLine className="h-6 w-6" />}
            />

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card className="p-4">
                    <div className="text-sm text-content-secondary">Total em aberto</div>
                    <p className="mt-1 text-xl font-bold">{fmtBRL(totalOutstanding)}</p>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-2 text-sm text-content-secondary">
                        <AlertTriangle className="h-4 w-4 text-amber-500" /> Total vencido
                    </div>
                    <p className="mt-1 text-xl font-bold text-amber-600">{fmtBRL(totalOverdue)}</p>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-content-secondary">Títulos</div>
                    <p className="mt-1 text-xl font-bold">{data?.total_records ?? 0}</p>
                </Card>
                <Card className="p-4 flex items-center">
                    <Link
                        to="/financeiro/receber"
                        className="text-sm font-medium text-brand-600 hover:underline"
                    >
                        Ver Contas a Receber →
                    </Link>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {bucketOrder.map((key) => {
                    const bucket = buckets[key]
                    if (!bucket) return null
                    const items = bucket.items ?? []
                    const color = bucketColors[key]
                    return (
                        <Card key={key} className="overflow-hidden">
                            <div className={`px-4 py-3 ${color}`}>
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold">{bucket.label}</span>
                                    <Badge variant="secondary">{bucket.count} título(s)</Badge>
                                </div>
                                <p className="mt-1 text-lg font-bold">{fmtBRL(bucket.total)}</p>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {items.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-content-secondary">Nenhum título</div>
                                ) : (
                                    <ul className="divide-y divide-subtle">
                                        {items.map((item) => (
                                            <li key={item.id} className="p-3 text-sm">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-medium text-content-primary truncate" title={item.customer_name}>
                                                            {item.customer_name}
                                                        </div>
                                                        <div className="text-xs text-content-secondary truncate" title={item.description}>
                                                            {item.description || '—'}
                                                        </div>
                                                        <div className="mt-1 flex items-center gap-2 text-xs text-content-secondary">
                                                            <Calendar className="h-3 w-3" />
                                                            {fmtDate(item.due_date)}
                                                            {item.days_overdue > 0 && (
                                                                <span className="text-amber-600">{item.days_overdue} dias</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right font-medium shrink-0">{fmtBRL(item.amount)}</div>
                                                </div>
                                                <Link
                                                    to="/financeiro/receber"
                                                    className="mt-2 inline-block text-xs text-brand-600 hover:underline"
                                                >
                                                    Ver título
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </Card>
                    )
                })}
            </div>

            {data?.total_records === 0 && (
                <EmptyState
                    icon={ArrowDownToLine}
                    title="Nenhum título em aberto"
                    description="Não há contas a receber pendentes para exibir na régua."
                />
            )}
        </div>
    )
}
