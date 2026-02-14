export {}

declare global {
    interface BluetoothRemoteGATTCharacteristic {
        properties: {
            write: boolean
            writeWithoutResponse: boolean
        }
        writeValue(data: BufferSource): Promise<void>
        writeValueWithoutResponse(data: BufferSource): Promise<void>
    }

    interface BluetoothRemoteGATTService {
        getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>
    }

    interface BluetoothRemoteGATTServer {
        connected: boolean
        connect(): Promise<BluetoothRemoteGATTServer>
        disconnect(): void
        getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>
    }

    interface BluetoothDevice extends EventTarget {
        name?: string
        gatt?: BluetoothRemoteGATTServer
        addEventListener(
            type: 'gattserverdisconnected',
            listener: EventListenerOrEventListenerObject
        ): void
    }

    interface RequestDeviceFilter {
        services?: string[]
        name?: string
        namePrefix?: string
    }

    interface RequestDeviceOptions {
        filters?: RequestDeviceFilter[]
        optionalServices?: string[]
        acceptAllDevices?: boolean
    }

    interface Bluetooth {
        requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>
    }

    interface Navigator {
        bluetooth: Bluetooth
    }

    interface SyncManager {
        register(tag: string): Promise<void>
    }

    interface ServiceWorkerRegistration {
        sync: SyncManager
    }
}
