import { useState } from 'react'
import {
    Settings, Moon, Sun, Monitor, Fingerprint, Wifi, WifiOff,
    Smartphone, Gauge, ChevronRight, Download, Bell, BellOff,
    Shield, ShieldCheck, Maximize2, Minimize2,
} from 'lucide-react'
import { useDarkMode } from '@/hooks/useDarkMode'
import { useBiometricAuth } from '@/hooks/useBiometricAuth'
import { useLowDataMode } from '@/hooks/useLowDataMode'
import { usePWA } from '@/hooks/usePWA'
import { useKioskMode } from '@/hooks/useKioskMode'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export default function TechSettingsPage() {
    const { theme, isDark, setTheme } = useDarkMode()
    const bio = useBiometricAuth()
    const lowData = useLowDataMode()
    const { isInstallable, isInstalled, install, isOnline } = usePWA()
    const kiosk = useKioskMode()
    const { user } = useAuthStore()
    const [notificationsEnabled, setNotificationsEnabled] = useState(() =>
        Notification.permission === 'granted'
    )

    const handleInstall = async () => {
        const result = await install()
        if (result) toast.success('App instalado com sucesso!')
    }

    const handleBiometricToggle = async () => {
        if (bio.isRegistered) {
            bio.unregister()
            toast.success('Biometria removida')
        } else {
            const ok = await bio.register(String(user?.id || '1'), user?.name || 'Técnico')
            if (ok) toast.success('Biometria configurada!')
            else if (bio.error) toast.error(bio.error)
        }
    }

    const handleNotifications = async () => {
        if (notificationsEnabled) {
            setNotificationsEnabled(false)
            toast.info('Notificações desativadas')
            return
        }

        const perm = await Notification.requestPermission()
        if (perm === 'granted') {
            setNotificationsEnabled(true)
            toast.success('Notificações ativadas')
        } else {
            toast.error('Permissão de notificação negada')
        }
    }

    const themeOptions: Array<{ value: 'light' | 'dark' | 'system'; icon: React.ElementType; label: string }> = [
        { value: 'light', icon: Sun, label: 'Claro' },
        { value: 'dark', icon: Moon, label: 'Escuro' },
        { value: 'system', icon: Monitor, label: 'Sistema' },
    ]

    return (
        <div className="flex flex-col h-full overflow-y-auto bg-surface-50 dark:bg-surface-950">
            {/* Header */}
            <div className="bg-white dark:bg-surface-900 px-4 py-5 border-b border-surface-200 dark:border-surface-700">
                <div className="flex items-center gap-3">
                    <Settings className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                    <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">
                        Configurações
                    </h1>
                </div>
            </div>

            <div className="px-4 py-4 space-y-4">
                {/* Theme Selector */}
                <section className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Aparência</h3>
                    <div className="grid grid-cols-3 gap-2">
                        {themeOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setTheme(opt.value)}
                                className={cn(
                                    'flex flex-col items-center gap-2 p-3 rounded-xl text-sm font-medium transition-all',
                                    theme === opt.value
                                        ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500'
                                        : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300'
                                )}
                            >
                                <opt.icon className="w-5 h-5" />
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Security */}
                <section className="bg-white dark:bg-surface-800/80 rounded-xl overflow-hidden">
                    <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide px-4 pt-4 pb-2">Segurança</h3>

                    <button
                        onClick={handleBiometricToggle}
                        disabled={!bio.isSupported || bio.isAuthenticating}
                        className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-surface-50 dark:active:bg-surface-700 disabled:opacity-50"
                    >
                        {bio.isRegistered
                            ? <ShieldCheck className="w-5 h-5 text-emerald-500" />
                            : <Fingerprint className="w-5 h-5 text-orange-500" />
                        }
                        <div className="flex-1 text-left">
                            <p className="text-sm text-surface-900 dark:text-surface-50">
                                Login biométrico
                            </p>
                            <p className="text-xs text-surface-500">
                                {!bio.isSupported
                                    ? 'Não suportado neste dispositivo'
                                    : bio.isRegistered
                                        ? 'Ativo — toque para remover'
                                        : 'Desativado — toque para configurar'
                                }
                            </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-surface-300" />
                    </button>
                </section>

                {/* Notifications */}
                <section className="bg-white dark:bg-surface-800/80 rounded-xl overflow-hidden">
                    <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide px-4 pt-4 pb-2">Notificações</h3>

                    <button
                        onClick={handleNotifications}
                        className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-surface-50 dark:active:bg-surface-700"
                    >
                        {notificationsEnabled
                            ? <Bell className="w-5 h-5 text-brand-500" />
                            : <BellOff className="w-5 h-5 text-surface-400" />
                        }
                        <div className="flex-1 text-left">
                            <p className="text-sm text-surface-900 dark:text-surface-50">
                                Push Notifications
                            </p>
                            <p className="text-xs text-surface-500">
                                {notificationsEnabled ? 'Ativadas' : 'Desativadas'}
                            </p>
                        </div>
                        <div className={cn(
                            'w-10 h-6 rounded-full relative transition-colors',
                            notificationsEnabled
                                ? 'bg-brand-600'
                                : 'bg-surface-300 dark:bg-surface-600',
                        )}>
                            <div className={cn(
                                'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all',
                                notificationsEnabled ? 'left-[18px]' : 'left-0.5',
                            )} />
                        </div>
                    </button>
                </section>

                {/* Data Mode */}
                <section className="bg-white dark:bg-surface-800/80 rounded-xl overflow-hidden">
                    <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide px-4 pt-4 pb-2">Dados e Performance</h3>

                    <button
                        onClick={lowData.toggle}
                        className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-surface-50 dark:active:bg-surface-700"
                    >
                        <Gauge className={cn(
                            'w-5 h-5',
                            lowData.isEnabled ? 'text-amber-500' : 'text-surface-400'
                        )} />
                        <div className="flex-1 text-left">
                            <p className="text-sm text-surface-900 dark:text-surface-50">
                                Modo economia de dados
                            </p>
                            <p className="text-xs text-surface-500">
                                {lowData.isEnabled
                                    ? 'Ativo — imagens comprimidas, animações desabilitadas'
                                    : 'Desativado'
                                }
                                {lowData.isSlowConnection && ' · Conexão lenta detectada'}
                            </p>
                        </div>
                        <div className={cn(
                            'w-10 h-6 rounded-full relative transition-colors',
                            lowData.isEnabled
                                ? 'bg-amber-500'
                                : 'bg-surface-300 dark:bg-surface-600',
                        )}>
                            <div className={cn(
                                'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all',
                                lowData.isEnabled ? 'left-[18px]' : 'left-0.5',
                            )} />
                        </div>
                    </button>

                    <div className="border-t border-surface-100 dark:border-surface-700" />

                    <div className="flex items-center gap-3 px-4 py-3.5">
                        {isOnline
                            ? <Wifi className="w-5 h-5 text-emerald-500" />
                            : <WifiOff className="w-5 h-5 text-red-500" />
                        }
                        <div className="flex-1 text-left">
                            <p className="text-sm text-surface-900 dark:text-surface-50">
                                Conexão
                            </p>
                            <p className="text-xs text-surface-500">
                                {isOnline ? 'Online' : 'Offline'} · {lowData.connectionType}
                            </p>
                        </div>
                    </div>
                </section>

                {/* Install PWA */}
                {isInstallable && !isInstalled && (
                    <section className="bg-white dark:bg-surface-800/80 rounded-xl overflow-hidden">
                        <button
                            onClick={handleInstall}
                            className="w-full flex items-center gap-3 px-4 py-4 active:bg-surface-50 dark:active:bg-surface-700"
                        >
                            <div className="w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                                <Download className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                                    Instalar Kalibrium
                                </p>
                                <p className="text-xs text-surface-500">
                                    Acesso rápido pela tela inicial
                                </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-surface-300" />
                        </button>
                    </section>
                )}

                {/* Modo Quiosque */}
                {kiosk.isSupported && (
                    <section className="bg-white dark:bg-surface-800/80 rounded-xl overflow-hidden">
                        <button
                            onClick={kiosk.toggle}
                            className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-surface-50 dark:active:bg-surface-700"
                        >
                            {kiosk.isActive ? (
                                <Minimize2 className="w-5 h-5 text-orange-500" />
                            ) : (
                                <Maximize2 className="w-5 h-5 text-surface-400" />
                            )}
                            <div className="flex-1 text-left">
                                <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                                    Modo Quiosque
                                </p>
                                <p className="text-xs text-surface-500">
                                    {kiosk.isActive ? 'Tela cheia ativa — toque para sair' : 'Ativar modo tela cheia bloqueada'}
                                </p>
                            </div>
                            <div className={cn(
                                'w-10 h-6 rounded-full flex items-center transition-colors',
                                kiosk.isActive ? 'bg-orange-500 justify-end' : 'bg-surface-300 dark:bg-surface-600 justify-start',
                            )}>
                                <div className="w-5 h-5 rounded-full bg-white shadow-sm mx-0.5" />
                            </div>
                        </button>
                    </section>
                )}

                {isInstalled && (
                    <section className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            <Smartphone className="w-5 h-5 text-emerald-500" />
                            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                                App instalado ✓
                            </p>
                        </div>
                    </section>
                )}
            </div>
        </div>
    )
}
