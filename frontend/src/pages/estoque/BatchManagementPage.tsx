import { useState , useMemo } from 'react'
import { toast } from 'sonner'
import { Package, Search, Plus, Calendar, BarChart3, AlertTriangle, CheckCircle2 , Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

interface Batch {
    id: number
    code: string
    product_name: string
    quantity: number
    manufactured_at: string
    expires_at: string | null
    status: 'active' | 'expired' | 'quarantine' | 'consumed'
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    active: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
    expired: { label: 'Vencido', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
    quarantine: { label: 'Quarentena', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertTriangle },
    consumed: { label: 'Consumido', color: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400', icon: Package },
}

const MOCK_BATCHES: Batch[] = [
    { id: 1, code: 'LOT-2026-001', product_name: 'Etiqueta Adesiva INMETRO 50x30mm', quantity: 5000, manufactured_at: '2026-01-15', expires_at: '2027-01-15', status: 'active' },
    { id: 2, code: 'LOT-2026-002', product_name: 'Selo de Segurança Holográfico', quantity: 2000, manufactured_at: '2025-06-01', expires_at: '2026-06-01', status: 'active' },
    { id: 3, code: 'LOT-2025-048', product_name: 'Peso Padrão Class F1 - 1kg', quantity: 12, manufactured_at: '2025-03-10', expires_at: null, status: 'active' },
    { id: 4, code: 'LOT-2024-099', product_name: 'Fluido de Limpeza 500ml', quantity: 0, manufactured_at: '2024-11-20', expires_at: '2025-11-20', status: 'expired' },
]

export default function BatchManagementPage() {

  // MVP: Data fetching
  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: ['batch-management'],
    queryFn: () => api.get('/batch-management').then(r => r.data?.data ?? r.data ?? []),
  })

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/batch-management/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['batch-management'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }

  // MVP: Loading/Error/Empty states
  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (isError) return <div className="flex flex-col items-center justify-center p-8 text-red-500"><AlertCircle className="h-8 w-8 mb-2" /><p>Erro ao carregar dados</p><button onClick={() => refetch()} className="mt-2 text-blue-500 underline">Tentar novamente</button></div>
  if (!items || (Array.isArray(items) && items.length === 0)) return <div className="flex flex-col items-center justify-center p-8 text-gray-400"><Inbox className="h-12 w-12 mb-2" /><p>Nenhum registro encontrado</p></div>
  const { hasPermission } = useAuthStore()

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')

    const filtered = MOCK_BATCHES.filter(b => {
        const matchesSearch = !search || b.code.toLowerCase().includes(search.toLowerCase()) || b.product_name.toLowerCase().includes(search.toLowerCase())
        const matchesStatus = statusFilter === 'all' || b.status === statusFilter
        return matchesSearch && matchesStatus
    })

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
                        <Package className="w-6 h-6 text-brand-600" />
                        Gestão de Lotes
                    </h1>
                    <p className="text-sm text-surface-500 mt-1">Controle de lotes de produtos com rastreabilidade e validade</p>
                </div>
                <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Novo Lote
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <Input
                        placeholder="Buscar por código ou produto..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {['all', 'active', 'expired', 'quarantine', 'consumed'].map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={cn(
                                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                statusFilter === s
                                    ? 'bg-brand-600 text-white'
                                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                            )}
                        >
                            {s === 'all' ? 'Todos' : STATUS_CONFIG[s]?.label || s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total de Lotes', value: MOCK_BATCHES.length, icon: Package, color: 'text-brand-600' },
                    { label: 'Ativos', value: MOCK_BATCHES.filter(b => b.status === 'active').length, icon: CheckCircle2, color: 'text-emerald-600' },
                    { label: 'Vencidos', value: MOCK_BATCHES.filter(b => b.status === 'expired').length, icon: AlertTriangle, color: 'text-red-600' },
                    { label: 'Quarentena', value: MOCK_BATCHES.filter(b => b.status === 'quarantine').length, icon: BarChart3, color: 'text-amber-600' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-800">
                        <div className="flex items-center gap-2 mb-2">
                            <stat.icon className={cn('w-4 h-4', stat.color)} />
                            <span className="text-xs text-surface-500">{stat.label}</span>
                        </div>
                        <p className="text-2xl font-bold text-surface-900 dark:text-surface-50">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-surface-100 dark:border-surface-800">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Código</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Produto</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Qtd</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Fabricação</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Validade</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(batch => {
                                const st = STATUS_CONFIG[batch.status] || STATUS_CONFIG.active
                                return (
                                    <tr key={batch.id} className="border-b border-surface-50 dark:border-surface-800/50 hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs font-semibold text-surface-900 dark:text-surface-50">{batch.code}</td>
                                        <td className="px-4 py-3 text-surface-700 dark:text-surface-300">{batch.product_name}</td>
                                        <td className="px-4 py-3 text-right font-medium text-surface-900 dark:text-surface-50">{batch.quantity.toLocaleString('pt-BR')}</td>
                                        <td className="px-4 py-3 text-surface-500 flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {new Date(batch.manufactured_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-4 py-3 text-surface-500">
                                            {batch.expires_at ? new Date(batch.expires_at).toLocaleDateString('pt-BR') : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge className={cn('text-[10px]', st.color)}>
                                                {st.label}
                                            </Badge>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-surface-400">
                                        <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                        <p>Nenhum lote encontrado</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
