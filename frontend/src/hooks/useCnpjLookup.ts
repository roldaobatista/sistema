import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import api from '@/lib/api'

export interface CnpjResult {
    name: string
    trade_name: string
    email: string
    phone: string
    address_zip: string
    address_street: string
    address_number: string
    address_complement: string
    address_neighborhood: string
    address_city: string
    address_state: string
    codigo_municipio_ibge?: number
    state_registration: string
    city_registration: string
    status: string
    main_activity: string
    company_size: string
}

function normalizeBackendResponse(data: any): CnpjResult {
    return {
        name: data.name ?? '',
        trade_name: data.trade_name ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        address_zip: data.address_zip ?? '',
        address_street: data.address_street ?? '',
        address_number: data.address_number ?? '',
        address_complement: data.address_complement ?? '',
        address_neighborhood: data.address_neighborhood ?? '',
        address_city: data.address_city ?? '',
        address_state: data.address_state ?? '',
        codigo_municipio_ibge: data.codigo_municipio_ibge,
        state_registration: data.state_registration ?? '',
        city_registration: data.city_registration ?? '',
        status: data.status ?? data.company_status ?? '',
        main_activity: data.main_activity ?? data.cnae_description ?? '',
        company_size: data.company_size ?? '',
    }
}

function normalizeBrasilApiResponse(raw: any): CnpjResult {
    const street = [raw.descricao_tipo_de_logradouro, raw.logradouro]
        .filter(Boolean).join(' ').trim()

    return {
        name: raw.razao_social ?? '',
        trade_name: raw.nome_fantasia ?? '',
        email: raw.email ?? '',
        phone: raw.ddd_telefone_1 ?? '',
        address_zip: raw.cep ?? '',
        address_street: street,
        address_number: raw.numero ?? '',
        address_complement: raw.complemento ?? '',
        address_neighborhood: raw.bairro ?? '',
        address_city: raw.municipio ?? '',
        address_state: raw.uf ?? '',
        codigo_municipio_ibge: raw.codigo_municipio_ibge,
        state_registration: raw.inscricao_estadual ?? raw.estadual ?? '',
        city_registration: raw.inscricao_municipal ?? raw.municipal ?? '',
        status: raw.descricao_situacao_cadastral ?? '',
        main_activity: raw.cnae_fiscal_descricao ?? '',
        company_size: raw.porte ?? raw.descricao_porte ?? '',
    }
}

async function resolveCityNameByIbge(uf: string, codigoIbge: number): Promise<string | null> {
    try {
        const { data } = await api.get<Array<{ id: number; name: string }>>(`/external/states/${uf}/cities`)
        const city = data?.find((c: any) => c.id === codigoIbge)
        return city?.name ?? null
    } catch {
        try {
            const res = await fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`, {
                signal: AbortSignal.timeout(8000),
            })
            if (!res.ok) return null
            const cities = (await res.json()) as Array<{ id?: number; codigo_ibge?: string; nome?: string; name?: string }>
            const city = cities?.find(
                (c: any) =>
                    Number(c.codigo_ibge) === codigoIbge ||
                    c.id === codigoIbge ||
                    String(c.codigo_ibge) === String(codigoIbge),
            )
            return city?.nome ?? city?.name ?? null
        } catch {
            return null
        }
    }
}

async function fetchDirectFromBrasilApi(cnpj: string): Promise<CnpjResult | null> {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
        signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const raw = await res.json()
    if (!raw || raw.message) return null
    return normalizeBrasilApiResponse(raw)
}

export function useCnpjLookup() {
    const [loading, setLoading] = useState(false)

    const lookup = useCallback(async (cnpj: string): Promise<CnpjResult | null> => {
        const clean = cnpj.replace(/\D/g, '')
        if (clean.length !== 14) return null

        setLoading(true)
        try {
            let result: CnpjResult | null = null
            try {
                const { data } = await api.get(`/external/cnpj/${clean}`)
                result = normalizeBackendResponse(data)
            } catch {
                const direct = await fetchDirectFromBrasilApi(clean)
                result = direct
            }

            if (!result) {
                toast.error('CNPJ não encontrado. Verifique os dígitos e tente novamente.')
                return null
            }

            if (result.codigo_municipio_ibge && result.address_state) {
                const resolvedCity = await resolveCityNameByIbge(
                    result.address_state,
                    result.codigo_municipio_ibge,
                )
                if (resolvedCity) result.address_city = resolvedCity
            }

            return result
        } catch {
            toast.error('CNPJ não encontrado. Verifique os dígitos e tente novamente.')
            return null
        } finally {
            setLoading(false)
        }
    }, [])

    return { lookup, loading }
}
