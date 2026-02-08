import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import * as Tabs from '@radix-ui/react-tabs'
import {
    ArrowLeft, User, Phone, Mail, MapPin, Building2, Tag,
    Calendar, DollarSign, Scale, FileText, Plus, Clock,
    Loader2, Edit, Target, FileCheck, Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CustomerHealthScore } from '@/components/crm/CustomerHealthScore'
import { CustomerTimeline } from '@/components/crm/CustomerTimeline'
import { ActivityForm } from '@/components/crm/ActivityForm'
import { SendMessageModal } from '@/components/crm/SendMessageModal'
import { MessageHistory } from '@/components/crm/MessageHistory'
import { crmApi } from '@/lib/crm-api'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function Customer360Page() {
    const { id } = useParams()
    const customerId = Number(id)
    const [activityFormOpen, setActivityFormOpen] = useState(false)
    const [sendMessageOpen, setSendMessageOpen] = useState(false)

    const { data, isLoading } = useQuery({
        queryKey: ['customer-360', customerId],
        queryFn: () => crmApi.getCustomer360(customerId).then(r => r.data),
        enabled: !!customerId,
    })

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            </div>
        )
    }

    const customer = data?.customer
    const healthBreakdown = data?.health_breakdown ? Object.values(data.health_breakdown) as { score: number; max: number; label: string }[] : []
    const equipments = data?.equipments ?? []
    const deals = data?.deals ?? []
    const timeline = data?.timeline ?? []
    const workOrders = data?.work_orders ?? []
    const quotes = data?.quotes ?? []
    const pendingReceivables = data?.pending_receivables ?? 0
    const documents = data?.documents ?? [] as any[]

    if (!customer) {
        return (
            <div className="flex h-full items-center justify-center">
                <p className="text-surface-400">Cliente não encontrado</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/crm" className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700 text-lg font-bold">
                            {customer.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-surface-900">{customer.name}</h1>
                            <div className="flex items-center gap-3 mt-1 text-xs text-surface-400">
                                {customer.type && <Badge variant="default">{customer.type === 'pj' ? 'PJ' : 'PF'}</Badge>}
                                {customer.segment && <span className="capitalize">{customer.segment}</span>}
                                {customer.rating && <Badge variant="brand">{customer.rating}</Badge>}
                                {customer.assigned_seller?.name && (
                                    <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" /> {customer.assigned_seller.name}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setSendMessageOpen(true)}>
                        <Mail className="h-4 w-4 mr-1" />
                        Mensagem
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => setActivityFormOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Atividade
                    </Button>
                </div>
            </div>

            {/* Quick Info Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {customer.phone && (
                    <QuickInfo icon={Phone} label="Telefone" value={customer.phone} />
                )}
                {customer.email && (
                    <QuickInfo icon={Mail} label="E-mail" value={customer.email} />
                )}
                {customer.address_city && (
                    <QuickInfo icon={MapPin} label="Cidade" value={`${customer.address_city}/${customer.address_state}`} />
                )}
                {customer.document && (
                    <QuickInfo icon={Building2} label="Documento" value={customer.document} />
                )}
            </div>

            {/* Tabs */}
            <Tabs.Root defaultValue="overview">
                <Tabs.List className="flex border-b border-surface-200 gap-1">
                    {[
                        { value: 'overview', label: 'Visão Geral' },
                        { value: 'equipments', label: `Equipamentos (${equipments.length})` },
                        { value: 'deals', label: `Oportunidades (${deals.length})` },
                        { value: 'messages', label: 'Mensagens' },
                        { value: 'timeline', label: 'Timeline' },
                        { value: 'financial', label: 'Financeiro' },
                        { value: 'documents', label: `Documentos (${documents.length})` },
                        { value: 'data', label: 'Dados' },
                    ].map(tab => (
                        <Tabs.Trigger
                            key={tab.value}
                            value={tab.value}
                            className="px-4 py-2.5 text-sm font-medium text-surface-500 border-b-2 border-transparent transition-colors data-[state=active]:text-brand-600 data-[state=active]:border-brand-500 hover:text-surface-700"
                        >
                            {tab.label}
                        </Tabs.Trigger>
                    ))}
                </Tabs.List>

                {/* Tab: Overview */}
                <Tabs.Content value="overview" className="mt-5">
                    <div className="grid gap-5 lg:grid-cols-3">
                        <CustomerHealthScore
                            score={customer.health_score ?? 0}
                            breakdown={healthBreakdown}
                        />
                        <div className="lg:col-span-2">
                            <CustomerTimeline activities={timeline.slice(0, 10)} />
                        </div>
                    </div>
                </Tabs.Content>

                {/* Tab: Equipments */}
                <Tabs.Content value="equipments" className="mt-5">
                    <div className="rounded-xl border border-surface-200 bg-white shadow-card overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-surface-200 bg-surface-50">
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-500">Código</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-500">Equipamento</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-500">Categoria</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-500">Status</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-500">Próx. Calibração</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                                {equipments.length === 0 ? (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Nenhum equipamento</td></tr>
                                ) : equipments.map((eq: any) => {
                                    const nextCal = eq.next_calibration_at ? new Date(eq.next_calibration_at) : null
                                    const diff = nextCal ? Math.ceil((nextCal.getTime() - Date.now()) / 86400000) : null
                                    return (
                                        <tr key={eq.id} className="hover:bg-surface-50 transition-colors">
                                            <td className="px-4 py-2.5 font-mono text-xs font-bold text-brand-600">{eq.code}</td>
                                            <td className="px-4 py-2.5 text-surface-800">{eq.brand} {eq.model}</td>
                                            <td className="px-4 py-2.5 text-surface-500 capitalize">{eq.category}</td>
                                            <td className="px-4 py-2.5">
                                                <Badge variant={eq.status === 'active' ? 'success' : 'default'}>{eq.status}</Badge>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {nextCal ? (
                                                    <span className={cn('text-xs font-medium',
                                                        diff && diff < 0 ? 'text-red-600' : diff && diff < 30 ? 'text-amber-600' : 'text-surface-600'
                                                    )}>
                                                        {nextCal.toLocaleDateString('pt-BR')}
                                                        {diff !== null && ` (${diff < 0 ? `${Math.abs(diff)}d atrás` : `${diff}d`})`}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-surface-400">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </Tabs.Content>

                {/* Tab: Deals */}
                <Tabs.Content value="deals" className="mt-5">
                    <div className="space-y-3">
                        {deals.length === 0 ? (
                            <p className="text-center text-sm text-surface-400 py-8">Nenhuma oportunidade</p>
                        ) : deals.map((deal: any) => (
                            <div key={deal.id} className="rounded-lg border border-surface-200 bg-white p-4 shadow-card hover:shadow-elevated transition-shadow">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Target className="h-4 w-4 text-brand-500" />
                                        <div>
                                            <p className="text-sm font-semibold text-surface-800">{deal.title}</p>
                                            <p className="text-xs text-surface-400">{deal.pipeline?.name} → {deal.stage?.name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant={deal.status === 'won' ? 'success' : deal.status === 'lost' ? 'danger' : 'info'} dot>
                                            {deal.status === 'won' ? 'Ganho' : deal.status === 'lost' ? 'Perdido' : 'Aberto'}
                                        </Badge>
                                        <span className="text-sm font-bold text-surface-900">{fmtBRL(Number(deal.value))}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Tabs.Content>

                {/* Tab: Timeline */}
                <Tabs.Content value="timeline" className="mt-5">
                    <CustomerTimeline activities={timeline} />
                </Tabs.Content>

                {/* Tab: Financial */}
                <Tabs.Content value="financial" className="mt-5">
                    <div className="grid gap-5 lg:grid-cols-2">
                        {/* Work Orders */}
                        <div className="rounded-xl border border-surface-200 bg-white shadow-card">
                            <div className="border-b border-surface-200 px-5 py-3">
                                <h3 className="text-sm font-semibold text-surface-900">Últimas Ordens de Serviço</h3>
                            </div>
                            <div className="divide-y divide-surface-100">
                                {workOrders.length === 0 ? (
                                    <p className="px-5 py-6 text-center text-sm text-surface-400">Nenhuma OS</p>
                                ) : workOrders.map((wo: any) => (
                                    <div key={wo.id} className="flex items-center justify-between px-5 py-2.5">
                                        <div>
                                            <span className="text-sm font-bold text-brand-600">#{wo.number}</span>
                                            <p className="text-xs text-surface-400 mt-0.5">{new Date(wo.created_at).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={wo.status === 'completed' ? 'success' : wo.status === 'cancelled' ? 'danger' : 'info'}>
                                                {wo.status}
                                            </Badge>
                                            <span className="text-sm font-medium text-surface-800">{fmtBRL(Number(wo.total ?? 0))}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Quotes */}
                        <div className="rounded-xl border border-surface-200 bg-white shadow-card">
                            <div className="border-b border-surface-200 px-5 py-3">
                                <h3 className="text-sm font-semibold text-surface-900">Últimos Orçamentos</h3>
                            </div>
                            <div className="divide-y divide-surface-100">
                                {quotes.length === 0 ? (
                                    <p className="px-5 py-6 text-center text-sm text-surface-400">Nenhum orçamento</p>
                                ) : quotes.map((q: any) => (
                                    <div key={q.id} className="flex items-center justify-between px-5 py-2.5">
                                        <div>
                                            <span className="text-sm font-bold text-brand-600">#{q.quote_number}</span>
                                            <p className="text-xs text-surface-400 mt-0.5">{new Date(q.created_at).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={q.status === 'approved' ? 'success' : q.status === 'rejected' ? 'danger' : 'warning'}>
                                                {q.status}
                                            </Badge>
                                            <span className="text-sm font-medium text-surface-800">{fmtBRL(Number(q.total ?? 0))}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Receivables summary */}
                    {pendingReceivables > 0 && (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4 flex items-center gap-3">
                            <DollarSign className="h-5 w-5 text-amber-600" />
                            <div>
                                <p className="text-sm font-semibold text-surface-800">Pendências Financeiras</p>
                                <p className="text-xs text-amber-700">{fmtBRL(pendingReceivables)} em contas a receber pendentes/vencidas</p>
                            </div>
                        </div>
                    )}
                </Tabs.Content>

                {/* Tab: Data */}
                <Tabs.Content value="data" className="mt-5">
                    <div className="grid gap-5 lg:grid-cols-2">
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card space-y-3">
                            <h3 className="text-sm font-semibold text-surface-900 mb-3">Informações de Contato</h3>
                            <DataRow label="Nome" value={customer.name} />
                            <DataRow label="Documento" value={customer.document} />
                            <DataRow label="E-mail" value={customer.email} />
                            <DataRow label="Telefone" value={customer.phone} />
                            <DataRow label="Telefone 2" value={customer.phone2} />
                            <DataRow label="Endereço" value={
                                [customer.address_street, customer.address_number, customer.address_complement,
                                customer.address_neighborhood, customer.address_city, customer.address_state, customer.address_zip]
                                    .filter(Boolean).join(', ')
                            } />
                        </div>

                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card space-y-3">
                            <h3 className="text-sm font-semibold text-surface-900 mb-3">Informações CRM</h3>
                            <DataRow label="Origem" value={customer.source} />
                            <DataRow label="Segmento" value={customer.segment} />
                            <DataRow label="Porte" value={customer.company_size} />
                            <DataRow label="Receita Estimada" value={customer.annual_revenue_estimate ? fmtBRL(Number(customer.annual_revenue_estimate)) : undefined} />
                            <DataRow label="Tipo Contrato" value={customer.contract_type} />
                            <DataRow label="Contrato Início" value={customer.contract_start} />
                            <DataRow label="Contrato Fim" value={customer.contract_end} />
                            <DataRow label="Rating" value={customer.rating} />
                            <DataRow label="Tags" value={customer.tags?.join(', ')} />
                            <DataRow label="Último Contato" value={customer.last_contact_at ? new Date(customer.last_contact_at).toLocaleDateString('pt-BR') : undefined} />
                            <DataRow label="Próximo Follow-up" value={customer.next_follow_up_at ? new Date(customer.next_follow_up_at).toLocaleDateString('pt-BR') : undefined} />
                            <DataRow label="Observações" value={customer.notes} />
                        </div>
                    </div>
                </Tabs.Content>

                {/* Tab: Messages */}
                <Tabs.Content value="messages" className="mt-5">
                    <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-surface-900">Histórico de Conversas</h3>
                            <Button variant="primary" size="sm" onClick={() => setSendMessageOpen(true)}>
                                <Mail className="h-4 w-4 mr-1" />
                                Nova Mensagem
                            </Button>
                        </div>
                        <MessageHistory customerId={customerId} />
                    </div>
                </Tabs.Content>

                {/* Tab: Documentos */}
                <Tabs.Content value="documents" className="mt-5">
                    <div className="rounded-xl border border-surface-200 bg-white shadow-card">
                        <div className="flex items-center justify-between border-b border-surface-200 px-5 py-3">
                            <h3 className="text-sm font-semibold text-surface-900">Documentos & Certificados</h3>
                        </div>
                        {documents.length === 0 ? (
                            <p className="py-10 text-center text-sm text-surface-400">Nenhum documento encontrado</p>
                        ) : (
                            <div className="divide-y divide-surface-100">
                                {documents.map((doc: any) => {
                                    const isExpired = doc.expires_at && new Date(doc.expires_at) < new Date()
                                    const typeLabels: Record<string, string> = {
                                        certificado: 'Certificado',
                                        laudo: 'Laudo',
                                        contrato: 'Contrato',
                                        manual: 'Manual',
                                        foto: 'Foto',
                                        outro: 'Outro',
                                    }
                                    return (
                                        <div key={doc.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-50 transition-colors">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={cn('rounded-lg p-2', isExpired ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600')}>
                                                    <FileCheck className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-surface-800 truncate">{doc.name}</p>
                                                    <div className="flex items-center gap-2 text-xs text-surface-400">
                                                        <span>{typeLabels[doc.type] ?? doc.type}</span>
                                                        {doc.equipment && (
                                                            <>
                                                                <span>•</span>
                                                                <span>{doc.equipment.code} — {doc.equipment.brand} {doc.equipment.model}</span>
                                                            </>
                                                        )}
                                                        {doc.expires_at && (
                                                            <>
                                                                <span>•</span>
                                                                <span className={isExpired ? 'text-red-500 font-medium' : ''}>
                                                                    {isExpired ? 'Vencido' : 'Válido até'} {new Date(doc.expires_at).toLocaleDateString('pt-BR')}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {doc.file_path && (
                                                <a
                                                    href={doc.file_path}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 transition-colors"
                                                >
                                                    <Download className="h-3.5 w-3.5" />
                                                    Baixar
                                                </a>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </Tabs.Content>
            </Tabs.Root>

            {/* Activity Form Modal */}
            <ActivityForm
                open={activityFormOpen}
                onClose={() => setActivityFormOpen(false)}
                customerId={customerId}
            />

            {/* Send Message Modal */}
            <SendMessageModal
                open={sendMessageOpen}
                onClose={() => setSendMessageOpen(false)}
                customerId={customerId}
                customerName={customer.name}
                customerPhone={customer.phone}
                customerEmail={customer.email}
            />
        </div>
    )
}

function QuickInfo({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
    return (
        <div className="rounded-lg border border-surface-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-surface-400" />
                <div className="min-w-0">
                    <p className="text-[10px] text-surface-400 uppercase">{label}</p>
                    <p className="text-sm font-medium text-surface-800 truncate">{value}</p>
                </div>
            </div>
        </div>
    )
}

function DataRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex items-baseline gap-3">
            <span className="text-xs text-surface-500 w-32 shrink-0">{label}</span>
            <span className="text-sm text-surface-800">{value || '—'}</span>
        </div>
    )
}
