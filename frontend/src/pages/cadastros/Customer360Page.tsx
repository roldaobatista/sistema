import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import * as Tabs from '@radix-ui/react-tabs'
import {
    ArrowLeft, User, Phone, Mail, MapPin, Building2, Tag,
    Calendar, DollarSign, Scale, FileText, Plus, Clock,
    Loader2, Edit, Target, FileCheck, Download,
    ClipboardList, MessageSquare, History, FileSearch, ShieldCheck,
    AlertCircle, TrendingUp, CheckCircle2, MoreVertical,
    ExternalLink, Map, CreditCard, Receipt, BarChart3, Activity, WifiOff
} from 'lucide-react'
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Legend,
    PolarGrid, PolarAngleAxis, Radar, Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { WORK_ORDER_STATUS, QUOTE_STATUS } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { CustomerHealthScore } from '@/components/crm/CustomerHealthScore'
import { CustomerTimeline } from '@/components/crm/CustomerTimeline'
import { ActivityForm } from '@/components/crm/ActivityForm'
import { SendMessageModal } from '@/components/crm/SendMessageModal'
import { MessageHistory } from '@/components/crm/MessageHistory'
import { crmApi } from '@/lib/crm-api'
import { CustomerInmetroTab } from '@/components/inmetro/CustomerInmetroTab'
import { CustomerDocumentsTab } from '@/components/customers/CustomerDocumentsTab'
import { useOfflineStore } from '@/hooks/useOfflineStore'
import api, { getApiOrigin } from '@/lib/api'
import { useEffect } from 'react'
import { toast } from 'sonner'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const serviceCallStatusLabel: Record<string, string> = {
    open: 'Aberto', scheduled: 'Agendado', in_transit: 'Em Trânsito',
    in_progress: 'Em Atendimento', completed: 'Concluído', cancelled: 'Cancelado',
}
const serviceCallPriorityLabel: Record<string, string> = {
    low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente',
}

