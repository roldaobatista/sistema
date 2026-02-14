import { useState, useCallback, useRef, useEffect } from 'react'

interface VoiceToTextState {
    isListening: boolean
    transcript: string
    interimTranscript: string
    isSupported: boolean
    error: string | null
    language: string
}

export function useVoiceToText(lang = 'pt-BR') {
    const [state, setState] = useState<VoiceToTextState>({
        isListening: false,
        transcript: '',
        interimTranscript: '',
        isSupported: typeof window !== 'undefined'
            && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
        error: null,
        language: lang,
    })

    const recognitionRef = useRef<any>(null)

    const getRecognition = useCallback(() => {
        if (recognitionRef.current) return recognitionRef.current

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognition) return null

        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = lang
        recognition.maxAlternatives = 1

        recognition.onresult = (event: any) => {
            let interim = ''
            let final = ''

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i]
                if (result.isFinal) {
                    final += result[0].transcript + ' '
                } else {
                    interim += result[0].transcript
                }
            }

            setState(s => ({
                ...s,
                transcript: s.transcript + final,
                interimTranscript: interim,
            }))
        }

        recognition.onerror = (event: any) => {
            if (event.error !== 'aborted') {
                setState(s => ({
                    ...s,
                    error: event.error === 'not-allowed'
                        ? 'Permissão de microfone negada'
                        : `Erro de reconhecimento: ${event.error}`,
                    isListening: false,
                }))
            }
        }

        recognition.onend = () => {
            setState(s => ({
                ...s,
                isListening: false,
                interimTranscript: '',
            }))
        }

        recognitionRef.current = recognition
        return recognition
    }, [lang])

    const startListening = useCallback(() => {
        const recognition = getRecognition()
        if (!recognition) {
            setState(s => ({ ...s, error: 'Reconhecimento de voz não suportado' }))
            return
        }

        setState(s => ({ ...s, error: null, isListening: true }))

        try {
            recognition.start()
        } catch {
            // Already started — ignore
        }
    }, [getRecognition])

    const stopListening = useCallback(() => {
        const recognition = recognitionRef.current
        if (recognition) {
            recognition.stop()
        }
        setState(s => ({ ...s, isListening: false }))
    }, [])

    const clearTranscript = useCallback(() => {
        setState(s => ({ ...s, transcript: '', interimTranscript: '' }))
    }, [])

    const appendText = useCallback((text: string) => {
        setState(s => ({ ...s, transcript: s.transcript + text }))
    }, [])

    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop()
                recognitionRef.current = null
            }
        }
    }, [])

    return {
        ...state,
        startListening,
        stopListening,
        clearTranscript,
        appendText,
    }
}
