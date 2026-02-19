import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { TvKpiTrendPoint } from '@/types/tv';

interface Props {
    metric: keyof Omit<TvKpiTrendPoint, 'hour'>;
    color?: string;
    className?: string;
}

/**
 * Mini sparkline SVG showing the last 8 hours of a given KPI metric.
 */
export function TvKpiSparkline({ metric, color = '#3b82f6', className = '' }: Props) {
    const { data: trend = [] } = useQuery<TvKpiTrendPoint[]>({
        queryKey: ['tv', 'kpis', 'trend'],
        queryFn: async () => {
            const res = await api.get('/tv/kpis/trend');
            return res.data.trend ?? [];
        },
        refetchInterval: 120_000,
    });

    if (trend.length < 2) return null;

    const values = trend.map((p) => p[metric] as number);
    const max = Math.max(...values, 1);
    const width = 80;
    const height = 24;
    const step = width / (values.length - 1);

    const points = values.map((v, i) => `${i * step},${height - (v / max) * height}`).join(' ');

    const areaPoints = `0,${height} ${points} ${width},${height}`;

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            className={`opacity-60 ${className}`}
            width={width}
            height={height}
            aria-hidden="true"
        >
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={points}
            />
            <polygon fill={`${color}20`} points={areaPoints} />
        </svg>
    );
}
