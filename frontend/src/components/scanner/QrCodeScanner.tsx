import { useEffect, useRef } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'

interface QrCodeScannerProps {
    onScanSuccess: (decodedText: string) => void
    onScanError?: (errorMessage: string) => void
}

export function QrCodeScanner({ onScanSuccess, onScanError }: QrCodeScannerProps) {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null)

    useEffect(() => {
        scannerRef.current = new Html5QrcodeScanner(
            'qr-reader',
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false,
        )

        scannerRef.current.render(
            (decodedText) => onScanSuccess(decodedText),
            (error) => onScanError?.(error),
        )

        return () => {
            scannerRef.current?.clear().catch(() => {})
        }
    }, [onScanSuccess, onScanError])

    return (
        <div className="mx-auto w-full max-w-[400px] p-2">
            <div id="qr-reader" className="w-full" />
        </div>
    )
}
