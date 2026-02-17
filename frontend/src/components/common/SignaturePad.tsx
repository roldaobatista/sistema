import React, { useRef, useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Eraser, Check } from 'lucide-react';

interface SignaturePadProps {
    onSave: (base64: string) => void;
    onClear?: () => void;
    placeholder?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onClear, placeholder = "Assine aqui..." }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set high DPR for smooth lines
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000000';
    }, []);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.beginPath(); // Reset path
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();
        let x, y;

        if ('touches' in e) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            x = (e as React.MouseEvent).clientX - rect.left;
            y = (e as React.MouseEvent).clientY - rect.top;
        }

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsEmpty(false);
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setIsEmpty(true);
        onClear?.();
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (canvas && !isEmpty) {
            onSave(canvas.toDataURL('image/png'));
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="relative border-2 border-dashed border-surface-300 rounded-lg bg-surface-0 overflow-hidden" style={{ height: '200px' }}>
                {isEmpty && (
                    <div className="absolute inset-0 flex items-center justify-center text-surface-400 pointer-events-none text-sm italic">
                        {placeholder}
                    </div>
                )}
                <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseUp={stopDrawing}
                    onMouseMove={draw}
                    onMouseOut={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchEnd={stopDrawing}
                    onTouchMove={draw}
                    className="w-full h-full touch-none cursor-crosshair"
                />
            </div>

            <div className="flex justify-between">
                <Button type="button" variant="outline" size="sm" onClick={clear} className="gap-1">
                    <Eraser size={14} /> Limpar
                </Button>
                <Button type="button" variant="primary" size="sm" onClick={handleSave} disabled={isEmpty} className="gap-1">
                    <Check size={14} /> Confirmar Assinatura
                </Button>
            </div>
        </div>
    );
};
