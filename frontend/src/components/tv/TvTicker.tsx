import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import type { TvWorkOrder } from '@/types/tv';

interface TvTickerProps {
    items: TvWorkOrder[];
}

export function TvTicker({ items }: TvTickerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [shouldAnimate, setShouldAnimate] = useState(false);

    useEffect(() => {
        const container = containerRef.current;
        const content = contentRef.current;
        if (!container || !content) return;

        const contentWidth = content.scrollWidth / 2;
        const containerWidth = container.clientWidth;
        setShouldAnimate(contentWidth > containerWidth);
    }, [items]);

    if (!items || items.length === 0) {
        return (
            <div className="fixed bottom-0 left-0 right-0 h-10 bg-neutral-900 border-t border-neutral-800 flex items-center px-4 z-10">
                <div className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded mr-4 shrink-0 uppercase tracking-widest">
                    ATIVIDADES
                </div>
                <span className="text-[10px] text-neutral-600 font-mono">Sistema Operacional Normal</span>
            </div>
        );
    }

    const renderItems = (key: string) =>
        items.map((os, idx) => (
            <div key={`${key}-${idx}`} className="flex items-center gap-2 text-xs text-neutral-400 shrink-0">
                <Clock className="h-3 w-3 text-neutral-600 shrink-0" />
                <span className="font-mono text-blue-400">#{os.os_number || os.id}</span>
                <span className="font-semibold text-neutral-300">{os.customer?.name}</span>
                <span className="text-neutral-600 text-[10px]">
                    ({new Date(os.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                </span>
                <span className="w-1 h-1 bg-neutral-700 rounded-full mx-1 shrink-0" />
            </div>
        ));

    return (
        <div
            ref={containerRef}
            className="fixed bottom-0 left-0 right-0 h-10 bg-neutral-900 border-t border-neutral-800 flex items-center px-4 overflow-hidden z-10"
        >
            <div className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded mr-4 shrink-0 uppercase tracking-widest">
                ATIVIDADES
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
                <div
                    ref={contentRef}
                    className={`flex items-center gap-8 whitespace-nowrap ${shouldAnimate ? 'tv-ticker-scroll' : ''}`}
                >
                {renderItems('a')}
                {shouldAnimate && renderItems('b')}
                </div>
            </div>

            <style>{`
                @keyframes tv-ticker-scroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .tv-ticker-scroll {
                    animation: tv-ticker-scroll ${Math.max(items.length * 5, 20)}s linear infinite;
                }
                .tv-ticker-scroll:hover {
                    animation-play-state: paused;
                }
            `}</style>
        </div>
    );
}
