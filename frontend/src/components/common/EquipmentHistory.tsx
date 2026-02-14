import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Calendar, Wrench, ShieldCheck, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HistoryItem {
    id: number;
    type: 'calibration' | 'maintenance';
    date: string;
    title: string;
    result: string | null;
    performer: string | null;
    work_order: {
        id: number;
        number: string;
        os_number: string | null;
        status: string;
    } | null;
    details: any;
}

interface EquipmentHistoryProps {
    equipmentId: number;
}

export const EquipmentHistory: React.FC<EquipmentHistoryProps> = ({ equipmentId }) => {
    const { data, isLoading } = useQuery({
        queryKey: ['equipment-history', equipmentId],
        queryFn: () => api.get(`/equipments/${equipmentId}/history`),
        enabled: !!equipmentId,
    });

    const history: HistoryItem[] = data?.data?.history ?? [];

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <FileText size={48} className="mb-2 opacity-20" />
                <p>Nenhum histórico encontrado para este equipamento.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {history.map((item) => (
                <Card key={`${item.type}-${item.id}`} className="p-4 relative overflow-hidden group hover:border-brand-300 transition-colors">
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${item.type === 'calibration' ? 'bg-success-50 text-success-600' : 'bg-brand-50 text-brand-600'
                            }`}>
                            {item.type === 'calibration' ? <ShieldCheck size={20} /> : <Wrench size={20} />}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <h4 className="font-semibold text-slate-900 truncate">{item.title}</h4>
                                <span className="text-xs text-slate-500 whitespace-nowrap flex items-center gap-1">
                                    <Calendar size={12} />
                                    {format(new Date(item.date), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                            </div>

                            <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                                {item.details.notes || item.details.description || 'Sem observações registradas.'}
                            </p>

                            <div className="flex flex-wrap items-center gap-2">
                                {item.result && (
                                    <Badge variant={item.result === 'aprovado' ? 'success' : 'danger'}>
                                        {item.result === 'aprovado' ? 'Aprovado' : 'Reprovado'}
                                    </Badge>
                                )}

                                {item.work_order && (
                                    <Badge variant="outline" className="text-slate-500 border-slate-200">
                                        OS #{item.work_order.os_number || item.work_order.number}
                                    </Badge>
                                )}

                                <span className="text-xs text-slate-400 ml-auto italic">
                                    Por: {item.performer || 'Sistema'}
                                </span>
                            </div>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
};
