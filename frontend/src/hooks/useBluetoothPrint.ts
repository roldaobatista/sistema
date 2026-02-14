import { useState, useCallback, useRef } from 'react'

interface BluetoothPrintState {
    isSupported: boolean
    isConnected: boolean
    isConnecting: boolean
    isPrinting: boolean
    deviceName: string | null
    error: string | null
}

const ESC_POS = {
    INIT: '\x1B\x40',
    BOLD_ON: '\x1B\x45\x01',
    BOLD_OFF: '\x1B\x45\x00',
    ALIGN_CENTER: '\x1B\x61\x01',
    ALIGN_LEFT: '\x1B\x61\x00',
    LINE_FEED: '\x0A',
    CUT: '\x1D\x56\x00',
    FONT_NORMAL: '\x1B\x4D\x00',
    FONT_SMALL: '\x1B\x4D\x01',
    SEPARATOR: '--------------------------------',
}

export function useBluetoothPrint() {
    const [state, setState] = useState<BluetoothPrintState>({
        isSupported: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
        isConnected: false,
        isConnecting: false,
        isPrinting: false,
        deviceName: null,
        error: null,
    })

    const deviceRef = useRef<BluetoothDevice | null>(null)
    const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)

    const connect = useCallback(async () => {
        if (!state.isSupported) {
            setState(s => ({ ...s, error: 'Bluetooth não suportado neste navegador' }))
            return false
        }

        setState(s => ({ ...s, isConnecting: true, error: null }))

        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
                    { namePrefix: 'Printer' },
                    { namePrefix: 'BT' },
                    { namePrefix: 'MTP' },
                ],
                optionalServices: [
                    '000018f0-0000-1000-8000-00805f9b34fb',
                    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
                    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
                ],
            })

            deviceRef.current = device

            device.addEventListener('gattserverdisconnected', () => {
                setState(s => ({ ...s, isConnected: false, deviceName: null }))
                characteristicRef.current = null
            })

            const server = await device.gatt!.connect()

            // Try common printer services
            const serviceUUIDs = [
                '000018f0-0000-1000-8000-00805f9b34fb',
                '49535343-fe7d-4ae5-8fa9-9fafd205e455',
                'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
            ]

            let characteristic: BluetoothRemoteGATTCharacteristic | null = null

            for (const uuid of serviceUUIDs) {
                try {
                    const service = await server.getPrimaryService(uuid)
                    const chars = await service.getCharacteristics()
                    const writable = chars.find(c =>
                        c.properties.write || c.properties.writeWithoutResponse
                    )
                    if (writable) {
                        characteristic = writable
                        break
                    }
                } catch { /* Try next service */ }
            }

            if (!characteristic) {
                throw new Error('Nenhuma característica de escrita encontrada na impressora')
            }

            characteristicRef.current = characteristic

            setState(s => ({
                ...s,
                isConnected: true,
                isConnecting: false,
                deviceName: device.name || 'Impressora BT',
            }))

            return true
        } catch (err: any) {
            setState(s => ({
                ...s,
                isConnecting: false,
                error: err.name === 'NotFoundError'
                    ? 'Nenhuma impressora selecionada'
                    : err.message || 'Falha ao conectar',
            }))
            return false
        }
    }, [state.isSupported])

    const disconnect = useCallback(async () => {
        if (deviceRef.current?.gatt?.connected) {
            deviceRef.current.gatt.disconnect()
        }
        deviceRef.current = null
        characteristicRef.current = null
        setState(s => ({ ...s, isConnected: false, deviceName: null }))
    }, [])

    const sendRaw = useCallback(async (data: string) => {
        if (!characteristicRef.current) {
            setState(s => ({ ...s, error: 'Impressora não conectada' }))
            return false
        }

        const encoder = new TextEncoder()
        const bytes = encoder.encode(data)

        // Send in chunks (BLE max is ~512 bytes per write)
        const CHUNK = 256
        for (let i = 0; i < bytes.length; i += CHUNK) {
            const chunk = bytes.slice(i, i + CHUNK)
            if (characteristicRef.current.properties.writeWithoutResponse) {
                await characteristicRef.current.writeValueWithoutResponse(chunk)
            } else {
                await characteristicRef.current.writeValue(chunk)
            }
        }

        return true
    }, [])

    const printReceipt = useCallback(async (lines: {
        title: string
        items: Array<{ label: string; value: string }>
        footer?: string
    }) => {
        setState(s => ({ ...s, isPrinting: true, error: null }))
        try {
            let content = ESC_POS.INIT
            content += ESC_POS.ALIGN_CENTER
            content += ESC_POS.BOLD_ON
            content += lines.title + ESC_POS.LINE_FEED
            content += ESC_POS.BOLD_OFF
            content += ESC_POS.SEPARATOR + ESC_POS.LINE_FEED
            content += ESC_POS.ALIGN_LEFT
            content += ESC_POS.FONT_SMALL

            for (const item of lines.items) {
                const padded = item.label.padEnd(20) + item.value
                content += padded + ESC_POS.LINE_FEED
            }

            content += ESC_POS.SEPARATOR + ESC_POS.LINE_FEED

            if (lines.footer) {
                content += ESC_POS.ALIGN_CENTER
                content += lines.footer + ESC_POS.LINE_FEED
            }

            content += ESC_POS.LINE_FEED.repeat(3)
            content += ESC_POS.CUT

            await sendRaw(content)
            setState(s => ({ ...s, isPrinting: false }))
            return true
        } catch (err: any) {
            setState(s => ({ ...s, isPrinting: false, error: err.message || 'Erro ao imprimir' }))
            return false
        }
    }, [sendRaw])

    return {
        ...state,
        connect,
        disconnect,
        sendRaw,
        printReceipt,
    }
}
