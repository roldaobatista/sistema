import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
    User, LogOut, RefreshCw, Cloud, CloudOff,
    ChevronRight, Clock, Database, Trash2,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useSyncStatus } from '@/hooks/useSyncStatus'
import { getDb } from '@/lib/offlineDb'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export default function TechProfilePage() {
  const { hasPermission } = useAuthStore()

    const navigate = useNavigate()
    const { user, logout } = useAuthStore()
    const { isOnline, pendingCount, lastSyncAt, isSyncing, syncNow } = useSyncStatus()
    const [clearing, setClearing] = useState(false)

    const handleLogout = () => {
  const [searchTerm, setSearchTerm] = useState('')
        logout()
        navigate('/login')
    }

    const clearLocalData = async () => {
        if (!confirm('Limpar todos os dados locais? Dados não sincronizados serão perdidos.')) return
        setClearing(true)
        try {
            const db = await getDb()
            const storeNames: string[] = [
                'work-orders', 'equipment', 'checklists',
                'checklist-responses', 'expenses', 'photos',
                'signatures', 'sync-metadata',
            ]
            const tx = db.transaction(storeNames as any, 'readwrite')
            await Promise.all(storeNames.map((store) => tx.objectStore(store as any).clear()))
            await tx.done
        } catch {
            // Ignore
        } finally {
            setClearing(false)
        }
    }

    const formatDate = (iso: string | null) => {
        if (!iso) return 'Nunca'
        return new Date(iso).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit',
        })
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            {/* User card */}
            <div className="bg-white dark:bg-surface-900 px-4 py-6 border-b border-surface-200 dark:border-surface-700">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                        <User className="w-7 h-7 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">
                            {user?.name || 'Técnico'}
                        </h1>
                        <p className="text-sm text-surface-500">{user?.email}</p>
                    </div>
                </div>
            </div>

            <div className="px-4 py-4 space-y-4">
                {/* Sync status card */}
                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Sincronização</h3>

                    <div className="flex items-center gap-3">
                        <div className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            isOnline
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        )}>
                            {isOnline ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                                {isOnline ? 'Conectado' : 'Offline'}
                            </p>
                            <p className="text-xs text-surface-500">
                                {pendingCount > 0
                                    ? `${pendingCount} item(ns) pendente(s)`
                                    : 'Tudo sincronizado'
                                }
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-surface-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Última sincronização: {formatDate(lastSyncAt)}</span>
                    </div>

                    <button
                        onClick={() => syncNow()}
                        disabled={isSyncing || !isOnline}
                        className={cn(
                            'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors',
                            isOnline
                                ? 'bg-brand-600 text-white active:bg-brand-700'
                                : 'bg-surface-200 dark:bg-surface-700 text-surface-400',
                            isSyncing && 'opacity-70',
                        )}
                    >
                        <RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin')} />
                        {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                    </button>
                </div>

                {/* Settings */}
                <div className="bg-white dark:bg-surface-800/80 rounded-xl overflow-hidden">
                    <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide px-4 pt-4 pb-2">Configurações</h3>

                    <button
                        onClick={clearLocalData}
                        disabled={clearing}
                        className="w-full flex items-center gap-3 px-4 py-3 active:bg-surface-50 dark:active:bg-surface-700"
                    >
                        <Database className="w-5 h-5 text-amber-500" />
                        <div className="flex-1 text-left">
                            <p className="text-sm text-surface-900 dark:text-surface-50">Limpar dados locais</p>
                            <p className="text-xs text-surface-500">Remove cache offline</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-surface-300" />
                    </button>

                    <div className="border-t border-surface-100 dark:border-surface-700" />

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 active:bg-surface-50 dark:active:bg-surface-700"
                    >
                        <LogOut className="w-5 h-5 text-red-500" />
                        <div className="flex-1 text-left">
                            <p className="text-sm text-red-600 dark:text-red-400">Sair da conta</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-surface-300" />
                    </button>
                </div>

                {/* App info */}
                <div className="text-center text-xs text-surface-400 py-4">
                    <p>Kalibrium Tech v2.0</p>
                    <p>PWA Offline Mode</p>
                </div>
            </div>
        </div>
    )
}
