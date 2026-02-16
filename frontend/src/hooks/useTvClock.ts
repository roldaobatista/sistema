import { useState, useEffect } from 'react';

export function useTvClock() {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const secondsStr = time.toLocaleTimeString([], { second: '2-digit' }).slice(-2);
    const dateStr = time
        .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
        .toUpperCase();

    return { time, timeStr, secondsStr, dateStr };
}
