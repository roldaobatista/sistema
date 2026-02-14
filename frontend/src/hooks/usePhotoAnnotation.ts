import { useState, useCallback, useRef } from 'react'

interface PhotoAnnotation {
    type: 'text' | 'arrow' | 'circle' | 'freehand'
    x: number
    y: number
    endX?: number
    endY?: number
    text?: string
    color: string
    points?: Array<{ x: number; y: number }>
}

interface AnnotationState {
    annotations: PhotoAnnotation[]
    currentTool: PhotoAnnotation['type']
    currentColor: string
    isDrawing: boolean
}

export function usePhotoAnnotation() {
    const [state, setState] = useState<AnnotationState>({
        annotations: [],
        currentTool: 'freehand',
        currentColor: '#ff0000',
        isDrawing: false,
    })

    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const imageRef = useRef<HTMLImageElement | null>(null)
    const currentAnnotationRef = useRef<PhotoAnnotation | null>(null)

    const loadImage = useCallback((canvas: HTMLCanvasElement, src: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => {
                canvasRef.current = canvas
                imageRef.current = img
                canvas.width = img.naturalWidth
                canvas.height = img.naturalHeight
                const ctx = canvas.getContext('2d')!
                ctx.drawImage(img, 0, 0)
                resolve()
            }
            img.onerror = reject
            img.src = src
        })
    }, [])

    const redraw = useCallback(() => {
        const canvas = canvasRef.current
        const img = imageRef.current
        if (!canvas || !img) return

        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)

        for (const ann of state.annotations) {
            ctx.strokeStyle = ann.color
            ctx.fillStyle = ann.color
            ctx.lineWidth = 3
            ctx.lineCap = 'round'

            switch (ann.type) {
                case 'freehand':
                    if (ann.points && ann.points.length > 1) {
                        ctx.beginPath()
                        ctx.moveTo(ann.points[0].x, ann.points[0].y)
                        for (let i = 1; i < ann.points.length; i++) {
                            ctx.lineTo(ann.points[i].x, ann.points[i].y)
                        }
                        ctx.stroke()
                    }
                    break
                case 'arrow':
                    if (ann.endX !== undefined && ann.endY !== undefined) {
                        ctx.beginPath()
                        ctx.moveTo(ann.x, ann.y)
                        ctx.lineTo(ann.endX, ann.endY)
                        ctx.stroke()
                        // Arrowhead
                        const angle = Math.atan2(ann.endY - ann.y, ann.endX - ann.x)
                        const headLen = 15
                        ctx.beginPath()
                        ctx.moveTo(ann.endX, ann.endY)
                        ctx.lineTo(ann.endX - headLen * Math.cos(angle - Math.PI / 6), ann.endY - headLen * Math.sin(angle - Math.PI / 6))
                        ctx.lineTo(ann.endX - headLen * Math.cos(angle + Math.PI / 6), ann.endY - headLen * Math.sin(angle + Math.PI / 6))
                        ctx.closePath()
                        ctx.fill()
                    }
                    break
                case 'circle':
                    if (ann.endX !== undefined && ann.endY !== undefined) {
                        const rx = Math.abs(ann.endX - ann.x) / 2
                        const ry = Math.abs(ann.endY - ann.y) / 2
                        const cx = (ann.x + ann.endX) / 2
                        const cy = (ann.y + ann.endY) / 2
                        ctx.beginPath()
                        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
                        ctx.stroke()
                    }
                    break
                case 'text':
                    if (ann.text) {
                        ctx.font = 'bold 16px sans-serif'
                        ctx.fillText(ann.text, ann.x, ann.y)
                    }
                    break
            }
        }
    }, [state.annotations])

    const getCanvasCoords = useCallback((e: React.TouchEvent | React.MouseEvent): { x: number; y: number } => {
        const canvas = canvasRef.current!
        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height

        if ('touches' in e) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY,
            }
        }
        return {
            x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
            y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
        }
    }, [])

    const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault()
        const coords = getCanvasCoords(e)

        if (state.currentTool === 'text') {
            const text = prompt('Texto da anotação:')
            if (text) {
                setState(s => ({
                    ...s,
                    annotations: [...s.annotations, { type: 'text', x: coords.x, y: coords.y, text, color: s.currentColor }],
                }))
            }
            return
        }

        const annotation: PhotoAnnotation = {
            type: state.currentTool,
            x: coords.x,
            y: coords.y,
            color: state.currentColor,
            points: state.currentTool === 'freehand' ? [coords] : undefined,
        }

        currentAnnotationRef.current = annotation
        setState(s => ({ ...s, isDrawing: true }))
    }, [state.currentTool, state.currentColor, getCanvasCoords])

    const moveDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault()
        if (!currentAnnotationRef.current) return

        const coords = getCanvasCoords(e)
        const ann = currentAnnotationRef.current

        if (ann.type === 'freehand') {
            ann.points = ann.points ? [...ann.points, coords] : [coords]
        } else {
            ann.endX = coords.x
            ann.endY = coords.y
        }

        // Live preview
        redraw()
        const canvas = canvasRef.current!
        const ctx = canvas.getContext('2d')!
        ctx.strokeStyle = ann.color
        ctx.fillStyle = ann.color
        ctx.lineWidth = 3
        ctx.lineCap = 'round'

        if (ann.type === 'freehand' && ann.points && ann.points.length > 1) {
            ctx.beginPath()
            ctx.moveTo(ann.points[0].x, ann.points[0].y)
            for (let i = 1; i < ann.points.length; i++) {
                ctx.lineTo(ann.points[i].x, ann.points[i].y)
            }
            ctx.stroke()
        }
    }, [getCanvasCoords, redraw])

    const endDraw = useCallback(() => {
        if (!currentAnnotationRef.current) return

        setState(s => ({
            ...s,
            isDrawing: false,
            annotations: [...s.annotations, currentAnnotationRef.current!],
        }))
        currentAnnotationRef.current = null
    }, [])

    const undo = useCallback(() => {
        setState(s => ({
            ...s,
            annotations: s.annotations.slice(0, -1),
        }))
    }, [])

    const clearAll = useCallback(() => {
        setState(s => ({ ...s, annotations: [] }))
    }, [])

    const setTool = useCallback((tool: PhotoAnnotation['type']) => {
        setState(s => ({ ...s, currentTool: tool }))
    }, [])

    const setColor = useCallback((color: string) => {
        setState(s => ({ ...s, currentColor: color }))
    }, [])

    const exportAnnotated = useCallback((): string | null => {
        redraw()
        return canvasRef.current?.toDataURL('image/jpeg', 0.9) || null
    }, [redraw])

    return {
        ...state,
        loadImage,
        redraw,
        startDraw,
        moveDraw,
        endDraw,
        undo,
        clearAll,
        setTool,
        setColor,
        exportAnnotated,
    }
}
