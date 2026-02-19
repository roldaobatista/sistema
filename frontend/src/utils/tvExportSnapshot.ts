import html2canvas from 'html2canvas';

/**
 * Captures the TV dashboard as PNG and triggers a browser download.
 */
export async function exportTvSnapshot(elementId = 'tv-dashboard-root') {
    const el = document.getElementById(elementId);
    if (!el) {
        console.warn('[TV Export] Element not found:', elementId);
        return;
    }

    try {
        const canvas = await html2canvas(el, {
            backgroundColor: '#0a0a0a',
            scale: 2,
            useCORS: true,
            logging: false,
            ignoreElements: (node) => {
                // Skip settings/popup overlays
                return node.classList?.contains('z-40') ?? false;
            },
        });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const link = document.createElement('a');
        link.download = `tv-dashboard-${timestamp}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error('[TV Export] Failed to capture:', err);
    }
}
