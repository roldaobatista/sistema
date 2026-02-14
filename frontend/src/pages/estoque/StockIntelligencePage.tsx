import { useState } from 'react';
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
import { useAuthStore } from '@/stores/auth-store'
    BarChart3, TrendingUp, DollarSign, AlertTriangle, Loader2,
    Package, ArrowDown, ArrowUp, Search
} from 'lucide-react';

type Tab = 'abc' | 'turnover' | 'cost' | 'reorder';

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'abc', label: 'Curva ABC', icon: BarChart3 },
    { key: 'turnover', label: 'Giro de Estoque', icon: TrendingUp },
    { key: 'cost', label: 'Custo Médio', icon: DollarSign },
    { key: 'reorder', label: 'Reposição', icon: AlertTriangle },
];

const abcColors: Record<string, string> = {
    A: 'bg-emerald-100 text-emerald-800',
    B: 'bg-amber-100 text-amber-800',
    C: 'bg-red-100 text-red-800',
};

const turnoverColors: Record<string, { label: string; color: string }> = {
    fast: { label: 'Rápido', color: 'bg-emerald-100 text-emerald-800' },
    normal: { label: 'Normal', color: 'bg-blue-100 text-blue-800' },
    slow: { label: 'Lento', color: 'bg-amber-100 text-amber-800' },
    stale: { label: 'Parado', color: 'bg-red-100 text-red-800' },
};

