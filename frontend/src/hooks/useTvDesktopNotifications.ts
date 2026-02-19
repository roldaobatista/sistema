import { useEffect, useRef } from 'react';
import type { TvAlert } from '@/types/tv';
import { useTvStore } from '@/stores/tv-store';

/**
 * Hook that fires browser desktop notifications when new critical alerts arrive.
 * Requests Notification permission on first mount.
 */
export function useTvDesktopNotifications(alerts: TvAlert[]) {
    const { soundAlerts } = useTvStore();
    const prevCountRef = useRef(alerts.length);
    const permissionRef = useRef<NotificationPermission>('default');

    // Request permission on mount
    useEffect(() => {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            permissionRef.current = 'granted';
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(p => {
                permissionRef.current = p;
            });
        }
    }, []);

    // Fire notifications on new critical alerts
    useEffect(() => {
        if (!('Notification' in window)) return;
        if (permissionRef.current !== 'granted') return;
        if (alerts.length <= prevCountRef.current) {
            prevCountRef.current = alerts.length;
            return;
        }

        const newAlerts = alerts.slice(prevCountRef.current);
        const criticals = newAlerts.filter(a => a.severity === 'critical');

        for (const alert of criticals) {
            try {
                new Notification('⚠️ KALIBRIUM TV — Alerta Crítico', {
                    body: alert.message,
                    icon: '/favicon.ico',
                    tag: `tv-alert-${alert.entity_id}-${alert.type}`,
                    requireInteraction: true,
                    silent: !soundAlerts,
                });
            } catch {
                // Notifications not supported in this context
            }
        }

        prevCountRef.current = alerts.length;
    }, [alerts, soundAlerts]);
}
