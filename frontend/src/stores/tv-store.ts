import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TvLayout } from '@/types/tv';

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
            }),
        }
    )
);

export { camerasPerLayout };
