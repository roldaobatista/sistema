import React, { useRef, useState, useEffect, useCallback } from 'react'
import { PenTool, RotateCcw, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface SignaturePadProps {
    onSave: (data: { signature: string; signer_name: string }) => void
    disabled?: boolean
    existingSignature?: string | null
}

export function SignaturePad({ onSave, disabled = false, existingSignature }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasContent, setHasContent] = useState(false)
    const [signerName, setSignerName] = useState('')
    const [showPad, setShowPad] = useState(false)

    const getCtx = useCallback(() => canvasRef.current?.getContext('2d') ?? null, [])

    useEffect(() => {
        if (!showPad || !canvasRef.current) return
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        canvas.width = canvas.offsetWidth * 2
        canvas.height = canvas.offsetHeight * 2
        ctx.scale(2, 2)
        ctx.strokeStyle = '#e4e4e7'
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
    }, [showPad])

    function getPos(e: React.MouseEvent | React.TouchEvent) {
        const rect = canvasRef.current!.getBoundingClientRect()
        if ('touches' in e) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
        }
        return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
    }

    function startDraw(e: React.MouseEvent | React.TouchEvent) {
        e.preventDefault()
        const ctx = getCtx()
        if (!ctx || disabled) return
        const { x, y } = getPos(e)
        ctx.beginPath()
        ctx.moveTo(x, y)
        setIsDrawing(true)
        setHasContent(true)
    }

    function draw(e: React.MouseEvent | React.TouchEvent) {
        e.preventDefault()
        if (!isDrawing) return
        const ctx = getCtx()
        if (!ctx) return
        const { x, y } = getPos(e)
        ctx.lineTo(x, y)
        ctx.stroke()
    }

    function endDraw() {
        setIsDrawing(false)
    }

    function clear() {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        setHasContent(false)
    }

    function handleSave() {
        if (!canvasRef.current || !hasContent || !signerName.trim()) return
        const dataUrl = canvasRef.current.toDataURL('image/png')
        onSave({ signature: dataUrl, signer_name: signerName.trim() })
        setShowPad(false)
    }

    if (existingSignature) {
        return (
            <div className="border border-zinc-700 rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" /> Assinatura registrada
                </p>
                <img src={existingSignature} alt="Assinatura" className="max-h-24 border border-zinc-600 rounded-lg bg-zinc-900 p-2" />
            </div>
        )
    }

    if (!showPad) {
        return (
            <Button variant="secondary" onClick={() => setShowPad(true)} disabled={disabled}>
                <PenTool className="h-4 w-4 mr-2" /> Coletar Assinatura
            </Button>
        )
    }

    return (
        <div className="border border-zinc-700 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-zinc-300">Assinatura Digital</p>

            <input
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-100"
                placeholder="Nome do assinante"
                value={signerName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSignerName(e.target.value)}
            />

            <div className="relative border border-zinc-600 rounded-lg bg-zinc-900 overflow-hidden" style={{ touchAction: 'none' }}>
                <canvas
                    ref={canvasRef}
                    className="w-full cursor-crosshair"
                    style={{ height: '160px' }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                />
                {!hasContent && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p className="text-zinc-600 text-sm">Assine aqui</p>
                    </div>
                )}
            </div>

            <div className="flex gap-2">
                <Button onClick={handleSave} disabled={!hasContent || !signerName.trim()}>
                    <Check className="h-4 w-4 mr-1" /> Confirmar
                </Button>
                <Button variant="secondary" onClick={clear}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Limpar
                </Button>
                <Button variant="secondary" onClick={() => setShowPad(false)}>Cancelar</Button>
            </div>
        </div>
    )
}
