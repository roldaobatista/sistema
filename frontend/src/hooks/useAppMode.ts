import { useState, useMemo, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'

const MODE_STORAGE_KEY = 'kalibrium-mode'

export type AppMode = 'gestao' | 'tecnico' | 'vendedor'

const GESTAO_ROLES = new Set([
    'super_admin', 'admin', 'gerente', 'coordenador',
    'financeiro', 'atendimento', 'rh', 'estoquista',
    'qualidade', 'monitor', 'visualizador',
])
const TECNICO_ROLES = new Set(['tecnico', 'tecnico_vendedor', 'motorista'])
const VENDEDOR_ROLES = new Set(['comercial', 'vendedor', 'tecnico_vendedor'])

function getAvailableModes(hasRole: (r: string) => boolean): AppMode[] {
    const modes: AppMode[] = []
    if (hasRole('super_admin') || hasRole('admin')) {
        return ['gestao', 'tecnico', 'vendedor']
    }
    if ([...GESTAO_ROLES].some((r) => hasRole(r))) modes.push('gestao')
    if ([...TECNICO_ROLES].some((r) => hasRole(r))) modes.push('tecnico')
    if ([...VENDEDOR_ROLES].some((r) => hasRole(r))) modes.push('vendedor')
    if (modes.length === 0) modes.push('gestao')
    return modes
}

function readStoredMode(availableModes: AppMode[]): AppMode | null {
    try {
        const saved = localStorage.getItem(MODE_STORAGE_KEY) as AppMode | null
        if (saved && availableModes.includes(saved)) return saved
    } catch {
        // ignore
    }
    return null
}

function pathToMode(pathname: string, availableModes: AppMode[]): AppMode {
    if (pathname.startsWith('/tech')) return 'tecnico'
    if ((pathname.startsWith('/crm') || pathname.startsWith('/orcamentos')) && availableModes.includes('vendedor')) {
        return 'vendedor'
    }
    return 'gestao'
}

export function useAppMode() {
    const { hasRole } = useAuthStore()
    const location = useLocation()
    const navigate = useNavigate()

    const availableModes = useMemo(() => getAvailableModes(hasRole), [hasRole])

    const [currentMode, setCurrentMode] = useState<AppMode>(() => {
        return readStoredMode(availableModes) ?? pathToMode(location.pathname, availableModes)
    })

    // Keep mode in sync when available modes change (e.g. after login)
    useEffect(() => {
        if (!availableModes.includes(currentMode)) {
            const fallback = readStoredMode(availableModes) ?? availableModes[0]
            setCurrentMode(fallback)
        }
    }, [availableModes, currentMode])

    // Persist to localStorage whenever mode changes
    useEffect(() => {
        try {
            localStorage.setItem(MODE_STORAGE_KEY, currentMode)
        } catch {
            // ignore
        }
    }, [currentMode])

    const switchMode = useCallback((mode: AppMode) => {
        if (!availableModes.includes(mode)) return
        setCurrentMode(mode)
        if (mode === 'tecnico') navigate('/tech')
        else if (mode === 'vendedor') navigate('/crm')
        else navigate('/')
    }, [availableModes, navigate])

    return {
        currentMode,
        availableModes,
        switchMode,
        hasMultipleModes: availableModes.length > 1,
    }
}

export { MODE_STORAGE_KEY }
