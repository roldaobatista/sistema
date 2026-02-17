import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { useAppMode, MODE_STORAGE_KEY } from '@/hooks/useAppMode'

const FIELD_ONLY_ROLES = new Set(['tecnico', 'tecnico_vendedor', 'motorista'])
const MANAGEMENT_ROLES = new Set([
    'super_admin', 'admin', 'gerente', 'coordenador',
    'financeiro', 'comercial', 'atendimento', 'rh',
    'estoquista', 'qualidade', 'vendedor', 'monitor', 'visualizador',
])
const VENDEDOR_ROLES = new Set(['comercial', 'vendedor', 'tecnico_vendedor'])

/**
 * Redireciona para o modo correto: único modo vai direto; multi-role respeita último modo (localStorage).
 */
export function TechAutoRedirect({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore()
    const { availableModes } = useAppMode()

    if (!user) return <>{children}</>

    const roles = user.roles ?? user.all_roles ?? []
    const hasManagementRole = roles.some((r) => MANAGEMENT_ROLES.has(r))
    const hasFieldRole = roles.some((r) => FIELD_ONLY_ROLES.has(r))
    const hasVendedorRole = roles.some((r) => VENDEDOR_ROLES.has(r))

    if (availableModes.length === 1) {
        if (availableModes[0] === 'tecnico') return <Navigate to="/tech" replace />
        if (availableModes[0] === 'vendedor') return <Navigate to="/crm" replace />
        return <>{children}</>
    }

    let lastMode: string | null = null
    try {
        lastMode = localStorage.getItem(MODE_STORAGE_KEY)
    } catch {
        // ignore
    }

    if (lastMode === 'tecnico' && availableModes.includes('tecnico')) {
        return <Navigate to="/tech" replace />
    }
    if (lastMode === 'vendedor' && availableModes.includes('vendedor')) {
        return <Navigate to="/crm" replace />
    }

    if (hasFieldRole && !hasManagementRole && !hasVendedorRole) {
        return <Navigate to="/tech" replace />
    }

    return <>{children}</>
}