const urgencyColors: Record<string, { label: string; color: string }> = {
    critical: { label: 'Crítico', color: 'bg-red-100 text-red-800' },
    urgent: { label: 'Urgente', color: 'bg-orange-100 text-orange-800' },
    soon: { label: 'Em breve', color: 'bg-amber-100 text-amber-800' },
    ok: { label: 'OK', color: 'bg-green-100 text-green-800' },
};

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function StockIntelligencePage() {
  const { hasPermission } = useAuthStore()

    const [activeTab, setActiveTab] = useState<Tab>('abc');
    const [months, setMonths] = useState(12);
    const [search, setSearch] = useState('');

    const { data: abcData, isLoading: abcLoading } = useQuery({
        queryKey: ['stock-intelligence-abc', months],
        queryFn: () => api.get('/api/v1/stock/intelligence/abc-curve', { params: { months } }).then(r => r.data),
        enabled: activeTab === 'abc',
    });

    const { data: turnoverData, isLoading: turnoverLoading } = useQuery({
        queryKey: ['stock-intelligence-turnover', months],
        queryFn: () => api.get('/api/v1/stock/intelligence/turnover', { params: { months } }).then(r => r.data),
        enabled: activeTab === 'turnover',
    });

    const { data: costData, isLoading: costLoading } = useQuery({
        queryKey: ['stock-intelligence-cost'],
        queryFn: () => api.get('/api/v1/stock/intelligence/average-cost').then(r => r.data),
        enabled: activeTab === 'cost',
    });

    const { data: reorderData, isLoading: reorderLoading } = useQuery({
        queryKey: ['stock-intelligence-reorder'],
        queryFn: () => api.get('/api/v1/stock/intelligence/reorder-points').then(r => r.data),
        enabled: activeTab === 'reorder',
    });

    const filterBySearch = (items: any[]) =>
        items.filter(i => !search || i.name?.toLowerCase().includes(search.toLowerCase()) || i.code?.toLowerCase().includes(search.toLowerCase()));

    const isLoading = (activeTab === 'abc' && abcLoading) || (activeTab === 'turnover' && turnoverLoading) || (activeTab === 'cost' && costLoading) || (activeTab === 'reorder' && reorderLoading);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <BarChart3 className="h-7 w-7 text-indigo-600" />
                <h1 className="text-2xl font-bold text-gray-900">Inteligência de Estoque</h1>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 p-1 bg-gray-100 rounded-xl">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab.key
                            ? 'bg-white text-indigo-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar produto..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                {(activeTab === 'abc' || activeTab === 'turnover') && (
                    <select
                        title="Período em meses"
                        value={months}
                        onChange={e => setMonths(Number(e.target.value))}
                        className="px-4 py-2 border border-gray-300 rounded-lg"
                    >
                        <option value={3}>3 meses</option>
                        <option value={6}>6 meses</option>
                        <option value={12}>12 meses</option>
                        <option value={24}>24 meses</option>
                    </select>
                )}
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
            )}

            {/* ABC Curve */}
            {activeTab === 'abc' && !abcLoading && abcData && (
                <div className="space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <SummaryCard label="Classe A (80%)" value={abcData.summary?.A ?? 0} color="text-emerald-600" />
                        <SummaryCard label="Classe B (15%)" value={abcData.summary?.B ?? 0} color="text-amber-600" />
                        <SummaryCard label="Classe C (5%)" value={abcData.summary?.C ?? 0} color="text-red-600" />
                        <SummaryCard label="Valor Total" value={formatBRL(abcData.summary?.total_value ?? 0)} color="text-indigo-600" />
                    </div>

                    {/* ABC Bar */}
                    <div className="bg-white rounded-xl border p-4">
                        <div className="flex h-6 rounded-full overflow-hidden bg-gray-100">
                            {['A', 'B', 'C'].map(cls => {
                                const count = abcData.summary?.[cls] ?? 0;
                                const total = (abcData.summary?.A ?? 0) + (abcData.summary?.B ?? 0) + (abcData.summary?.C ?? 0);
                                const pct = total > 0 ? (count / total) * 100 : 0;
                                const bg = cls === 'A' ? 'bg-emerald-500' : cls === 'B' ? 'bg-amber-500' : 'bg-red-500';
                                return <div key={cls} className={`${bg} transition-all duration-700`} style={{ width: `${pct}%` }} title={`${cls}: ${count} (${pct.toFixed(0)}%)`} />;
                            })}
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-gray-600">
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />A ({abcData.summary?.A})</span>
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />B ({abcData.summary?.B})</span>
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />C ({abcData.summary?.C})</span>
                        </div>
                    </div>

                    {/* Table */}
                    <DataTable
                        items={filterBySearch(abcData.data ?? [])}
                        columns={[
                            { key: 'name', label: 'Produto', render: (i: any) => <><span className="font-medium">{i.name}</span>{i.code && <span className="text-xs text-gray-400 ml-1">({i.code})</span>}</> },
                            { key: 'total_qty', label: 'Qtd Saída', align: 'right' },
                            { key: 'total_value', label: 'Valor', align: 'right', render: (i: any) => formatBRL(i.total_value) },
                            { key: 'percentage', label: '%', align: 'right', render: (i: any) => `${i.percentage}%` },
                            { key: 'cumulative', label: 'Acum.', align: 'right', render: (i: any) => `${i.cumulative}%` },
                            { key: 'class', label: 'Classe', align: 'center', render: (i: any) => <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${abcColors[i.class]}`}>{i.class}</span> },
                        ]}
                    />
                </div>
            )}

            {/* Turnover */}
            {activeTab === 'turnover' && !turnoverLoading && turnoverData && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <SummaryCard label="Rápido" value={turnoverData.summary?.fast ?? 0} color="text-emerald-600" icon={<ArrowUp className="h-4 w-4" />} />
                        <SummaryCard label="Normal" value={turnoverData.summary?.normal ?? 0} color="text-blue-600" />
                        <SummaryCard label="Lento" value={turnoverData.summary?.slow ?? 0} color="text-amber-600" icon={<ArrowDown className="h-4 w-4" />} />
                        <SummaryCard label="Parado" value={turnoverData.summary?.stale ?? 0} color="text-red-600" icon={<AlertTriangle className="h-4 w-4" />} />
                    </div>
                    <DataTable
                        items={filterBySearch(turnoverData.data ?? [])}
                        columns={[
                            { key: 'name', label: 'Produto', render: (i: any) => <><span className="font-medium">{i.name}</span>{i.code && <span className="text-xs text-gray-400 ml-1">({i.code})</span>}</> },
                            { key: 'stock_qty', label: 'Estoque', align: 'right' },
                            { key: 'total_exits', label: 'Saídas', align: 'right' },
                            { key: 'turnover_rate', label: 'Giro', align: 'right', render: (i: any) => `${i.turnover_rate}x` },
                            { key: 'coverage_days', label: 'Cobertura', align: 'right', render: (i: any) => i.coverage_days >= 999 ? '∞' : `${i.coverage_days}d` },
                            { key: 'classification', label: 'Classe', align: 'center', render: (i: any) => { const c = turnoverColors[i.classification]; return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c?.color}`}>{c?.label}</span>; } },
                        ]}
                    />
                </div>
            )}

            {/* Average Cost */}
            {activeTab === 'cost' && !costLoading && costData && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <SummaryCard label="Valor Total em Estoque" value={formatBRL(costData.total_value ?? 0)} color="text-indigo-600" icon={<DollarSign className="h-4 w-4" />} />
                        <SummaryCard label="Produtos" value={(costData.data ?? []).length} color="text-gray-600" icon={<Package className="h-4 w-4" />} />
                    </div>
                    <DataTable
                        items={filterBySearch(costData.data ?? [])}
                        columns={[
                            { key: 'name', label: 'Produto', render: (i: any) => <><span className="font-medium">{i.name}</span>{i.code && <span className="text-xs text-gray-400 ml-1">({i.code})</span>}</> },
                            { key: 'stock_qty', label: 'Estoque', align: 'right' },
                            { key: 'current_cost', label: 'Custo Cadastro', align: 'right', render: (i: any) => formatBRL(i.current_cost) },
                            { key: 'average_cost', label: 'Custo Médio', align: 'right', render: (i: any) => formatBRL(i.average_cost) },
                            { key: 'total_entries', label: 'Tot. Entradas', align: 'right' },
                            { key: 'stock_value', label: 'Valor Estoque', align: 'right', render: (i: any) => <span className="font-semibold">{formatBRL(i.stock_value)}</span> },
                        ]}
                    />
                </div>
            )}

            {/* Reorder Points */}
            {activeTab === 'reorder' && !reorderLoading && reorderData && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        <SummaryCard label="Crítico" value={reorderData.summary?.critical ?? 0} color="text-red-600" />
                        <SummaryCard label="Urgente" value={reorderData.summary?.urgent ?? 0} color="text-orange-600" />
                        <SummaryCard label="Em breve" value={reorderData.summary?.soon ?? 0} color="text-amber-600" />
                        <SummaryCard label="OK" value={reorderData.summary?.ok ?? 0} color="text-green-600" />
                        <SummaryCard label="Custo Estimado" value={formatBRL(reorderData.summary?.estimated_reorder_cost ?? 0)} color="text-indigo-600" />
                    </div>
                    <DataTable
                        items={filterBySearch(reorderData.all ?? [])}
                        columns={[
                            { key: 'name', label: 'Produto', render: (i: any) => <><span className="font-medium">{i.name}</span>{i.code && <span className="text-xs text-gray-400 ml-1">({i.code})</span>}</> },
                            { key: 'stock_qty', label: 'Atual', align: 'right' },
                            { key: 'stock_min', label: 'Mínimo', align: 'right' },
                            { key: 'daily_consumption', label: 'Consumo/dia', align: 'right' },
                            { key: 'days_until_min', label: 'Dias até mín.', align: 'right', render: (i: any) => i.days_until_min >= 999 ? '∞' : `${i.days_until_min}d` },
                            { key: 'suggested_qty', label: 'Sugestão', align: 'right', render: (i: any) => i.suggested_qty > 0 ? <span className="font-bold text-indigo-600">+{i.suggested_qty}</span> : '—' },
                            { key: 'urgency', label: 'Urgência', align: 'center', render: (i: any) => { const u = urgencyColors[i.urgency]; return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u?.color}`}>{u?.label}</span>; } },
                        ]}
                    />
                </div>
            )}
        </div>
    );
}

/* ── Helper Components ── */

function SummaryCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon?: React.ReactNode }) {
    return (
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
            {icon && <div className={color}>{icon}</div>}
            <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
        </div>
    );
}

interface Column {
    key: string;
    label: string;
    align?: 'left' | 'right' | 'center';
    render?: (item: any) => React.ReactNode;
}

function DataTable({ items, columns }: { items: any[]; columns: Column[] }) {
    return (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        {columns.map(col => (
                            <th key={col.key} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase text-${col.align ?? 'left'}`}>
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {items.length === 0 && (
                        <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400">
                            <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                            Nenhum dado encontrado
                        </td></tr>
                    )}
                    {items.map((item, idx) => (
                        <tr key={item.id ?? idx} className="hover:bg-gray-50">
                            {columns.map(col => (
                                <td key={col.key} className={`px-4 py-3 text-sm text-${col.align ?? 'left'}`}>
                                    {col.render ? col.render(item) : item[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
