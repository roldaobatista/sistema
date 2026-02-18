import { useQuery } from '@tanstack/react-query'
import { X, FileText, Clock, CheckCircle2, Copy, ExternalLink, WifiOff } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'

interface FiscalNote {
    id: number
    type: 'nfe' | 'nfse'
    number: string | null
    series: string | null
    access_key: string | null
    reference: string | null
    status: string
    provider: string
    total_amount: string
    contingency_mode: boolean
    verification_code: string | null
    nature_of_operation: string | null
    cfop: string | null
    environment: string | null
    protocol_number: string | null
    issued_at: string | null
    cancelled_at: string | null
    cancel_reason: string | null
    error_message: string | null
    customer?: { id: number; name: string; email?: string }
    work_order?: { id: number; number: string } | null
    quote?: { id: number; number: string } | null
    creator?: { id: number; name: string }
    created_at: string
}

interface Props {
    note: FiscalNote
    onClose: () => void
}

export default function FiscalDetailPanel({ note, onClose }: Props) {
    const { data: events } = useQuery({
        queryKey: ['fiscal-events', note.id],
        queryFn: async () => {
            const { data } = await api.get(`/fiscal/notas/${note.id}/events`)
            return data.data ?? []
        },
    })

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        toast.success(`${label} copiado`)
    }

    const isNFe = note.type === 'nfe'
    const typeLabel = isNFe ? 'NF-e' : 'NFS-e'
    const typeColor = isNFe ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-card w-full max-w-lg h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right">

                {/* Header */}
                <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isNFe ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-teal-50 dark:bg-teal-900/20'}`}>
                            <FileText className={`w-5 h-5 ${isNFe ? 'text-blue-600 dark:text-blue-400' : 'text-teal-600 dark:text-teal-400'}`} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">{typeLabel} #{note.number || '—'}</h2>
                            <p className="text-xs text-surface-400">ID: {note.id}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-md hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors" aria-label="Fechar">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-6">
                    {/* Status */}
                    <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${typeColor}`}>{typeLabel}</span>
                        <StatusBadge status={note.status} />
                        {note.contingency_mode && (
                            <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400">
                                <WifiOff className="w-3 h-3" /> Contingência
                            </span>
                        )}
                    </div>

                    {/* Main Info */}
                    <Section title="Informações Gerais">
                        <InfoRow label="Número" value={note.number || '—'} />
                        <InfoRow label="Série" value={note.series || '—'} />
                        <InfoRow label="Valor Total" value={Number(note.total_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                        {note.nature_of_operation && <InfoRow label="Natureza" value={note.nature_of_operation} />}
                        {note.cfop && <InfoRow label="CFOP" value={note.cfop} />}
                        <InfoRow label="Ambiente" value={note.environment === 'production' ? 'Produção' : 'Homologação'} />
                        <InfoRow label="Provider" value={note.provider} />
                    </Section>

                    {/* Access Key / Verification */}
                    {(note.access_key || note.verification_code) && (
                        <Section title={isNFe ? 'Chave de Acesso' : 'Verificação'}>
                            {note.access_key && (
                                <div className="flex items-center gap-2">
                                    <code className="text-xs font-mono bg-surface-100 dark:bg-surface-800 px-2 py-1 rounded break-all flex-1">
                                        {note.access_key}
                                    </code>
                                    <button
                                        onClick={() => copyToClipboard(note.access_key!, 'Chave de acesso')}
                                        className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-400 hover:text-brand-600 transition-colors shrink-0"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            {note.verification_code && (
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-sm text-surface-500">Código:</span>
                                    <code className="text-sm font-mono">{note.verification_code}</code>
                                    <button
                                        onClick={() => copyToClipboard(note.verification_code!, 'Código de verificação')}
                                        className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-400 hover:text-brand-600 transition-colors"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                            {note.protocol_number && <InfoRow label="Protocolo" value={note.protocol_number} />}
                        </Section>
                    )}

                    {/* Customer */}
                    <Section title="Cliente">
                        <InfoRow label="Nome" value={note.customer?.name || '—'} />
                        {note.customer?.email && <InfoRow label="E-mail" value={note.customer.email} />}
                    </Section>

                    {/* Linked Records */}
                    {(note.work_order || note.quote) && (
                        <Section title="Vínculos">
                            {note.work_order && <InfoRow label="Ordem de Serviço" value={`#${note.work_order.number}`} />}
                            {note.quote && <InfoRow label="Orçamento" value={`#${note.quote.number}`} />}
                        </Section>
                    )}

                    {/* Dates */}
                    <Section title="Datas">
                        <InfoRow label="Emissão" value={note.issued_at ? new Date(note.issued_at).toLocaleString('pt-BR') : '—'} />
                        <InfoRow label="Criação" value={new Date(note.created_at).toLocaleString('pt-BR')} />
                        {note.cancelled_at && (
                            <>
                                <InfoRow label="Cancelamento" value={new Date(note.cancelled_at).toLocaleString('pt-BR')} />
                                {note.cancel_reason && <InfoRow label="Motivo" value={note.cancel_reason} />}
                            </>
                        )}
                        {note.creator && <InfoRow label="Criado por" value={note.creator.name} />}
                    </Section>

                    {/* Error */}
                    {note.error_message && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                            <p className="text-sm font-medium text-red-700 dark:text-red-400">Erro</p>
                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{note.error_message}</p>
                        </div>
                    )}

                    {/* Events Timeline */}
                    {events && events.length > 0 && (
                        <Section title="Histórico de Eventos">
                            <div className="space-y-3">
                                {events.map((event: any) => (
                                    <div key={event.id} className="flex gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-2 h-2 rounded-full mt-2 ${event.status === 'authorized' ? 'bg-emerald-500' : 'bg-red-500'
                                                }`} />
                                            <div className="w-px h-full bg-surface-200 dark:bg-surface-700" />
                                        </div>
                                        <div className="pb-3 flex-1 min-w-0">
                                            <p className="text-sm font-medium">{event.description}</p>
                                            <p className="text-xs text-surface-400 mt-0.5">
                                                {new Date(event.created_at).toLocaleString('pt-BR')}
                                                {event.user?.name && ` • ${event.user.name}`}
                                            </p>
                                            {event.error_message && (
                                                <p className="text-xs text-red-500 mt-1">{event.error_message}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}
                </div>
            </div>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-2">{title}</h3>
            <div className="space-y-1.5">{children}</div>
        </div>
    )
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-surface-500 shrink-0">{label}</span>
            <span className="text-sm font-medium text-right">{value}</span>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; color: string }> = {
        pending: { label: 'Pendente', color: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400' },
        processing: { label: 'Processando', color: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400' },
        authorized: { label: 'Autorizada', color: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400' },
        cancelled: { label: 'Cancelada', color: 'bg-surface-50 text-surface-500 border-surface-200 dark:bg-surface-800 dark:text-surface-400' },
        rejected: { label: 'Rejeitada', color: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400' },
    }
    const cfg = config[status] ?? config.pending
    return <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${cfg.color}`}>{cfg.label}</span>
}
