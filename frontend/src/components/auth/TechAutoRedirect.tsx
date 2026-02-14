import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'

const isMobileDevice = () => {
    if (typeof window === 'undefined') return false
    const ua = navigator.userAgent
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
        || (window.innerWidth <= 768 && 'ontouchstart' in window)
}

/**
 * Wraps the DashboardPage route. If authenticated user has role=tecnico
 * and is on a mobile device, auto-redirect to /tech.
 */
export function TechAutoRedirect({ children }: { children: React.ReactNode }) {
    const { user, hasRole } = useAuthStore()

    if (user && hasRole('tecnico') && isMobileDevice()) {
        return <Navigate to="/tech" replace />
    }

    return <>{children}</>
}
