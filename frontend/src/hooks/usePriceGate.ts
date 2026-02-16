import { useAuthStore } from '@/stores/auth-store'

/**
 * GAP-08: Gate de preços — técnico puro e motorista NÃO veem preços.
 * Conforme Matriz de Visibilidade do ALINHAMENTO_02:
 * - VÊ preços: super_admin, admin, gerente, coordenador, financeiro, comercial, vendedor, tecnico_vendedor, atendimento
 * - NÃO vê: tecnico (puro), motorista, monitor, visualizador, estoquista, rh, qualidade
 */
const ROLES_WITH_PRICE_ACCESS = [
    'super_admin', 'admin', 'gerente', 'coordenador',
    'financeiro', 'comercial', 'vendedor', 'tecnico_vendedor',
    'atendimento',
] as const

export function usePriceGate(): { canViewPrices: boolean } {
    const { hasRole } = useAuthStore()

    const canViewPrices = ROLES_WITH_PRICE_ACCESS.some(role => hasRole(role))

    return { canViewPrices }
}
