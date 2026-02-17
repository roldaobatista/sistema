import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bluetooth, BluetoothOff, Printer, Loader2, Check, AlertCircle } from 'lucide-react'
import { useBluetoothPrint } from '@/hooks/useBluetoothPrint'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export default function TechBluetoothPrintPage() {

    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const bt = useBluetoothPrint()

    const handleConnect = async () => {
        const ok = await bt.connect()
        if (ok) toast.success('Impressora conectada!')
    }

    const handleDisconnect = async () => {
        await bt.disconnect()
        toast.info('Impressora desconectada')
    }

    const handleTestPrint = async () => {
        const ok = await bt.printReceipt({
            title: 'KALIBRIUM - TESTE',
            items: [
                { label: 'OS', value: `#${id || '000'}` },
                { label: 'Data', value: new Date().toLocaleDateString('pt-BR') },
                { label: 'Hora', value: new Date().toLocaleTimeString('pt-BR') },
                { label: 'Status', value: 'Teste OK' },
            ],
            footer: 'Impressão de teste realizada com sucesso',
        })
        if (ok) toast.success('Impressão de teste enviada!')
    }

    const handlePrintOS = async () => {
        const ok = await bt.printReceipt({
            title: 'KALIBRIUM - OS',
            items: [
                { label: 'Ordem de Serviço', value: `#${id || '---'}` },
                { label: 'Data', value: new Date().toLocaleDateString('pt-BR') },
                { label: 'Técnico', value: 'Em campo' },
                { label: 'Status', value: 'Em andamento' },
                { label: '', value: '' },
                { label: 'ASSINATURA:', value: '' },
                { label: '', value: '' },
                { label: '________________', value: '' },
                { label: 'Cliente', value: '' },
            ],
            footer: 'Kalibrium Gestão',
        })
        if (ok) toast.success('Comprovante da OS impresso!')
    }

    return (
        <div className="flex flex-col h-full bg-surface-50">
            {/* Header */}
            <div className="bg-card px-4 py-3 flex items-center gap-3 border-b border-border shrink-0">
                <button onClick={() => navigate(-1)} className="p-1">
                    <ArrowLeft className="w-5 h-5 text-surface-600" />
                </button>
                <div className="flex items-center gap-2">
                    <Printer className="w-5 h-5 text-brand-600" />
                    <h1 className="text-lg font-bold text-foreground">
                        Impressão Bluetooth
                    </h1>
                </div>
            </div>

            <div className="flex-1 px-4 py-6 space-y-4 overflow-y-auto">
                {/* Connection Status */}
                <section className="bg-card rounded-xl p-5">
                    <div className="flex items-center gap-4 mb-4">
                        <div className={cn(
                            'w-14 h-14 rounded-full flex items-center justify-center',
                            bt.isConnected
                                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                                : 'bg-surface-100'
                        )}>
                            {bt.isConnected
                                ? <Bluetooth className="w-7 h-7 text-emerald-500" />
                                : <BluetoothOff className="w-7 h-7 text-surface-400" />
                            }
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">
                                {bt.isConnected
                                    ? bt.deviceName || 'Impressora conectada'
                                    : 'Nenhuma impressora'
                                }
                            </p>
                            <p className="text-xs text-surface-500">
                                {bt.isConnected ? 'Pronta para imprimir' : 'Não conectada'}
                            </p>
                        </div>
                    </div>

                    {bt.isConnected ? (
                        <button
                            onClick={handleDisconnect}
                            className="w-full py-2.5 rounded-lg bg-red-50 text-red-600 dark:text-red-400 text-sm font-medium"
                        >
                            Desconectar
                        </button>
                    ) : (
                        <button
                            onClick={handleConnect}
                            disabled={!bt.isSupported || bt.isConnecting}
                            className={cn(
                                'w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-colors',
                                bt.isSupported
                                    ? 'bg-brand-600 text-white active:bg-brand-700'
                                    : 'bg-surface-200 text-surface-400',
                                bt.isConnecting && 'opacity-70',
                            )}
                        >
                            {bt.isConnecting
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Conectando...</>
                                : <><Bluetooth className="w-4 h-4" /> Buscar impressora</>
                            }
                        </button>
                    )}

                    {!bt.isSupported && (
                        <div className="mt-3 bg-amber-50 rounded-lg p-3 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-amber-800 dark:text-amber-200">
                                Web Bluetooth não é suportado neste navegador. Use Chrome no Android ou Edge.
                            </p>
                        </div>
                    )}
                </section>

                {/* Print Options */}
                {bt.isConnected && (
                    <section className="bg-card rounded-xl overflow-hidden">
                        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide px-5 pt-4 pb-2">
                            Opções de Impressão
                        </h3>

                        <button
                            onClick={handleTestPrint}
                            disabled={bt.isPrinting}
                            className="w-full flex items-center gap-3 px-5 py-4 active:bg-surface-50 dark:active:bg-surface-700 disabled:opacity-50"
                        >
                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Check className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-sm text-foreground">Impressão de teste</p>
                                <p className="text-xs text-surface-500">Verifica se a impressora está funcionando</p>
                            </div>
                        </button>

                        <div className="border-t border-surface-100" />

                        <button
                            onClick={handlePrintOS}
                            disabled={bt.isPrinting || !id}
                            className="w-full flex items-center gap-3 px-5 py-4 active:bg-surface-50 dark:active:bg-surface-700 disabled:opacity-50"
                        >
                            <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center">
                                <Printer className="w-5 h-5 text-brand-600" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-sm text-foreground">
                                    Comprovante da OS {id ? `#${id}` : ''}
                                </p>
                                <p className="text-xs text-surface-500">Imprime recibo com dados da ordem de serviço</p>
                            </div>
                        </button>
                    </section>
                )}

                {/* Printing indicator */}
                {bt.isPrinting && (
                    <div className="flex items-center justify-center gap-2 py-4 text-brand-600">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm font-medium">Imprimindo...</span>
                    </div>
                )}

                {/* Error */}
                {bt.error && (
                    <div className="bg-red-50 rounded-xl p-4 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-red-600 dark:text-red-400">{bt.error}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
