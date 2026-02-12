import { useState } from 'react'
import { ArrowLeft, Phone, Mail, MapPin, Scale, CheckCircle, XCircle, Wrench, Clock, RefreshCw, UserPlus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { useInmetroOwner, useEnrichOwner, useConvertToCustomer, useDeleteOwner, type InmetroInstrument, type InmetroLocation } from '@/hooks/useInmetro'
import { useAuthStore } from '@/stores/auth-store'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Modal } from '@/components/ui/Modal'
import { InmetroOwnerEditModal } from './InmetroOwnerEditModal'

const statusIcons: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    approved: { icon: CheckCircle, color: 'text-green-500', label: 'Aprovado' },
    rejected: { icon: XCircle, color: 'text-red-500', label: 'Reprovado' },
    repaired: { icon: Wrench, color: 'text-amber-500', label: 'Reparado' },
    unknown: { icon: Clock, color: 'text-surface-400', label: 'Desconhecido' },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
    urgent: { label: 'Urgente', color: 'bg-red-100 text-red-700 border-red-200' },
    high: { label: 'Alta', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    normal: { label: 'Normal', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    low: { label: 'Baixa', color: 'bg-surface-100 text-surface-600 border-surface-200' },
}

export function InmetroOwnerDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { hasPermission } = useAuthStore()
    const canEnrich = hasPermission('inmetro.intelligence.enrich')
    const canConvert = hasPermission('inmetro.intelligence.convert')

    const [activeTab, setActiveTab] = useState('locations')
    const [editModalOpen, setEditModalOpen] = useState(false)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [convertModalOpen, setConvertModalOpen] = useState(false)

    const { data: owner, isLoading } = useInmetroOwner(id ? parseInt(id) : null)
    const enrichMutation = useEnrichOwner()
    const convertMutation = useConvertToCustomer()
    const deleteOwnerMutation = useDeleteOwner()

    const handleEnrich = () => {
        if (!owner) return
        enrichMutation.mutate(owner.id, {
            onSuccess: () => toast.success('Contato enriquecido com sucesso'),
            onError: (err: any) => toast.error(err.response?.data?.error || 'Erro ao enriquecer'),
        })
    }

    const handleConvert = () => {
        if (!owner) return
        convertMutation.mutate(owner.id, {
            onSuccess: () => {
                toast.success('Convertido em cliente CRM!')
                setConvertModalOpen(false)
            },
            onError: (err: any) => {
                toast.error(err.response?.data?.error || 'Erro na conversão')
                setConvertModalOpen(false)
            },
        })
    }

    const handleDelete = () => {
        if (!owner) return
        deleteOwnerMutation.mutate(owner.id, {
            onSuccess: () => {
                toast.success('Proprietário excluído com sucesso')
                setDeleteModalOpen(false)
                navigate('/inmetro/leads')
            },
            onError: (err: any) => {
                toast.error(err.response?.data?.message || 'Erro ao excluir')
            },
        })
    }

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-surface-200 rounded-full" />
                    <div className="space-y-2">
                        <div className="h-6 w-48 bg-surface-200 rounded" />
                        <div className="h-4 w-32 bg-surface-100 rounded" />
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="space-y-4">
                        <div className="h-48 bg-surface-100 rounded-xl" />
                        <div className="h-32 bg-surface-100 rounded-xl" />
                    </div>
                    <div className="lg:col-span-2 h-64 bg-surface-100 rounded-xl" />
                </div>
            </div>
        )
    }

    if (!owner) {
        return (
            <div className="text-center py-16">
                <p className="text-surface-500">Proprietário não encontrado</p>
                <Link to="/inmetro/leads" className="text-brand-600 hover:underline text-sm mt-2 inline-block">
                    ← Voltar para leads
                </Link>
            </div>
        )
    }

    const allInstruments: InmetroInstrument[] = owner.locations?.flatMap((l: InmetroLocation) => l.instruments ?? []) ?? []

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link to="/inmetro/leads" className="p-2 hover:bg-surface-100 rounded-full transition-colors">
                        <ArrowLeft className="h-5 w-5 text-surface-500" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-surface-900 flex items-center gap-2">
                            {owner.name}
                            <Badge className={priorityConfig[owner.priority]?.color}>
                                {priorityConfig[owner.priority]?.label}
                            </Badge>
                        </h1>
                        <p className="text-sm text-surface-500">
                            {owner.document} • {owner.type}
                            {owner.trade_name && ` • ${owner.trade_name}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {canConvert && (
                        <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                        </Button>
                    )}
                    {canConvert && (
                        <Button variant="danger" size="sm" onClick={() => setDeleteModalOpen(true)}>
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
                        </Button>
                    )}
                    {canEnrich && (
                        <Button variant="outline" size="sm" onClick={handleEnrich} disabled={enrichMutation.isPending}>
                            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${enrichMutation.isPending ? 'animate-spin' : ''}`} />
                            Enriquecer
                        </Button>
                    )}
                    {canConvert && !owner.converted_to_customer_id && (
                        <Button size="sm" onClick={() => setConvertModalOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
                            <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Converter
                        </Button>
                    )}
                    {owner.converted_to_customer_id && (
                        <Link to={`/customers/${owner.converted_to_customer_id}`}>
                            <Badge className="bg-green-100 text-green-700 border-green-200 px-3 py-1.5 hover:bg-green-200 transition-colors cursor-pointer">
                                <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Cliente CRM
                            </Badge>
                        </Link>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Contact Info */}
                <div className="space-y-6 lg:col-span-1">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Dados do Contato</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <ContactRow icon={Phone} label="Telefone Principal" value={owner.phone} />
                            <ContactRow icon={Phone} label="Telefone Secundário" value={owner.phone2} />
                            <ContactRow icon={Mail} label="E-mail" value={owner.email} />
                            {owner.contact_source && (
                                <div className="text-xs text-surface-400 pt-2 border-t border-subtle">
                                    Fonte: {owner.contact_source}
                                    {owner.contact_enriched_at && ` • Enriquecido em ${new Date(owner.contact_enriched_at).toLocaleDateString('pt-BR')}`}
                                </div>
                            )}
                            {owner.notes && (
                                <>
                                    <div className="border-t border-subtle" />
                                    <div className="space-y-1.5">
                                        <p className="font-medium text-sm text-surface-700">Observações</p>
                                        <p className="text-sm text-surface-600 whitespace-pre-wrap">{owner.notes}</p>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Resumo</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-3">
                                <StatBox label="Localizações" value={owner.locations?.length ?? 0} />
                                <StatBox label="Instrumentos" value={allInstruments.length} />
                                <StatBox
                                    label="Vencidos"
                                    value={allInstruments.filter(i => i.next_verification_at && new Date(i.next_verification_at) < new Date()).length}
                                    color="text-red-600"
                                />
                                <StatBox
                                    label="Em dia"
                                    value={allInstruments.filter(i => i.current_status === 'approved').length}
                                    color="text-green-600"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Tabs */}
                <div className="lg:col-span-2">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="locations">
                                <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Localizações ({owner.locations?.length ?? 0})</span>
                            </TabsTrigger>
                            <TabsTrigger value="instruments">
                                <span className="inline-flex items-center gap-1.5"><Scale className="h-3.5 w-3.5" /> Instrumentos ({allInstruments.length})</span>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="locations" className="mt-4 space-y-3">
                            {(!owner.locations || owner.locations.length === 0) ? (
                                <div className="text-center py-8 text-surface-400 text-sm">
                                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    Nenhuma localização registrada
                                </div>
                            ) : (
                                owner.locations.map((loc: InmetroLocation) => (
                                    <Card key={loc.id}>
                                        <CardContent className="py-4">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-medium text-surface-800">
                                                        {loc.address_city}/{loc.address_state}
                                                    </p>
                                                    {loc.farm_name && <p className="text-xs text-surface-500">{loc.farm_name}</p>}
                                                    {loc.state_registration && (
                                                        <p className="text-xs text-surface-500 font-mono">IE: {loc.state_registration}</p>
                                                    )}
                                                </div>
                                                <Badge>
                                                    {loc.instruments?.length ?? 0} instrumento(s)
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </TabsContent>

                        <TabsContent value="instruments" className="mt-4">
                            {allInstruments.length === 0 ? (
                                <div className="text-center py-8 text-surface-400 text-sm">
                                    <Scale className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    Nenhum instrumento registrado
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-default bg-surface-0">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-default bg-surface-50">
                                                <th className="px-3 py-2.5 text-left font-medium text-surface-600">Nº INMETRO</th>
                                                <th className="px-3 py-2.5 text-left font-medium text-surface-600">Marca/Modelo</th>
                                                <th className="px-3 py-2.5 text-left font-medium text-surface-600">Capacidade</th>
                                                <th className="px-3 py-2.5 text-left font-medium text-surface-600">Status</th>
                                                <th className="px-3 py-2.5 text-left font-medium text-surface-600">Última Verif.</th>
                                                <th className="px-3 py-2.5 text-left font-medium text-surface-600">Próxima</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {allInstruments.map((inst) => {
                                                const si = statusIcons[inst.current_status] || statusIcons.unknown
                                                const StatusIcon = si.icon
                                                const isOverdue = inst.next_verification_at && new Date(inst.next_verification_at) < new Date()
                                                return (
                                                    <tr key={inst.id} className="border-b border-subtle hover:bg-surface-25">
                                                        <td className="px-3 py-2.5 font-mono text-xs">{inst.inmetro_number}</td>
                                                        <td className="px-3 py-2.5 text-surface-700">
                                                            {inst.brand || '—'} {inst.model && `/ ${inst.model}`}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-surface-600 text-xs">{inst.capacity || '—'}</td>
                                                        <td className="px-3 py-2.5">
                                                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${si.color}`}>
                                                                <StatusIcon className="h-3.5 w-3.5" /> {si.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-xs text-surface-600">
                                                            {inst.last_verification_at ? new Date(inst.last_verification_at).toLocaleDateString('pt-BR') : '—'}
                                                        </td>
                                                        <td className={`px-3 py-2.5 text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-surface-600'}`}>
                                                            {inst.next_verification_at ? new Date(inst.next_verification_at).toLocaleDateString('pt-BR') : '—'}
                                                            {isOverdue && ' ⚠️'}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Edit Modal */}
            <InmetroOwnerEditModal
                open={editModalOpen}
                onOpenChange={setEditModalOpen}
                owner={owner}
            />

            {/* Delete Confirmation */}
            <Modal
                open={deleteModalOpen}
                onOpenChange={setDeleteModalOpen}
                title="Excluir Proprietário"
                description={`Tem certeza que deseja excluir ${owner.name}? Todos os instrumentos e localizações associados serão removidos.`}
                size="sm"
            >
                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        onClick={() => setDeleteModalOpen(false)}
                        className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={deleteOwnerMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                        {deleteOwnerMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Excluir
                    </button>
                </div>
            </Modal>

            {/* Convert Confirmation */}
            <Modal
                open={convertModalOpen}
                onOpenChange={setConvertModalOpen}
                title="Converter em Cliente CRM"
                description={`Deseja converter ${owner.name} em um cliente CRM?`}
                size="sm"
            >
                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        onClick={() => setConvertModalOpen(false)}
                        className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConvert}
                        disabled={convertMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                        {convertMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Confirmar Conversão
                    </button>
                </div>
            </Modal>
        </div>
    )
}

function ContactRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
    return (
        <div className="flex items-center gap-3 text-sm">
            <Icon className="h-4 w-4 text-surface-400 shrink-0" />
            <div>
                <p className="font-medium text-surface-700">{label}</p>
                <p className="text-surface-600">{value || '—'}</p>
            </div>
        </div>
    )
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
    return (
        <div className="rounded-lg border border-default bg-surface-50 p-3 text-center">
            <p className={`text-xl font-bold ${color || 'text-surface-800'}`}>{value}</p>
            <p className="text-xs text-surface-500 mt-0.5">{label}</p>
        </div>
    )
}

export default InmetroOwnerDetailPage
