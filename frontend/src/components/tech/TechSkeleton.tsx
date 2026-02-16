import { cn } from '@/lib/utils'

function Bone({ className }: { className?: string }) {
    return (
        <div className={cn('animate-pulse bg-surface-200 dark:bg-surface-700 rounded-lg', className)} />
    )
}

export function CardSkeleton() {
    return (
        <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
                <Bone className="h-5 w-24" />
                <Bone className="h-4 w-16 rounded-full" />
            </div>
            <Bone className="h-3 w-40" />
            <Bone className="h-3 w-28" />
            <div className="flex gap-2 mt-2">
                <Bone className="h-3 w-20" />
                <Bone className="h-3 w-16" />
            </div>
        </div>
    )
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
                <CardSkeleton key={i} />
            ))}
        </div>
    )
}

export function StatsSkeleton() {
    return (
        <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-surface-800/80 rounded-xl p-3 space-y-2">
                    <Bone className="h-3 w-16" />
                    <Bone className="h-6 w-12" />
                </div>
            ))}
        </div>
    )
}

export function DashboardSkeleton() {
    return (
        <div className="space-y-4">
            <StatsSkeleton />
            <Bone className="h-24 w-full rounded-xl" />
            <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
                <Bone className="h-4 w-32" />
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-1">
                        <div className="flex justify-between">
                            <Bone className="h-3 w-20" />
                            <Bone className="h-3 w-8" />
                        </div>
                        <Bone className="h-3 w-full" />
                    </div>
                ))}
            </div>
        </div>
    )
}
