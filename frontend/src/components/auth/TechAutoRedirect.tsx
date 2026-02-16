import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'

const isMobileDevice = () => {
    if (typeof window === 'undefined') return false
    const ua = navigator.userAgent
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
        || (window.innerWidth <= 768 && 'ontouchstart' in window)
}

const FIELD_ONLY_ROLES = new Set(['tecnico', 'tecnico_vendedor', 'motorista'])
const MANAGEMENT_ROLES = new Set([
    'super_admin', 'admin', 'gerente', 'coordenador',
    'financeiro', 'comercial', 'atendimento', 'rh',
    'estoquista', 'qualidade', 'vendedor', 'monitor', 'visualizador',
])

/**
 * Wraps the DashboardPage route. If authenticated user ONLY has
 * field-level roles (tecnico, tecnico_vendedor, motorista) and is
 * on a mobile device, auto-redirect to /tech.
 * Users with any management/admin role always see the full dashboard.
 */
export function TechAutoRedirect({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore()

    if (user && isMobileDevice()) {
        const roles = user.roles ?? user.all_roles ?? []
        const hasManagementRole = roles.some(r => MANAGEMENT_ROLES.has(r))
        const hasFieldRole = roles.some(r => FIELD_ONLY_ROLES.has(r))

        if (hasFieldRole && !hasManagementRole) {
            return <Navigate to="/tech" replace />
        }
    }

    return <>{children}</>
}
