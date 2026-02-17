import { useEffect, useRef, useId, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogBody,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface QrScannerModalProps {
    open: boolean
    onClose: () => void
    onScan: (decodedText: string) => void
    title?: string
}

const SCANNER_ID = 'qr-scanner-root'

export function QrScannerModal({ open, onClose, onScan, title = 'Escanear etiqueta' }: QrScannerModalProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const onScanRef = useRef(onScan)
    const onCloseRef = useRef(onClose)
    const [error, setError] = useState<string | null>(null)
    const containerId = useId().replace(/:/g, '-') || SCANNER_ID

    useEffect(() => {
        onScanRef.current = onScan
        onCloseRef.current = onClose
    }, [onScan, onClose])

    useEffect(() => {
        if (!open) return
        setError(null)
        let mounted = true
        const el = document.getElementById(containerId)
        if (!el) return

        const start = async () => {
            try {
                const cameras = await Html5Qrcode.getCameras()
                if (!mounted || !cameras?.length) {
                    setError('Nenhuma câmera encontrada.')
                    return
                }
                const scanner = new Html5Qrcode(containerId)
                scannerRef.current = scanner
                await scanner.start(
                    cameras[0].id,
                    {
                        fps: 10,
                        qrbox: { width: 220, height: 220 },
                    },
                    (decodedText) => {
                        if (!mounted) return
                        scanner.stop().catch(() => {})
                        scanner.clear()
                        scannerRef.current = null
                        onScanRef.current(decodedText)
                        onCloseRef.current()
                    },
                    () => {}
                )
            } catch (e) {
                if (mounted) setError(e instanceof Error ? e.message : 'Não foi possível acessar a câmera.')
            }
        }
        const t = setTimeout(start, 100)
        return () => {
            mounted = false
            clearTimeout(t)
            scannerRef.current?.stop().then(() => scannerRef.current?.clear()).catch(() => {})
            scannerRef.current = null
        }
    }, [open, containerId])

    const handleTypeCode = () => {
        const raw = window.prompt('Digite o código da etiqueta (ex: P123):')
        if (raw != null && raw.trim()) {
            onScan(raw.trim())
            onClose()
        }
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent size="md" className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <DialogBody className="flex flex-col items-center">
                    <div
                        id={containerId}
                        className={error ? 'hidden' : 'w-full min-h-[240px] rounded-lg overflow-hidden bg-surface-100'}
                    />
                    {error && (
                        <p className="text-sm text-red-600 py-4 text-center" role="alert">
                            {error}
                        </p>
                    )}
                </DialogBody>
                <DialogFooter className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" variant="outline" onClick={handleTypeCode} className="w-full sm:w-auto">
                        Digitar código
                    </Button>
                    <Button type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto">
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
