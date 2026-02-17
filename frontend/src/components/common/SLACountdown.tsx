import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { differenceInMinutes, formatDistanceToNow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SLACountdownProps {
    dueAt: string | Date | null;
    status: string;
}

const SLACountdown: React.FC<SLACountdownProps> = ({ dueAt, status }) => {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [variant, setVariant] = useState<'success' | 'warning' | 'danger' | 'neutral'>('neutral');

    useEffect(() => {
        if (!dueAt || ['completed', 'delivered', 'invoiced', 'cancelled'].includes(status)) {
            setTimeLeft('--:--');
            setVariant('neutral');
            return;
        }

        const targetDate = new Date(dueAt);

        const updateCountdown = () => {
            if (isPast(targetDate)) {
                setTimeLeft('Atrasado: ' + formatDistanceToNow(targetDate, { locale: ptBR }));
                setVariant('danger');
                return;
            }

            const diff = differenceInMinutes(targetDate, new Date());

            if (diff < 60) {
                setVariant('danger');
            } else if (diff < 240) { // 4 hours
                setVariant('warning');
            } else {
                setVariant('success');
            }

            setTimeLeft(formatDistanceToNow(targetDate, { locale: ptBR, addSuffix: true }));
        };

        updateCountdown();
        const timer = setInterval(updateCountdown, 60000); // Update every minute

        return () => clearInterval(timer);
    }, [dueAt, status]);

    if (!dueAt) return null;

    const bgColors = {
        success: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800',
        warning: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
        danger: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
        neutral: 'bg-surface-100 text-surface-800 border-surface-200',
    };

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${bgColors[variant]} transition-colors duration-500`}>
            {variant === 'danger' ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            <span>{timeLeft}</span>
        </div>
    );
};

export default SLACountdown;
