// Shared utilities for commission module

export const fmtBRL = (v: number | string) =>
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR')

export const roleLabels: Record<string, string> = {
    tecnico: 'Técnico',
    vendedor: 'Vendedor',
    motorista: 'Motorista',
}

export const settlementStatusLabel = (s: string) => {
    const map: Record<string, string> = {
        open: 'Aberto',
        closed: 'Fechado',
        approved: 'Aprovado',
        rejected: 'Rejeitado',
        pending_approval: 'Aguard. Aprovação',
        paid: 'Pago',
    }
    return map[s] ?? s
}

export const settlementStatusVariant = (s: string) => {
    const map: Record<string, string> = {
        open: 'secondary',
        closed: 'default',
        approved: 'success',
        rejected: 'danger',
        pending_approval: 'warning',
        paid: 'success',
    }
    return (map[s] ?? 'secondary') as 'secondary' | 'default' | 'success' | 'danger' | 'warning'
}
