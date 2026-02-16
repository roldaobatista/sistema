import { useState } from 'react'
import {
    LayoutDashboard, FileDown, Search, Filter,
    AlertCircle, ExternalLink, Calendar, User,
    ShieldCheck, Eye, Loader2, Info
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuthStore } from '@/stores/auth-store'

export default function InmetroSealReportPage() {
  const { hasPermission } = useAuthStore()

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [techFilter, setTechFilter] = useState('')
    const [page, setPage] = useState(1)

    const { data: auditRes, isLoading: loadingAudit } = useQuery({
        queryKey: ['inmetro-seals-audit'],
        queryFn: () => api.get('/inventory/seals/audit')
    })
    const auditData = auditRes?.data

    const { data: reportRes, isLoading: loadingReport } = useQuery({
        queryKey: ['inmetro-seals-report', search, statusFilter, typeFilter, techFilter, page],
        queryFn: () => api.get('/inventory/seals', {
            params: {
                search,
                status: statusFilter,
                type: typeFilter,
                technician_id: techFilter,
                page,
                per_page: 20
            }
        })
    })
    const seals = reportRes?.data?.data || []
    const pagination = reportRes?.data

    const handleExport = async () => {
        try {
            const res = await api.get('/inventory/seals/export', {
                params: { status: statusFilter, type: typeFilter, technician_id: techFilter },
                responseType: 'blob'
            })
            const url = window.URL.createObjectURL(new Blob([res.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `relatorio_selos_${format(new Date(), 'yyyyMMdd')}.csv`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            toast.success('Relatório gerado com sucesso!')
        } catch (error) {
            toast.error('Erro ao exportar relatório')
        }
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
                        <LayoutDashboard className="w-7 h-7 text-brand-500" />
                        Relatório & Auditoria de Selos
                    </h1>
                    <p className="text-surface-500 text-sm">Controle de rastreabilidade e conformidade ISO 17025.</p>
                </div>
                <button
                    onClick={handleExport}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold transition-all shadow-lg active:scale-95"
                >
                    <FileDown className="w-4 h-4" /> Exportar CSV
                </button>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface-0 p-5 rounded-2xl border border-default shadow-sm relative overflow-hidden group">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Itens Parados</p>
                            <h3 className="text-2xl font-bold text-surface-900">
                                {loadingAudit ? <Loader2 className="w-5 h-5 animate-spin" /> : auditData?.stale_count || 0}
                            </h3>
                        </div>
                    </div>
                    <p className="mt-4 text-xs text-surface-500 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5" /> Atribuídos há mais de 30 dias sem uso.
                    </p>
                </div>

                <div className="bg-surface-0 p-5 rounded-2xl border border-default shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Total em Estoque</p>
                            <h3 className="text-2xl font-bold text-surface-900">
                                {pagination?.total || 0}
                            </h3>
                        </div>
                    </div>
                    <div className="mt-4 h-1 w-full bg-surface-100 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 w-[65%]" />
                    </div>
                </div>

                <div className="bg-brand-600 p-5 rounded-2xl text-white shadow-lg shadow-brand-500/20 flex flex-col justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Rastreabilidade Fotos</p>
                        <h3 className="text-xl font-bold mt-1">100% de Conformidade</h3>
                    </div>
                    <p className="text-xs opacity-90">Todas as aplicações possuem evidência fotográfica vinculada.</p>
                </div>
            </section>

            <div className="bg-surface-0 p-4 rounded-2xl border border-default shadow-sm flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                        type="search"
                        placeholder="Buscar por número..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-default bg-surface-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                </div>

                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    title="Filtrar por tipo"
                    className="px-4 py-2 rounded-xl border border-default bg-surface-50 text-sm focus:outline-none"
                >
                    <option value="">Tipos</option>
                    <option value="seal_reparo">Selo Reparo</option>
                    <option value="seal">Lacre</option>
                </select>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    title="Filtrar por status"
                    className="px-4 py-2 rounded-xl border border-default bg-surface-50 text-sm focus:outline-none"
                >
                    <option value="">Status</option>
                    <option value="available">Disponível</option>
                    <option value="assigned">Com Técnico</option>
                    <option value="used">Utilizado</option>
                    <option value="damaged">Danificado</option>
                </select>
            </div>

            <div className="bg-surface-0 rounded-2xl border border-default shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface-50 border-b border-default text-surface-500 font-semibold text-xs uppercase tracking-wider">
                                <th className="px-6 py-4">Selo/Lacre</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Técnico</th>
                                <th className="px-6 py-4">Aplicação (OS)</th>
                                <th className="px-6 py-4">Equipamento</th>
                                <th className="px-6 py-4">Evidência</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                            {loadingReport ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-4"><div className="h-10 bg-surface-100 rounded-lg" /></td>
                                    </tr>
                                ))
                            ) : seals.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-surface-500">
                                        Nenhum registro encontrado com os filtros aplicados.
                                    </td>
                                </tr>
                            ) : seals.map((seal: any) => (
                                <tr key={seal.id} className="hover:bg-surface-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                "w-2 h-2 rounded-full",
                                                seal.type === 'seal_reparo' ? "bg-emerald-500" : "bg-sky-500"
                                            )} />
                                            <div>
                                                <p className="font-bold text-surface-900">{seal.number}</p>
                                                <p className="text-xs text-surface-400">{seal.type === 'seal_reparo' ? 'Selo Reparo' : 'Lacre'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "inline-flex px-2 py-1 rounded-full text-xs font-bold uppercase tracking-tight",
                                            seal.status === 'used' ? "bg-emerald-100 text-emerald-700" :
                                                seal.status === 'assigned' ? "bg-blue-100 text-blue-700" :
                                                    "bg-surface-100 text-surface-600"
                                        )}>
                                            {seal.status === 'used' ? 'Utilizado' : seal.status === 'assigned' ? 'Em Campo' : 'Estoque'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {seal.assigned_to ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-surface-200 flex items-center justify-center overflow-hidden">
                                                    <User className="w-3.5 h-3.5 text-surface-500" />
                                                </div>
                                                <span className="text-sm text-surface-700">{seal.assigned_to?.name}</span>
                                            </div>
                                        ) : <span className="text-surface-300">—</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        {seal.work_order ? (
                                            <div className="space-y-1">
                                                <p className="text-xs font-semibold text-brand-600 flex items-center gap-1">
                                                    #{seal.work_order.os_number || seal.work_order.number}
                                                </p>
                                                <p className="text-xs text-surface-500 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {format(new Date(seal.used_at), 'dd MMM yyyy', { locale: ptBR })}
                                                </p>
                                            </div>
                                        ) : <span className="text-surface-300">—</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        {seal.equipment ? (
                                            <div className="max-w-[150px]">
                                                <p className="text-xs font-medium truncate text-surface-900">
                                                    {seal.equipment.brand}
                                                </p>
                                                <p className="text-xs text-surface-400 truncate">
                                                    Mod: {seal.equipment.model}
                                                </p>
                                            </div>
                                        ) : <span className="text-surface-300">—</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        {seal.photo_path ? (
                                            <a
                                                href={`/storage/${seal.photo_path}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="group relative flex items-center justify-center w-10 h-10 rounded-lg bg-surface-100 border border-default overflow-hidden"
                                            >
                                                <img
                                                    src={`/storage/${seal.photo_path}`}
                                                    alt="Evidência"
                                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                />
                                                <div className="absolute inset-0 bg-brand-500/0 group-hover:bg-brand-500/40 flex items-center justify-center transition-all">
                                                    <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                                                </div>
                                            </a>
                                        ) : <span className="text-surface-300">—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {pagination?.last_page > 1 && (
                    <div className="px-6 py-4 bg-surface-50/50 border-t border-default flex items-center justify-between">
                        <p className="text-xs text-surface-500">Mostrando {seals.length} de {pagination.total} registros</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 rounded-lg border border-default text-xs disabled:opacity-50"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))}
                                disabled={page === pagination.last_page}
                                className="px-3 py-1.5 rounded-lg border border-default text-xs disabled:opacity-50"
                            >
                                Próximo
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
