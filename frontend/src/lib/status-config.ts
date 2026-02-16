import {
    AlertCircle, Clock, Truck, ArrowRight, CheckCircle, XCircle,
    FileText, Pause, Package, ShieldCheck, Send, ThumbsUp, ThumbsDown,
    Timer, Ban, RotateCcw, Receipt, Hourglass, CircleDot, Play,
} from 'lucide-react'
import type { BadgeProps } from '@/components/ui/badge'

type BadgeVariant = NonNullable<BadgeProps['variant']>

interface StatusEntry {
    label: string
    variant: BadgeVariant
    icon: React.ComponentType<{ className?: string }>
}

export const workOrderStatus: Record<string, StatusEntry> = {
    open:              { label: 'Aberta',         variant: 'info',    icon: AlertCircle },
    in_progress:       { label: 'Em Andamento',   variant: 'warning', icon: Play },
    completed:         { label: 'Concluída',      variant: 'success', icon: CheckCircle },
    cancelled:         { label: 'Cancelada',      variant: 'danger',  icon: XCircle },
    invoiced:          { label: 'Faturada',       variant: 'brand',   icon: Receipt },
    waiting_parts:     { label: 'Aguard. Peças',  variant: 'warning', icon: Package },
    waiting_approval:  { label: 'Aguard. Aprov.', variant: 'warning', icon: Hourglass },
    delivered:         { label: 'Entregue',        variant: 'success', icon: ShieldCheck },
}

export const serviceCallStatus: Record<string, StatusEntry> = {
    open:        { label: 'Aberto',         variant: 'info',    icon: AlertCircle },
    scheduled:   { label: 'Agendado',       variant: 'warning', icon: Clock },
    in_transit:  { label: 'Em Trânsito',    variant: 'info',    icon: Truck },
    in_progress: { label: 'Em Atendimento', variant: 'warning', icon: ArrowRight },
    completed:   { label: 'Concluído',      variant: 'success', icon: CheckCircle },
    cancelled:   { label: 'Cancelado',      variant: 'danger',  icon: XCircle },
}

export const financialStatus: Record<string, StatusEntry> = {
    pending:   { label: 'Pendente',   variant: 'warning', icon: Clock },
    partial:   { label: 'Parcial',    variant: 'info',    icon: Pause },
    paid:      { label: 'Pago',       variant: 'success', icon: CheckCircle },
    overdue:   { label: 'Vencido',    variant: 'danger',  icon: AlertCircle },
    cancelled: { label: 'Cancelado',  variant: 'default', icon: XCircle },
}

export const quoteStatus: Record<string, StatusEntry> = {
    draft:                      { label: 'Rascunho',       variant: 'default', icon: FileText },
    pending_internal_approval:  { label: 'Aprov. Interna', variant: 'warning', icon: Hourglass },
    internally_approved:        { label: 'Aprovado Int.',  variant: 'info',    icon: ThumbsUp },
    sent:                       { label: 'Enviado',        variant: 'info',    icon: Send },
    approved:                   { label: 'Aprovado',       variant: 'success', icon: ThumbsUp },
    rejected:                   { label: 'Rejeitado',      variant: 'danger',  icon: ThumbsDown },
    expired:                    { label: 'Expirado',       variant: 'default', icon: Timer },
    invoiced:                   { label: 'Faturado',       variant: 'brand',   icon: Receipt },
}

export const commissionStatus: Record<string, StatusEntry> = {
    pending:  { label: 'Pendente',  variant: 'warning', icon: Clock },
    approved: { label: 'Aprovada',  variant: 'info',    icon: ThumbsUp },
    paid:     { label: 'Paga',      variant: 'success', icon: CheckCircle },
    reversed: { label: 'Estornada', variant: 'danger',  icon: RotateCcw },
    rejected: { label: 'Rejeitada', variant: 'danger',  icon: ThumbsDown },
    open:     { label: 'Aberta',    variant: 'info',    icon: CircleDot },
    accepted: { label: 'Aceita',    variant: 'success', icon: ThumbsUp },
    closed:   { label: 'Fechada',   variant: 'default', icon: Ban },
}

export const expenseStatus: Record<string, StatusEntry> = {
    pending:    { label: 'Pendente',    variant: 'warning', icon: Clock },
    reviewed:   { label: 'Revisada',    variant: 'info',    icon: FileText },
    approved:   { label: 'Aprovada',    variant: 'success', icon: ThumbsUp },
    rejected:   { label: 'Rejeitada',   variant: 'danger',  icon: ThumbsDown },
    reimbursed: { label: 'Reembolsada', variant: 'success', icon: CheckCircle },
}

export const equipmentStatus: Record<string, StatusEntry> = {
    ativo:          { label: 'Ativo',           variant: 'success', icon: CheckCircle },
    em_calibracao:  { label: 'Em Calibração',   variant: 'warning', icon: Clock },
    em_manutencao:  { label: 'Em Manutenção',   variant: 'warning', icon: Package },
    fora_de_uso:    { label: 'Fora de Uso',     variant: 'danger',  icon: XCircle },
    descartado:     { label: 'Descartado',      variant: 'default', icon: Ban },
}

export const priorityConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    low:    { label: 'Baixa',   variant: 'default' },
    normal: { label: 'Normal',  variant: 'info' },
    high:   { label: 'Alta',    variant: 'warning' },
    urgent: { label: 'Urgente', variant: 'danger' },
}

export function getStatusEntry(
    map: Record<string, StatusEntry>,
    status: string
): StatusEntry {
    return map[status] ?? { label: status, variant: 'default', icon: CircleDot }
}
