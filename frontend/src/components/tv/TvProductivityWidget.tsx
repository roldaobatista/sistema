import { useQuery } from '@tanstack/react-query';
import { Trophy, Clock, TrendingUp, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import api from '@/lib/api';
import type { TvProductivityEntry } from '@/types/tv';

export function TvProductivityWidget() {
    const { data: ranking = [] } = useQuery<TvProductivityEntry[]>({
        queryKey: ['tv', 'productivity'],
        queryFn: async () => {
            const res = await api.get('/tv/productivity');
            return res.data.ranking ?? [];
        },
        refetchInterval: 60_000,
    });

    if (ranking.length === 0) return null;

    const top3 = ranking.slice(0, 3);
    const rest = ranking.slice(3, 8);
    const medalColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];

    return (
        <Card className="bg-neutral-900/80 border-neutral-700 p-3 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-yellow-400" />
                <h3 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                    Ranking do Dia
                </h3>
            </div>

            {/* Top 3 */}
            <div className="space-y-2 mb-3">
                {top3.map((tech, idx) => (
                    <div
                        key={tech.id}
                        className={`flex items-center gap-2 p-2 rounded-lg ${idx === 0
                                ? 'bg-yellow-500/10 border border-yellow-500/30'
                                : 'bg-neutral-800/50'
                            }`}
                    >
                        <span className={`text-sm font-bold ${medalColors[idx]} min-w-[18px]`}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-neutral-100 truncate">
                                {tech.name}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                                <span className="flex items-center gap-0.5">
                                    <TrendingUp className="h-2.5 w-2.5" />
                                    {tech.completed_today} OS
                                </span>
                                {tech.avg_execution_min != null && (
                                    <span className="flex items-center gap-0.5">
                                        <Clock className="h-2.5 w-2.5" />
                                        {tech.avg_execution_min}min
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-bold text-blue-400">
                                {tech.completed_today}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Rest of the list */}
            {rest.length > 0 && (
                <div className="flex-1 space-y-1 overflow-y-auto tv-scrollbar-hide">
                    {rest.map((tech, idx) => (
                        <div
                            key={tech.id}
                            className="flex items-center gap-2 px-2 py-1 text-[11px]"
                        >
                            <span className="text-neutral-500 min-w-[14px] text-center">
                                {idx + 4}º
                            </span>
                            <User className="h-3 w-3 text-neutral-500 shrink-0" />
                            <span className="text-neutral-300 truncate flex-1">{tech.name}</span>
                            <span className="text-neutral-400 font-mono">
                                {tech.completed_today}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
