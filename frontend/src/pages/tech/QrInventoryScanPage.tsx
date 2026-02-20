import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { QrCodeScanner } from '@/components/scanner/QrCodeScanner'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/pageheader'
import { Camera, RotateCcw } from 'lucide-react'

export default function QrInventoryScanPage() {
    const [scannedHash, setScannedHash] = useState('')
    const [quantity, setQuantity] = useState(1)
    const [type, setType] = useState<'entry' | 'exit'>('exit')
    const [warehouseId, setWarehouseId] = useState('')

    const { data: warehouses } = useQuery({
        queryKey: ['tech-warehouses'],
        queryFn: () => api.get('/estoque/armazens', { params: { per_page: 50 } }).then(res => res.data.data),
    })

    const scanMutation = useMutation({
        mutationFn: (data: Record<string, unknown>) => api.post('/stock/scan-qr', data),
        onSuccess: (res) => {
            toast.success(`Movimentação do produto ${res.data.product?.name ?? ''} registrada!`)
            setScannedHash('')
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Erro ao processar QR Code')
        },
    })

    const handleScanSuccess = (decodedText: string) => {
        if (!scannedHash) {
            setScannedHash(decodedText)
            toast.info('QR Code lido! Confirme quantidade e armazém.')
        }
    }

    const handleSubmit = () => {
        if (!scannedHash || !warehouseId) {
            toast.warning('Leia o QR Code e selecione o armazém.')
            return
        }
        scanMutation.mutate({ qr_hash: scannedHash, quantity, type, warehouse_id: warehouseId })
    }

    return (
        <div className="space-y-5">
            <PageHeader title="Scanner PWA - Baú Móvel" subtitle="Leia o QR Code da peça para registrar movimentação" />

            {!scannedHash ? (
                <div className="rounded-xl border border-default bg-surface-0 p-6 shadow-card">
                    <p className="mb-4 text-center text-sm text-surface-500">
                        <Camera className="mx-auto mb-2 h-8 w-8 text-brand-500" />
                        Aponte a câmera para o QR Code da peça
                    </p>
                    <QrCodeScanner onScanSuccess={handleScanSuccess} onScanError={() => {}} />
                </div>
            ) : (
                <div className="rounded-xl border border-default bg-surface-0 p-6 shadow-card space-y-4">
                    <div>
                        <p className="text-sm font-medium text-brand-600">Código Capturado</p>
                        <p className="mt-1 break-all rounded bg-surface-50 p-2 text-sm font-mono">{scannedHash}</p>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-surface-700">Armazém (Baú do Veículo)</label>
                        <select
                            value={warehouseId}
                            onChange={e => setWarehouseId(e.target.value)}
                            className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                        >
                            <option value="">Selecione...</option>
                            {(warehouses ?? []).map((w: any) => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-surface-700">Tipo de Movimentação</label>
                        <select
                            value={type}
                            onChange={e => setType(e.target.value as 'entry' | 'exit')}
                            className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                        >
                            <option value="exit">Saída (Retirada do Baú)</option>
                            <option value="entry">Entrada (Devolução ao Baú)</option>
                        </select>
                    </div>

                    <Input
                        label="Quantidade"
                        type="number"
                        min={1}
                        value={String(quantity)}
                        onChange={e => setQuantity(Number(e.target.value))}
                    />

                    <div className="flex flex-col gap-2 pt-2">
                        <Button onClick={handleSubmit} loading={scanMutation.isPending} className="w-full">
                            Confirmar Movimentação
                        </Button>
                        <Button variant="outline" onClick={() => setScannedHash('')} className="w-full" icon={<RotateCcw className="h-4 w-4" />}>
                            Ler Outro Código
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