export function Customer360Page() {
    const { id } = useParams()
    const navigate = useNavigate()
    const customerId = Number(id)
    const queryClient = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const [nowTs] = useState(() => Date.now())
    const [activityFormOpen, setActivityFormOpen] = useState(false)
    const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<number | null>(null)
    const [sendMessageOpen, setSendMessageOpen] = useState(false)

    // MVP: Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (noteId: number) => api.delete(`/crm/activities/${noteId}`),
        onSuccess: () => {
            toast.success('Atividade removida');
            queryClient.invalidateQueries({ queryKey: ['customer-360', id] })
        },
        onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
    })
    const handleDeleteActivity = (noteId: number) => {
        setConfirmDeleteNoteId(noteId)
    }

    // Travas de Permissão do Negócio
    const isAdmin = hasRole('super_admin') || hasRole('admin')
    const canViewFinance = isAdmin || hasPermission('finance.receivable.view')
    const canViewPrices = canViewFinance || hasPermission('quotes.quote.create') // Técnico-Vendedor vê preços
    const canEdit = isAdmin || hasPermission('cadastros.customer.update')
    const canCreateChamado = isAdmin || hasPermission('service_calls.service_call.create')
    const canCreateOs = isAdmin || hasPermission('os.work_order.create')

    const { put: cacheCapsule, getById: getCachedCapsule } = useOfflineStore('customer-capsules')
    const [isOnline, setIsOnline] = useState(() => navigator.onLine)
    const [offlineData, setOfflineData] = useState<any>(null)

    useEffect(() => {
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    const { data: dashboardData, isLoading, refetch } = useQuery({
        queryKey: ['customer-360', id],
        queryFn: () => crmApi.getCustomer360(customerId).then(r => r.data),
        enabled: !!id && isOnline,
    })

    const handleExportPdf = () => {
        const url = `${getApiOrigin()}/api/v1/crm/customer-360/${id}/pdf`;
        window.open(url, '_blank');
        toast.success('Relatório PDF está sendo gerado...');
    }

    // Load from cache if offline or while loading
    useEffect(() => {
        if (customerId) {
            getCachedCapsule(customerId).then(cached => {
                if (cached) setOfflineData(cached.data)
            })
        }
    }, [customerId, getCachedCapsule])

    // Save to cache when online data arrives
    useEffect(() => {
        if (dashboardData && customerId) {
            cacheCapsule({ id: customerId, data: dashboardData, updated_at: new Date().toISOString() })
        }
    }, [dashboardData, customerId, cacheCapsule])

    const data = isOnline ? (dashboardData || offlineData) : offlineData
    const apiLoading = isLoading // Renaming for consistency with original code
    const finalIsLoading = isOnline && apiLoading && !offlineData

    if (finalIsLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
                    <p className="text-sm text-surface-400 animate-pulse">Orbitando universo do cliente...</p>
                </div>
            </div>
        )
    }

    const customer = data?.customer
    const healthBreakdown = data?.health_breakdown ? Object.values(data.health_breakdown) as { score: number; max: number; label: string }[] : []
    const equipments = data?.equipments ?? []
    const deals = data?.deals ?? []
    const timeline = data?.timeline ?? []
    const workOrders = data?.work_orders ?? []
    const serviceCalls = data?.service_calls ?? []
    const quotes = data?.quotes ?? []
    const receivables = data?.receivables ?? []
    const pendingReceivablesTotal = data?.pending_receivables ?? 0
    const documents = data?.documents ?? []
    const fiscalNotes = data?.fiscal_notes ?? []
    const metrics = data?.metrics ?? {
        churn_risk: 'baixo',
        last_contact_days: 0,
        ltv: 0,
        conversion_rate: 0,
        forecast: [],
        trend: [],
        main_equipment_name: null,
        radar: []
    }

    if (!customer) {
        return (
            <div className="flex h-full items-center justify-center">
                <p className="text-surface-400">Cliente não encontrado</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col xl:flex-row gap-6 min-h-screen pb-10">
            {/* Sidebar Esquerda: Perfil e Dados Rápidos */}
            <aside className="xl:w-80 shrink-0 space-y-5">
                {/* Card de Perfil */}
                <div className="rounded-2xl border border-default bg-surface-0 p-5 shadow-sm text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 text-2xl font-bold shadow-inner">
                        {customer.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <h2 className="mt-4 text-xl font-bold text-surface-900 leading-tight">{customer.name}</h2>
                    {customer.trade_name && <p className="text-sm text-surface-500 mt-1">{customer.trade_name}</p>}

                    <div className="flex items-center justify-center gap-2 mt-4">
                        <Badge variant={customer.is_active ? 'success' : 'default'} size="sm">
                            {customer.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                        <Badge variant="brand" size="sm">{customer.rating ?? 'Sem Rating'}</Badge>
                    </div>

                    {/* Churn Risk Indicator */}
                    <div className="mt-4 p-3 rounded-xl bg-surface-50 border border-subtle">
                        <p className="text-[10px] uppercase font-bold text-surface-400 text-left">Risco de Perda (Churn)</p>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={cn(
                                "h-2 w-2 rounded-full",
                                metrics.churn_risk === 'crítico' ? 'bg-red-500 animate-pulse' :
                                    metrics.churn_risk === 'alto' ? 'bg-orange-500' :
                                        metrics.churn_risk === 'médio' ? 'bg-amber-500' : 'bg-emerald-500'
                            )} />
                            <span className="text-sm font-bold text-surface-800 capitalize">{metrics.churn_risk}</span>
                            <span className="text-[10px] text-surface-400 ml-auto">Último contato: {metrics.last_contact_days}d</span>
                        </div>
                    </div>

                    {/* Contract Status Indicator — GAP 12 */}
                    {customer.contract_type && (
                        <div className="mt-3 p-3 rounded-xl bg-surface-50 border border-subtle">
                            <p className="text-[10px] uppercase font-bold text-surface-400 text-left">Contrato</p>
                            <div className="flex items-center gap-2 mt-1">
                                <FileCheck className="h-4 w-4 text-brand-500" />
                                <span className="text-sm font-bold text-surface-800">{customer.contract_type}</span>
                                {(() => {
                                    if (!customer.contract_end) return <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-500">Sem vencimento</span>
                                    const endDate = new Date(customer.contract_end)
                                    const now = new Date()
                                    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                                    if (daysRemaining < 0) return <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold animate-pulse">Vencido há {Math.abs(daysRemaining)}d</span>
                                    if (daysRemaining <= 30) return <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">Vence em {daysRemaining}d</span>
                                    return <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">Ativo ({daysRemaining}d)</span>
                                })()}
                            </div>
                            {(customer.contract_start || customer.contract_end) && (
                                <p className="text-[10px] text-surface-400 mt-1">
                                    {customer.contract_start && `Início: ${new Date(customer.contract_start).toLocaleDateString('pt-BR')}`}
                                    {customer.contract_start && customer.contract_end && ' — '}
                                    {customer.contract_end && `Fim: ${new Date(customer.contract_end).toLocaleDateString('pt-BR')}`}
                                </p>
                            )}
                        </div>
                    )}
                    <div className="mt-6 flex flex-col gap-2">
                        <Button variant="primary" className="w-full" onClick={() => setActivityFormOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Nova Atividade
                        </Button>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-surface-0 border-default text-surface-600 font-bold hover:bg-surface-50"
                                onClick={handleExportPdf}
                            >
                                <Download className="h-4 w-4 mr-2 text-brand-500" />
                                Relatório 360º
                            </Button>
                            <div className="relative group">
                                <Button className="font-bold">Ações Rápidas</Button>
                                <div className="absolute right-0 top-full mt-1 w-48 bg-surface-0 border border-default rounded-xl shadow-xl z-50 py-1 hidden group-focus-within:block group-hover:block">
                                    {canCreateOs && <button className="w-full text-left px-4 py-2 text-sm hover:bg-surface-50" onClick={() => navigate(`/os/nova?customer_id=${customerId}`)}>Nova OS</button>}
                                    {canCreateChamado && <button className="w-full text-left px-4 py-2 text-sm hover:bg-surface-50" onClick={() => navigate(`/chamados/novo?customer_id=${customerId}`)}>Novo Chamado</button>}
                                    <button className="w-full text-left px-4 py-2 text-sm hover:bg-surface-50" onClick={() => navigate(`/orcamentos/novo?customer_id=${customerId}`)}>Novo Orçamento</button>
                                    <button className="w-full text-left px-4 py-2 text-sm hover:bg-surface-50" onClick={() => setSendMessageOpen(true)}>Enviar Mensagem</button>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSendMessageOpen(true)}>
                                <Mail className="h-4 w-4 mr-2" />
                                Mensagem
                            </Button>
                            {canEdit && (
                                <Button variant="outline" size="sm" onClick={() => navigate(`/cadastros/clientes?edit=${customerId}`)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Card de Contato */}
                <div className="rounded-2xl border border-default bg-surface-0 shadow-sm overflow-hidden">
                    <div className="bg-surface-50 px-5 py-3 border-b border-subtle">
                        <p className="text-xs font-bold text-surface-600 uppercase tracking-wider">Contato & Localização</p>
                    </div>
                    <div className="p-5 space-y-4">
                        <SidebarInfo icon={Phone} label="Telefone" value={customer.phone} />
                        <SidebarInfo icon={Mail} label="E-mail" value={customer.email} />
                        <SidebarInfo icon={Building2} label="Documento" value={customer.document} />
                        <SidebarInfo icon={MapPin} label="Endereço" value={`${customer.address_city}/${customer.address_state}`} />

                        {(customer.latitude && customer.longitude) && (
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${customer.latitude},${customer.longitude}`}
                                target="_blank"
                                className="mt-2 flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                            >
                                <Map className="h-4 w-4" />
                                Ver no Google Maps
                            </a>
                        )}
                    </div>
                </div>

                {/* Health Score Widget */}
                <CustomerHealthScore
                    score={customer.health_score ?? 0}
                    breakdown={healthBreakdown}
                />
            </aside>

            {/* Área Principal: Universo do Cliente (Abas) */}
            <main className="flex-1 min-w-0">
                <Tabs.Root defaultValue="overview" className="space-y-5">
                    <div className="sticky top-0 z-10 bg-surface-50/80 backdrop-blur-sm -mt-2 py-2 border-b border-subtle mb-4">
                        <div className="flex items-center gap-4 mb-2">
                            <Link to="/cadastros/clientes" className="p-1 hover:bg-surface-100 rounded-lg text-surface-400">
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                            {!isOnline && (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-100 rounded-full text-[10px] font-bold text-amber-700 uppercase">
                                    <WifiOff className="h-3 w-3" />
                                    Modo Offline (Cápsula)
                                </div>
                            )}
                            <Tabs.List className="flex gap-1 overflow-x-auto no-scrollbar">
                                {[
                                    { value: 'overview', label: 'Visão Geral', icon: TrendingUp },
                                    { value: 'serviços', label: 'Serviços', icon: ClipboardList },
                                    { value: 'equipamentos', label: 'Equipamentos', icon: Scale },
                                    { value: 'comercial', label: 'Comercial', icon: Target },
                                    canViewFinance && { value: 'financeiro', label: 'Financeiro', icon: DollarSign },
                                    { value: 'crm', label: 'Timeline', icon: History },
                                    { value: 'documents', label: 'Documentos', icon: FileText },
                                    { value: 'inmetro', label: 'INMETRO', icon: ShieldCheck },
                                    { value: 'dados', label: 'Dados', icon: FileText },
                                ].filter(Boolean).map((tab: any) => (
                                    <Tabs.Trigger
                                        key={tab.value}
                                        value={tab.value}
                                        className="group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-surface-500 whitespace-nowrap transition-all data-[state=active]:text-brand-600 rounded-lg hover:bg-surface-0 dark:hover:bg-surface-800 data-[state=active]:bg-surface-0 dark:data-[state=active]:bg-surface-800 data-[state=active]:shadow-sm"
                                    >
                                        <tab.icon className="h-4 w-4" />
                                        {tab.label}
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 scale-x-0 group-data-[state=active]:scale-x-100 transition-transform origin-center rounded-full" />
                                    </Tabs.Trigger>
                                ))}
                            </Tabs.List>
                        </div>
                    </div>

                    {/* Tab 1: Visão Geral (Dashboard) */}
                    <Tabs.Content value="overview" className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                            <StatCard icon={ClipboardList} label="OS em Aberto" value={workOrders.filter((w: any) => w.status !== 'Concluído').length} color="blue" />
                            <StatCard icon={AlertCircle} label="Chamados Críticos" value={serviceCalls.filter((s: any) => s.priority === 'crítica').length} color="red" />
                            <StatCard icon={FileSearch} label="Equipamentos Vencendo" value={equipments.filter((e: any) => e.calibration_status === 'vencendo').length} color="amber" />
                            {canViewFinance ? (
                                <StatCard icon={DollarSign} label="LTV Total" value={fmtBRL(metrics.ltv)} color="emerald" />
                            ) : (
                                <StatCard icon={Activity} label="Conversão" value={`${metrics.conversion_rate}%`} color="emerald" />
                            )}
                        </div>

                        {/* Charts Area */}
                        <div className="grid gap-5 lg:grid-cols-2">
                            {/* Projeção de Calibrações */}
                            <div className="rounded-2xl border border-default bg-surface-0 p-5 shadow-sm">
                                <h3 className="text-sm font-bold text-surface-900 mb-4 flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4 text-blue-500" />
                                    Projeção de Calibrações (6 Meses)
                                </h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={metrics.forecast}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                            <Tooltip
                                                cursor={{ fill: '#F3F4F6' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            />
                                            <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={32} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Tendência de Erro (Equipamento Main) */}
                            <div className="rounded-2xl border border-default bg-surface-0 p-5 shadow-sm">
                                <h3 className="text-sm font-bold text-surface-900 mb-4 flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                                    Tendência de Erro: {metrics.main_equipment_name || 'Equipamento'}
                                </h3>
                                <div className="h-64 w-full">
                                    {metrics.trend?.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={metrics.trend}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                />
                                                <Legend />
                                                <Line type="monotone" dataKey="error" name="Erro" stroke="#EF4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                                <Line type="monotone" dataKey="uncertainty" name="Incerteza" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-surface-400 italic text-sm">
                                            Dados de calibração insuficientes para gráfico de tendência.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-3">
                            {/* Radar de Saúde Holística */}
                            <div className="rounded-2xl border border-default bg-surface-0 p-5 shadow-sm">
                                <h3 className="text-sm font-bold text-surface-900 mb-4 flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-brand-500" />
                                    Análise Multidimensional
                                </h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={metrics.radar}>
                                            <PolarGrid stroke="#E5E7EB" />
                                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#6B7280' }} />
                                            <Radar
                                                name="Score"
                                                dataKey="value"
                                                stroke="#3B82F6"
                                                fill="#3B82F6"
                                                fillOpacity={0.5}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Últimas Ações / Timeline Reduzida */}
                            <div className="lg:col-span-2 rounded-2xl border border-default bg-surface-0 p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2">
                                        <History className="h-4 w-4 text-brand-500" />
                                        Atividades Recentes
                                    </h3>
                                    <button onClick={() => { const el = document.querySelector('[data-state][value="crm"]') as HTMLElement; el?.click() }} className="text-xs text-brand-600 font-semibold hover:underline">Ver todas</button>
                                </div>
                                <CustomerTimeline activities={timeline.slice(0, 5)} compact />
                            </div>

                            {/* Alertas Críticos de Financeiro */}
                            <div className="rounded-2xl border border-default bg-surface-0 p-5 shadow-sm space-y-4">
                                <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                    Alertas do Cliente
                                </h3>
                                <div className="space-y-3">
                                    {pendingReceivablesTotal > 0 && (
                                        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                                            <DollarSign className="h-5 w-5 text-red-600 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-bold text-red-800">Pendência Financeira</p>
                                                <p className="text-xs text-red-700">O cliente possui {fmtBRL(pendingReceivablesTotal)} em faturas vencidas ou pendentes.</p>
                                            </div>
                                        </div>
                                    )}
                                    {equipments.some((e: any) => e.calibration_status === 'vencida') && (
                                        <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                                            <Scale className="h-5 w-5 text-amber-600 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-bold text-amber-800">Equipamentos Fora de Prazo</p>
                                                <p className="text-xs text-amber-700">Existem equipamentos com calibração vencida. Risco de não-conformidade.</p>
                                            </div>
                                        </div>
                                    )}
                                    {workOrders.length === 0 && (
                                        <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                                            <Building2 className="h-5 w-5 text-blue-600 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-bold text-blue-800">Cliente Novo</p>
                                                <p className="text-xs text-blue-700">Este cliente ainda não possui ordens de serviço executadas.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Tabs.Content>

                    {/* Tab: Serviços (OS + Chamados) */}
                    <Tabs.Content value="serviços" className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                        <div className="rounded-2xl border border-default bg-surface-0 shadow-sm overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface-50/50">
                                <h3 className="text-sm font-bold text-surface-900">Ordens de Serviço</h3>
                                {canCreateOs && (
                                    <Button variant="primary" size="xs" onClick={() => navigate(`/os/nova?customer_id=${customerId}`)}>
                                        Nova OS
                                    </Button>
                                )}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-surface-50 text-surface-500 font-semibold border-b border-subtle">
                                            <th className="px-5 py-3 text-left">Número</th>
                                            <th className="px-5 py-3 text-left">Data</th>
                                            <th className="px-5 py-3 text-left">Status</th>
                                            {canViewPrices && <th className="px-5 py-3 text-right">Valor</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-subtle">
                                        {workOrders.length === 0 ? (
                                            <tr><td colSpan={canViewPrices ? 4 : 3} className="px-5 py-8 text-center text-surface-400 italic">Nenhuma OS registrada</td></tr>
                                        ) : workOrders.map((wo: any) => (
                                            <tr key={wo.id} className="hover:bg-surface-50 group transition-colors cursor-pointer" onClick={() => navigate(`/os/${wo.id}`)}>
                                                <td className="px-5 py-3 font-bold text-brand-600">#{wo.number}</td>
                                                <td className="px-5 py-3 text-surface-600">{new Date(wo.created_at).toLocaleDateString()}</td>
                                                <td className="px-5 py-3">
                                                    <Badge variant={wo.status === 'Concluído' ? 'success' : 'info'}>{wo.status}</Badge>
                                                </td>
                                                {canViewPrices && (
                                                    <td className="px-5 py-3 text-right font-semibold text-surface-900">{fmtBRL(Number(wo.total))}</td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-default bg-surface-0 shadow-sm overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface-50/50">
                                <h3 className="text-sm font-bold text-surface-900">Chamados Técnicos</h3>
                                {canCreateChamado && (
                                    <Button variant="outline" size="xs" onClick={() => navigate(`/chamados/novo?customer_id=${customerId}`)}>
                                        Novo Chamado
                                    </Button>
                                )}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-surface-50 text-surface-500 font-semibold border-b border-subtle">
                                            <th className="px-5 py-3 text-left">Protocolo</th>
                                            <th className="px-5 py-3 text-left">Assunto</th>
                                            <th className="px-5 py-3 text-left">Prioridade</th>
                                            <th className="px-5 py-3 text-left">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-subtle">
                                        {serviceCalls.length === 0 ? (
                                            <tr><td colSpan={4} className="px-5 py-8 text-center text-surface-400 italic">Nenhum chamado aberto</td></tr>
                                        ) : serviceCalls.map((sc: any) => (
                                            <tr key={sc.id} className="hover:bg-surface-50 transition-colors cursor-pointer" onClick={() => navigate(`/chamados/${sc.id}`)}>
                                                <td className="px-5 py-3 font-mono text-xs font-bold text-brand-600">#{sc.call_number || sc.protocol}</td>
                                                <td className="px-5 py-3 text-surface-800 font-medium max-w-[200px] truncate" title={sc.observations || sc.subject}>
                                                    {sc.observations || sc.subject || '—'}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <Badge variant={sc.priority === 'urgent' ? 'danger' : sc.priority === 'high' ? 'warning' : 'default'}>
                                                        {serviceCallPriorityLabel[sc.priority] || sc.priority}
                                                    </Badge>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <Badge variant="outline">{serviceCallStatusLabel[sc.status] || sc.status}</Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </Tabs.Content>

                    {/* Tab: Comercial (Orçamentos) */}
                    <Tabs.Content value="comercial" className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                        <div className="rounded-2xl border border-default bg-surface-0 shadow-sm overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface-50/50">
                                <h3 className="text-sm font-bold text-surface-900">Orçamentos e Propostas</h3>
                                {(hasRole('super_admin') || hasPermission('quotes.quote.create')) && (
                                    <Button variant="outline" size="xs" onClick={() => navigate(`/orcamentos/novo?customer_id=${customerId}`)}>
                                        Novo Orçamento
                                    </Button>
                                )}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-surface-50 text-surface-500 font-semibold border-b border-subtle">
                                            <th className="px-5 py-3 text-left">Número</th>
                                            <th className="px-5 py-3 text-left">Data</th>
                                            <th className="px-5 py-3 text-left">Status</th>
                                            {canViewPrices && <th className="px-5 py-3 text-right">Valor</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-subtle">
                                        {quotes.length === 0 ? (
                                            <tr><td colSpan={canViewPrices ? 4 : 3} className="px-5 py-8 text-center text-surface-400 italic">Nenhum orçamento pendente</td></tr>
                                        ) : quotes.map((q: any) => (
                                            <tr key={q.id} className="hover:bg-surface-50 transition-colors cursor-pointer" onClick={() => navigate(`/orcamentos/${q.id}`)}>
                                                <td className="px-5 py-3 font-bold text-brand-600">#{q.quote_number}</td>
                                                <td className="px-5 py-3 text-surface-600">{new Date(q.created_at).toLocaleDateString()}</td>
                                                <td className="px-5 py-3">
                                                    <Badge variant={q.status === 'Aprovado' ? 'success' : q.status === 'Recusado' ? 'danger' : 'info'}>{q.status}</Badge>
                                                </td>
                                                {canViewPrices && (
                                                    <td className="px-5 py-3 text-right font-semibold text-surface-900">{fmtBRL(Number(q.total))}</td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </Tabs.Content>

                    {/* Tab: Equipamentos */}
                    <Tabs.Content value="equipamentos" className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                        <div className="rounded-2xl border border-default bg-surface-0 shadow-sm overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface-50/50">
                                <h3 className="text-sm font-bold text-surface-900">Parque de Equipamentos</h3>
                                <Button variant="primary" size="xs" onClick={() => navigate(`/equipamentos/novo?customer_id=${customerId}`)}>Adicionar Equipamento</Button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-surface-50 text-surface-500 font-semibold border-b border-subtle">
                                            <th className="px-5 py-3 text-left">Patrimônio</th>
                                            <th className="px-5 py-3 text-left">Equipamento</th>
                                            <th className="px-5 py-3 text-left">Próx. Calibração</th>
                                            <th className="px-5 py-3 text-center">QR Rastreio</th>
                                            <th className="px-5 py-3 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-subtle">
                                        {equipments.map((eq: any) => (
                                            <tr key={eq.id} className="hover:bg-surface-50 transition-colors">
                                                <td className="px-5 py-3 font-bold text-brand-600 truncate max-w-[120px]">{eq.code}</td>
                                                <td className="px-5 py-3">
                                                    <p className="font-semibold text-surface-900">{eq.brand} {eq.model}</p>
                                                    <p className="text-xs text-surface-400">{eq.category}</p>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <div className="flex flex-col">
                                                        <span className={cn(
                                                            "text-sm font-bold",
                                                            eq.calibration_status === 'vencida' ? 'text-red-600' : 'text-surface-700'
                                                        )}>
                                                            {eq.next_calibration_at ? new Date(eq.next_calibration_at).toLocaleDateString() : '—'}
                                                        </span>
                                                        <span className="text-[10px] uppercase text-surface-400">{eq.calibration_status}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 flex justify-center">
                                                    <div className="group relative cursor-pointer" onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(eq.tracking_url)}`, '_blank')}>
                                                        <img
                                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(eq.tracking_url)}`}
                                                            alt="QR Code"
                                                            className="h-10 w-10 border border-surface-200 rounded p-1 hover:border-brand-500 transition-colors"
                                                        />
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                                                            <div className="bg-surface-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap shadow-xl">
                                                                Clique para ampliar / imprimir
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <Button variant="ghost" size="xs" onClick={() => navigate(`/equipamentos/${eq.id}?tab=certificados`)}>Certificados</Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </Tabs.Content>

                    {/* Tab: Financeiro */}
                    <Tabs.Content value="financeiro" className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                        {/* Dashboard Financeiro Rápido */}
                        <div className="grid gap-5 md:grid-cols-3">
                            <div className="rounded-2xl border border-dotted border-brand-300 bg-brand-50/50 p-4">
                                <p className="text-xs text-brand-600 font-bold uppercase tracking-tight">Vencido/Pendente</p>
                                <p className="text-2xl font-black text-brand-900 mt-1">{fmtBRL(pendingReceivablesTotal)}</p>
                            </div>
                            <div className="rounded-2xl border border-default bg-surface-0 p-4">
                                <p className="text-xs text-surface-500 font-bold uppercase tracking-tight">Total Faturado (12m)</p>
                                <p className="text-2xl font-black text-surface-900 mt-1">{fmtBRL(workOrders.reduce((acc: number, wo: any) => acc + Number(wo.total), 0))}</p>
                            </div>
                            <div className="rounded-2xl border border-default bg-surface-0 p-4">
                                <p className="text-xs text-surface-500 font-bold uppercase tracking-tight">Ticket Médio</p>
                                <p className="text-2xl font-black text-surface-900 mt-1">{fmtBRL(workOrders.length > 0 ? (workOrders.reduce((acc: number, wo: any) => acc + Number(wo.total), 0) / workOrders.length) : 0)}</p>
                            </div>
                        </div>

                        {/* Parcelas / Faturas */}
                        <div className="rounded-2xl border border-default bg-surface-0 shadow-sm overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface-50/50">
                                <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2">
                                    <Receipt className="h-4 w-4 text-emerald-500" />
                                    Contas a Receber (Parcelas)
                                </h3>
                                <Button variant="outline" size="xs" onClick={() => navigate(`/financeiro/contas-receber/nova?customer_id=${customerId}`)}>Lançar Avulso</Button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-surface-50 text-surface-500 font-semibold border-b border-subtle">
                                            <th className="px-5 py-3 text-left">Vencimento</th>
                                            <th className="px-5 py-3 text-left">Descrição</th>
                                            <th className="px-5 py-3 text-left">Status</th>
                                            <th className="px-5 py-3 text-right">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-subtle">
                                        {receivables.length === 0 ? (
                                            <tr><td colSpan={4} className="px-5 py-8 text-center text-surface-400 italic">Nenhuma parcela financeira registrada para este cliente</td></tr>
                                        ) : receivables.map((r: any) => (
                                            <tr key={r.id} className="hover:bg-surface-50 transition-colors">
                                                <td className="px-5 py-3 font-semibold text-surface-700">{new Date(r.due_date).toLocaleDateString()}</td>
                                                <td className="px-5 py-3">
                                                    <p className="text-surface-900 font-medium">{r.description}</p>
                                                    {r.work_order && <p className="text-[10px] text-brand-600 font-bold">Ref: OS #{r.work_order.number}</p>}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <Badge variant={r.status === 'paid' ? 'success' : r.status === 'overdue' ? 'danger' : 'warning'}>{r.status}</Badge>
                                                </td>
                                                <td className="px-5 py-3 text-right font-bold text-surface-900">{fmtBRL(Number(r.amount))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Notas Fiscais */}
                        <div className="rounded-2xl border border-default bg-surface-0 shadow-sm overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface-50/50">
                                <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2">
                                    <FileCheck className="h-4 w-4 text-brand-500" />
                                    Notas Fiscais
                                </h3>
                            </div>
                            <div className="divide-y divide-subtle">
                                {fiscalNotes.length === 0 ? (
                                    <div className="p-10 text-center text-surface-400 italic">Nenhuma nota fiscal emitida</div>
                                ) : fiscalNotes.map((nf: any) => (
                                    <div key={nf.id} className="flex items-center justify-between p-4 hover:bg-surface-50">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-surface-100 text-surface-500">
                                                <Receipt className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-surface-900">Nota #{nf.number}</p>
                                                <p className="text-xs text-surface-400">Emitida em {new Date(nf.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-bold text-surface-900">{fmtBRL(Number(nf.total_value))}</span>
                                            <Button variant="ghost" size="xs" onClick={() => { if (nf.file_url) window.open(nf.file_url, '_blank'); else toast.info('Download não disponível para esta nota') }}><Download className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Tabs.Content>

                    {/* Outras Abas (Inmetro, Timeline CRM, Dados) */}
                    <Tabs.Content value="documents" className="mt-5 animate-in fade-in slide-in-from-bottom-2">
                        <div className="rounded-2xl border border-default bg-surface-0 p-6 shadow-sm">
                            <CustomerDocumentsTab customerId={customerId} />
                        </div>
                    </Tabs.Content>

                    <Tabs.Content value="crm" className="mt-5 animate-in fade-in slide-in-from-bottom-2">
                        <div className="rounded-2xl border border-default bg-surface-0 p-6 shadow-sm">
                            <h3 className="text-sm font-bold text-surface-900 mb-6 flex items-center gap-2">
                                <History className="h-5 w-5 text-brand-500" />
                                Timeline de Eventos e Atividades
                            </h3>
                            <CustomerTimeline activities={timeline} />
                        </div>
                    </Tabs.Content>

                    <Tabs.Content value="inmetro" className="mt-5 animate-in fade-in slide-in-from-bottom-2">
                        <div className="rounded-2xl border border-default bg-surface-0 p-6 shadow-sm">
                            <h3 className="text-sm font-bold text-surface-900 mb-6 flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                                Inteligência Inmetro
                            </h3>
                            <CustomerInmetroTab customerId={customerId} />
                        </div>
                    </Tabs.Content>

                    <Tabs.Content value="dados" className="mt-5 animate-in fade-in slide-in-from-bottom-2">
                        <div className="grid gap-5 md:grid-cols-2">
                            <div className="rounded-2xl border border-default bg-surface-0 p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-surface-900 mb-4">Informações de Contato</h3>
                                <div className="space-y-3">
                                    <DataField label="Razão Social" value={customer.name} />
                                    <DataField label="Nome Fantasia" value={customer.trade_name} />
                                    <DataField label="Documento" value={customer.document} />
                                    <DataField label="E-mail" value={customer.email} />
                                    <DataField label="Telefone Principal" value={customer.phone} />
                                    <DataField label="Telefone Secundário" value={customer.phone2} />
                                    <DataField label="Endereço" value={`${customer.address_street}, ${customer.address_number} - ${customer.address_neighborhood}, ${customer.address_city}/${customer.address_state}`} />
                                </div>
                            </div>
                            <div className="rounded-2xl border border-default bg-surface-0 p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-surface-900 mb-4">Informações de Perfil</h3>
                                <div className="space-y-3">
                                    <DataField label="Rating" value={customer.rating} />
                                    <DataField label="Segmento" value={customer.segment} />
                                    <DataField label="Vendedor Atribuído" value={customer.assigned_seller?.name} />
                                    <DataField label="Data de Cadastro" value={new Date(customer.created_at).toLocaleDateString()} />
                                    <DataField label="Último Contato" value={customer.last_contact_at ? new Date(customer.last_contact_at).toLocaleDateString() : 'Nunca'} />
                                    <DataField label="Observações" value={customer.notes} />
                                </div>
                            </div>
                        </div>

                        {/* Contatos Cadastrados — GAP 11 */}
                        {customer.contacts?.length > 0 && (
                            <div className="rounded-2xl border border-default bg-surface-0 p-6 shadow-sm mt-5">
                                <h3 className="text-sm font-bold text-surface-900 mb-4 flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-brand-500" />
                                    Contatos Cadastrados ({customer.contacts.length})
                                </h3>
                                <div className="grid gap-3 md:grid-cols-2">
                                    {customer.contacts.map((ct: any) => (
                                        <div key={ct.id} className="flex items-start gap-3 p-3 rounded-xl border border-subtle bg-surface-50/50">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 text-xs font-bold">
                                                {ct.name?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <div className="min-w-0 text-sm">
                                                <p className="font-semibold text-surface-900 flex items-center gap-2">
                                                    {ct.name}
                                                    {ct.is_primary && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 font-bold">Principal</span>}
                                                </p>
                                                {ct.role && <p className="text-surface-500 text-xs">{ct.role}</p>}
                                                {ct.phone && <p className="text-surface-500 text-xs mt-1">{ct.phone}</p>}
                                                {ct.email && <p className="text-surface-500 text-xs">{ct.email}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Tabs.Content>
                </Tabs.Root>
            </main>

            {/* Modais de Ação */}
            <ActivityForm open={activityFormOpen} onClose={() => setActivityFormOpen(false)} customerId={customerId} />
            <SendMessageModal open={sendMessageOpen} onClose={() => setSendMessageOpen(false)} customerId={customerId} customerName={customer.name} customerPhone={customer.phone} customerEmail={customer.email} />

            {/* Confirm Delete Note Dialog */}
            {confirmDeleteNoteId !== null && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-surface-0 rounded-xl shadow-xl p-6 max-w-sm mx-4 border border-default">
                        <h3 className="text-lg font-semibold text-surface-900 mb-2">Confirmar Exclusão</h3>
                        <p className="text-sm text-surface-600 mb-4">Tem certeza que deseja remover esta atividade?</p>
                        <div className="flex justify-end gap-2">
                            <button className="px-4 py-2 rounded-lg border border-default text-sm" onClick={() => setConfirmDeleteNoteId(null)}>Cancelar</button>
                            <button className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm" onClick={() => { deleteMutation.mutate(confirmDeleteNoteId); setConfirmDeleteNoteId(null) }}>Remover</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function SidebarInfo({ icon: Icon, label, value }: { icon: any, label: string, value?: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="rounded-lg bg-surface-100 p-2 text-surface-500">
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase font-bold text-surface-400 tracking-wider leading-none">{label}</p>
                <p className="text-sm font-semibold text-surface-800 break-words mt-1">{value || '—'}</p>
            </div>
        </div>
    )
}

function StatCard({ icon: Icon, label, value, color }: { icon: any, label: string, value: string | number, color: 'blue' | 'red' | 'amber' | 'emerald' }) {
    const colors = {
        blue: 'text-blue-600 bg-blue-50 border-blue-100',
        red: 'text-red-600 bg-red-50 border-red-100',
        amber: 'text-amber-600 bg-amber-50 border-amber-100',
        emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    }
    return (
        <div className={cn("rounded-2xl border p-4 shadow-sm", colors[color])}>
            <div className="flex items-center gap-3">
                <div className="rounded-xl bg-surface-0/50 dark:bg-surface-800/50 p-2">
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p>
                    <p className="text-xl font-black tabular-nums">{value}</p>
                </div>
            </div>
        </div>
    )
}

function DataField({ label, value }: { label: string, value?: string }) {
    return (
        <div className="flex flex-col border-b border-subtle pb-2 last:border-0 last:pb-0">
            <span className="text-[10px] uppercase font-bold text-surface-400 tracking-wider">{label}</span>
            <span className="text-sm font-semibold text-surface-800 mt-1">{value || '—'}</span>
        </div>
    )
}
