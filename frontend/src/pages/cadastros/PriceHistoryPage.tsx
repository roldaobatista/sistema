import { useQuery , useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useState , useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, Search, Filter, ArrowUpDown } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

interface PriceHistoryEntry {
    id: number
    priceable_type: string
    priceable_id: number
    old_cost_price: string | null
    new_cost_price: string | null
    old_sell_price: string | null
    new_sell_price: string | null
    change_percent: string | null
    reason: string | null
    changed_by_user: { id: number; name: string } | null
    created_at: string
}

export function PriceHistoryPage() {

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/price-history/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso');
                queryClient.invalidateQueries({ queryKey: ['price-history'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const handleDelete = (id: number) => { setConfirmDeleteId(id) }
  const confirmDelete = () => { if (confirmDeleteId !== null) { deleteMutation.mutate(confirmDeleteId); setConfirmDeleteId(null) } }
  const { hasPermission } = useAuthStore()

    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [entityType, setEntityType] = useState<string>('all')

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['price-history', entityType, dateFrom, dateTo],
        queryFn: () => {
            const params: Record<string, string> = {}
            if (entityType === 'product') params.priceable_type = 'App\\Models\\Product'
            if (entityType === 'service') params.priceable_type = 'App\\Models\\Service'
            if (dateFrom) params.date_from = dateFrom
            if (dateTo) params.date_to = dateTo
            return api.get('/price-history', { params }).then(res => res.data)
        },
    })

    const entries: PriceHistoryEntry[] = data?.data || []

    const getEntityLabel = (type: string) => {
        if (type.includes('Product')) return 'Produto'
        if (type.includes('Service')) return 'Serviço'
        return type
    }

    const getChangeIcon = (percent: string | null) => {
        if (!percent) return <Minus className="h-4 w-4 text-surface-400" />
        const val = parseFloat(percent)
        if (val > 0) return <TrendingUp className="h-4 w-4 text-red-500" />
        if (val < 0) return <TrendingDown className="h-4 w-4 text-green-500" />
        return <Minus className="h-4 w-4 text-surface-400" />
    }

    const getChangeBadge = (percent: string | null) => {
        if (!percent) return null
        const val = parseFloat(percent)
        if (val > 0) return <Badge variant="danger">+{val}%</Badge>
        if (val < 0) return <Badge variant="success">{val}%</Badge>
        return <Badge variant="default">0%</Badge>
    }

    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Histórico de Preços</h1>
            </div>

            {/* Filters */}
            <div className="bg-surface-0 dark:bg-surface-800 p-4 rounded-lg shadow border border-surface-200">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex gap-2">
                        <Button
                            variant={entityType === 'all' ? 'default' : 'outline'}
                            onClick={() => setEntityType('all')}
                            size="sm"
                        >
                            Tudo
                        </Button>
                        <Button
                            variant={entityType === 'product' ? 'default' : 'outline'}
                            onClick={() => setEntityType('product')}
                            size="sm"
                        >
                            Produtos
                        </Button>
                        <Button
                            variant={entityType === 'service' ? 'default' : 'outline'}
                            onClick={() => setEntityType('service')}
                            size="sm"
                        >
                            Serviços
                        </Button>
                    </div>
                    <div className="flex gap-2 items-center ml-auto">
                        <Input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="w-40"
                        />
                        <span className="text-surface-400">até</span>
                        <Input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="w-40"
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-surface-0 dark:bg-surface-800 shadow overflow-hidden sm:rounded-lg border border-surface-200">
                <table className="min-w-full divide-y divide-surface-200">
                    <thead className="bg-surface-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Data</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Tipo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Item #</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-surface-500 uppercase tracking-wider">Custo Anterior</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-surface-500 uppercase tracking-wider">Custo Novo</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-surface-500 uppercase tracking-wider">Venda Anterior</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-surface-500 uppercase tracking-wider">Venda Nova</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-surface-500 uppercase tracking-wider">Variação</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Alterado por</th>
                        </tr>
                    </thead>
                    <tbody className="bg-surface-0 dark:bg-surface-800 divide-y divide-surface-200">
                        {isLoading ? (
                            <tr><td colSpan={9} className="px-6 py-8 text-center text-surface-500">Carregando...</td></tr>
                        ) : entries.length === 0 ? (
                            <tr><td colSpan={9} className="px-6 py-8 text-center text-surface-500">Nenhum registro de alteração de preço encontrado.</td></tr>
                        ) : entries.map(entry => (
                            <tr key={entry.id} className="hover:bg-surface-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-900">
                                    {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <Badge variant={entry.priceable_type.includes('Product') ? 'primary' : 'secondary'}>
                                        {getEntityLabel(entry.priceable_type)}
                                    </Badge>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-[13px] text-surface-600">
                                    #{entry.priceable_id}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-surface-600">
                                    {entry.old_cost_price ? formatCurrency(Number(entry.old_cost_price)) : '—'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-surface-900">
                                    {entry.new_cost_price ? formatCurrency(Number(entry.new_cost_price)) : '—'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-surface-600">
                                    {entry.old_sell_price ? formatCurrency(Number(entry.old_sell_price)) : '—'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-surface-900">
                                    {entry.new_sell_price ? formatCurrency(Number(entry.new_sell_price)) : '—'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        {getChangeIcon(entry.change_percent)}
                                        {getChangeBadge(entry.change_percent)}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-[13px] text-surface-600">
                                    {entry.changed_by_user?.name || 'Sistema'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
