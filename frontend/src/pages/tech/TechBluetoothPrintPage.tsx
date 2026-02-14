import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bluetooth, BluetoothOff, Printer, Loader2, Check, AlertCircle } from 'lucide-react'
import { useBluetoothPrint } from '@/hooks/useBluetoothPrint'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export default function TechBluetoothPrintPage() {

  // MVP: Data fetching
  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: ['tech-bluetooth-print'],
    queryFn: () => api.get('/tech-bluetooth-print').then(r => r.data?.data ?? r.data ?? []),
  })

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/tech-bluetooth-print/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['tech-bluetooth-print'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }

  // MVP: Search
  const [searchTerm, setSearchTerm] = useState('')

  // MVP: Loading/Error/Empty states
  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (isError) return <div className="flex flex-col items-center justify-center p-8 text-red-500"><AlertCircle className="h-8 w-8 mb-2" /><p>Erro ao carregar dados</p><button onClick={() => refetch()} className="mt-2 text-blue-500 underline">Tentar novamente</button></div>
  if (!items || (Array.isArray(items) && items.length === 0)) return <div className="flex flex-col items-center justify-center p-8 text-gray-400"><Inbox className="h-12 w-12 mb-2" /><p>Nenhum registro encontrado</p></div>
  const { hasPermission } = useAuthStore()

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
            footer: 'Kalibrium · Sistema OS',
        })
        if (ok) toast.success('Comprovante da OS impresso!')
    }

    return (
        <div className="flex flex-col h-full bg-surface-50 dark:bg-surface-950">
            {/* Header */}
            <div className="bg-white dark:bg-surface-900 px-4 py-3 flex items-center gap-3 border-b border-surface-200 dark:border-surface-700 shrink-0">
                <button onClick={() => navigate(-1)} className="p-1">
                    <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-300" />
                </button>
                <div className="flex items-center gap-2">
                    <Printer className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">
                        Impressão Bluetooth
                    </h1>
                </div>
            </div>

            <div className="flex-1 px-4 py-6 space-y-4 overflow-y-auto">
                {/* Connection Status */}
                <section className="bg-white dark:bg-surface-800/80 rounded-xl p-5">
                    <div className="flex items-center gap-4 mb-4">
                        <div className={cn(
                            'w-14 h-14 rounded-full flex items-center justify-center',
                            bt.isConnected
                                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                                : 'bg-surface-100 dark:bg-surface-700'
                        )}>
                            {bt.isConnected
                                ? <Bluetooth className="w-7 h-7 text-emerald-500" />
                                : <BluetoothOff className="w-7 h-7 text-surface-400" />
                            }
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-surface-900 dark:text-surface-50">
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
                            className="w-full py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium"
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
                                    : 'bg-surface-200 dark:bg-surface-700 text-surface-400',
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
                        <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-amber-800 dark:text-amber-200">
                                Web Bluetooth não é suportado neste navegador. Use Chrome no Android ou Edge.
                            </p>
                        </div>
                    )}
                </section>

                {/* Print Options */}
                {bt.isConnected && (
                    <section className="bg-white dark:bg-surface-800/80 rounded-xl overflow-hidden">
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
                                <p className="text-sm text-surface-900 dark:text-surface-50">Impressão de teste</p>
                                <p className="text-xs text-surface-500">Verifica se a impressora está funcionando</p>
                            </div>
                        </button>

                        <div className="border-t border-surface-100 dark:border-surface-700" />

                        <button
                            onClick={handlePrintOS}
                            disabled={bt.isPrinting || !id}
                            className="w-full flex items-center gap-3 px-5 py-4 active:bg-surface-50 dark:active:bg-surface-700 disabled:opacity-50"
                        >
                            <div className="w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                                <Printer className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-sm text-surface-900 dark:text-surface-50">
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
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-red-600 dark:text-red-400">{bt.error}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
