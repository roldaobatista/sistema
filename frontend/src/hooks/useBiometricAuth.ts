import { useState, useCallback } from 'react'

interface BiometricState {
    isSupported: boolean
    isRegistered: boolean
    isAuthenticating: boolean
    error: string | null
}

const CREDENTIAL_STORAGE_KEY = 'biometric_credential_id'

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes.buffer
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
}

export function useBiometricAuth() {
    const [state, setState] = useState<BiometricState>(() => ({
        isSupported: typeof window !== 'undefined'
            && !!window.PublicKeyCredential
            && !!navigator.credentials,
        isRegistered: !!localStorage.getItem(CREDENTIAL_STORAGE_KEY),
        isAuthenticating: false,
        error: null,
    }))

    const register = useCallback(async (userId: string, userName: string) => {
        if (!state.isSupported) {
            setState(s => ({ ...s, error: 'WebAuthn não suportado neste dispositivo' }))
            return false
        }

        setState(s => ({ ...s, isAuthenticating: true, error: null }))

        try {
            const challenge = crypto.getRandomValues(new Uint8Array(32))

            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge,
                    rp: {
                        name: 'Kalibrium',
                        id: window.location.hostname,
                    },
                    user: {
                        id: new TextEncoder().encode(userId),
                        name: userName,
                        displayName: userName,
                    },
                    pubKeyCredParams: [
                        { alg: -7, type: 'public-key' },   // ES256
                        { alg: -257, type: 'public-key' },  // RS256
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'required',
                        residentKey: 'preferred',
                    },
                    timeout: 60_000,
                    attestation: 'none',
                },
            }) as PublicKeyCredential

            const credentialId = arrayBufferToBase64(credential.rawId)
            localStorage.setItem(CREDENTIAL_STORAGE_KEY, credentialId)

            setState(s => ({ ...s, isRegistered: true, isAuthenticating: false }))
            return true
        } catch (err: any) {
            setState(s => ({
                ...s,
                isAuthenticating: false,
                error: err.name === 'NotAllowedError'
                    ? 'Autenticação cancelada pelo usuário'
                    : err.message || 'Erro ao registrar biometria',
            }))
            return false
        }
    }, [state.isSupported])

    const authenticate = useCallback(async () => {
        const credentialId = localStorage.getItem(CREDENTIAL_STORAGE_KEY)
        if (!credentialId || !state.isSupported) {
            setState(s => ({ ...s, error: 'Biometria não configurada' }))
            return false
        }

        setState(s => ({ ...s, isAuthenticating: true, error: null }))

        try {
            const challenge = crypto.getRandomValues(new Uint8Array(32))

            await navigator.credentials.get({
                publicKey: {
                    challenge,
                    allowCredentials: [{
                        id: base64ToArrayBuffer(credentialId),
                        type: 'public-key',
                        transports: ['internal'],
                    }],
                    userVerification: 'required',
                    timeout: 60_000,
                },
            })

            setState(s => ({ ...s, isAuthenticating: false }))
            return true
        } catch (err: any) {
            setState(s => ({
                ...s,
                isAuthenticating: false,
                error: err.name === 'NotAllowedError'
                    ? 'Autenticação cancelada'
                    : err.message || 'Falha na autenticação biométrica',
            }))
            return false
        }
    }, [state.isSupported])

    const unregister = useCallback(() => {
        localStorage.removeItem(CREDENTIAL_STORAGE_KEY)
        setState(s => ({ ...s, isRegistered: false }))
    }, [])

    return {
        ...state,
        register,
        authenticate,
        unregister,
    }
}
