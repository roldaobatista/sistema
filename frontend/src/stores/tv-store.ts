import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TvLayout } from '@/types/tv';

export type TvTheme = 'dark' | 'midnight' | 'matrix' | 'ocean' | 'ember';

export interface TvThemeColors {
    bg: string;
    bgCard: string;
    bgHeader: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    accentAlt: string;
}

export const TV_THEMES: Record<TvTheme, TvThemeColors> = {
    dark: {
        bg: 'bg-neutral-950',
        bgCard: 'bg-neutral-900',
        bgHeader: 'bg-neutral-900/80',
        border: 'border-neutral-800',
        text: 'text-neutral-100',
        textMuted: 'text-neutral-500',
        accent: 'text-blue-400',
        accentAlt: 'text-yellow-400',
    },
    midnight: {
        bg: 'bg-slate-950',
        bgCard: 'bg-slate-900',
        bgHeader: 'bg-slate-900/80',
        border: 'border-slate-700',
        text: 'text-slate-100',
        textMuted: 'text-slate-400',
        accent: 'text-indigo-400',
        accentAlt: 'text-amber-400',
    },
    matrix: {
        bg: 'bg-gray-950',
        bgCard: 'bg-gray-900',
        bgHeader: 'bg-gray-900/80',
        border: 'border-green-900/50',
        text: 'text-green-100',
        textMuted: 'text-green-600',
        accent: 'text-green-400',
        accentAlt: 'text-emerald-300',
    },
    ocean: {
        bg: 'bg-cyan-950',
        bgCard: 'bg-cyan-900/60',
        bgHeader: 'bg-cyan-900/80',
        border: 'border-cyan-700/40',
        text: 'text-cyan-50',
        textMuted: 'text-cyan-400',
        accent: 'text-teal-400',
        accentAlt: 'text-sky-300',
    },
    ember: {
        bg: 'bg-stone-950',
        bgCard: 'bg-stone-900',
        bgHeader: 'bg-stone-900/80',
        border: 'border-orange-900/40',
        text: 'text-orange-50',
        textMuted: 'text-stone-500',
        accent: 'text-orange-400',
        accentAlt: 'text-red-400',
    },
};

interface TvState {
    layout: TvLayout;
    autoRotateCameras: boolean;
    rotationInterval: number;
    soundAlerts: boolean;
    showAlertPanel: boolean;
    isKiosk: boolean;
    cameraPage: number;
    headerVisible: boolean;
    fullscreenAccepted: boolean;
    theme: TvTheme;
    desktopNotifications: boolean;

    setLayout: (layout: TvLayout) => void;
    setAutoRotate: (enabled: boolean) => void;
    setRotationInterval: (seconds: number) => void;
    setSoundAlerts: (enabled: boolean) => void;
    setShowAlertPanel: (show: boolean) => void;
    setKiosk: (enabled: boolean) => void;
    setCameraPage: (page: number) => void;
    nextCameraPage: (totalCameras: number) => void;
    setHeaderVisible: (visible: boolean) => void;
    setFullscreenAccepted: (accepted: boolean) => void;
    setTheme: (theme: TvTheme) => void;
    setDesktopNotifications: (enabled: boolean) => void;
}

const camerasPerLayout: Record<TvLayout, number> = {
    '3x2': 6,
    '2x2': 4,
    '1+list': 1,
    'map-full': 0,
    'cameras-only': 9,
    'focus': 1,
    '4x4': 16,
};

export const useTvStore = create<TvState>()(
    persist(
        (set, get) => ({
            layout: '3x2',
            autoRotateCameras: false,
            rotationInterval: 15,
            soundAlerts: false,
            showAlertPanel: false,
            isKiosk: false,
            cameraPage: 0,
            headerVisible: true,
            fullscreenAccepted: false,
            theme: 'dark',
            desktopNotifications: false,

            setLayout: (layout) => set({ layout, cameraPage: 0 }),
            setAutoRotate: (enabled) => set({ autoRotateCameras: enabled }),
            setRotationInterval: (seconds) => set({ rotationInterval: seconds }),
            setSoundAlerts: (enabled) => set({ soundAlerts: enabled }),
            setShowAlertPanel: (show) => set({ showAlertPanel: show }),
            setKiosk: (enabled) => set({ isKiosk: enabled }),
            setCameraPage: (page) => set({ cameraPage: page }),
            nextCameraPage: (totalCameras) => {
                const perPage = camerasPerLayout[get().layout] || 6;
                if (perPage === 0 || totalCameras <= perPage) {
                    set({ cameraPage: 0 });
                    return;
                }
                const maxPage = Math.ceil(totalCameras / perPage) - 1;
                const next = get().cameraPage >= maxPage ? 0 : get().cameraPage + 1;
                set({ cameraPage: next });
            },
            setHeaderVisible: (visible) => set({ headerVisible: visible }),
            setFullscreenAccepted: (accepted) => set({ fullscreenAccepted: accepted }),
            setTheme: (theme) => set({ theme }),
            setDesktopNotifications: (enabled) => set({ desktopNotifications: enabled }),
        }),
        {
            name: 'tv-settings',
            partialize: (state) => ({
                layout: state.layout,
                autoRotateCameras: state.autoRotateCameras,
                rotationInterval: state.rotationInterval,
                soundAlerts: state.soundAlerts,
                showAlertPanel: state.showAlertPanel,
                fullscreenAccepted: state.fullscreenAccepted,
                theme: state.theme,
                desktopNotifications: state.desktopNotifications,
            }),
        }
    )
);

export { camerasPerLayout };
