import { useAuthStore } from '@/stores/auth-store'

/**
 * GAP-08: Gate de preços — técnico puro NÃO vê preços.
 * Roles com acesso a preços: tecnico_vendedor, vendedor, gerente, admin, super_admin, financeiro, atendente.
 */
export function usePriceGate(): { canViewPrices: boolean } {
    const { hasRole } = useAuthStore()

    const canViewPrices =
        hasRole('tecnico_vendedor') ||
        hasRole('vendedor') ||
        hasRole('gerente') ||
        hasRole('admin') ||
        hasRole('super_admin') ||
        hasRole('financeiro') ||
        hasRole('atendente')

    return { canViewPrices }
}
