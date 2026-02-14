import { cn } from '@/lib/utils'

interface TableSkeletonProps {
    /** Número de linhas do skeleton */
    rows?: number
    /** Número de colunas */
    cols?: number
    className?: string
}

/**
 * TableSkeleton — skeleton loader para tabelas.
 *
 * Substitui "Carregando..." por retângulos animados
 * que imitam a estrutura da tabela real.
 */
export function TableSkeleton({
    rows = 5,
    cols = 4,
    className,
}: TableSkeletonProps) {
    return (
        <div className={cn('space-y-0', className)}>
            {/* Header skeleton */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-b border-subtle">
                {Array.from({ length: cols }).map((_, i) => (
                    <div
                        key={`h-${i}`}
                        className="skeleton h-3 rounded"
                        style={{ flex: i === 0 ? 2 : 1 }}
                    />
                ))}
            </div>

            {/* Row skeletons */}
            {Array.from({ length: rows }).map((_, rowIdx) => (
                <div
                    key={rowIdx}
                    className="flex items-center gap-4 px-4 py-3 border-b border-subtle last:border-b-0"
                >
                    {Array.from({ length: cols }).map((_, colIdx) => (
                        <div
                            key={colIdx}
                            className="skeleton h-3.5 rounded"
                            style={{
                                flex: colIdx === 0 ? 2 : 1,
                                animationDelay: `${rowIdx * 60 + colIdx * 30}ms`,
                            }}
                        />
                    ))}
                </div>
            ))}
        </div>
    )
}
