import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Scale, AlertTriangle } from 'lucide-react'

interface CatalogData {
  catalog: { id: number; name: string; slug: string; subtitle: string | null; header_description: string | null }
  tenant: { name: string } | null
  items: Array<{
    id: number
    title: string
    description: string | null
    image_url: string | null
    service?: { id: number; name: string; code: string | null; default_price: string }
  }>
}

function formatBRL(v: string) {
  return parseFloat(v || '0').toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function CatalogPublicPage() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<CatalogData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    const base = (import.meta.env.VITE_API_URL || '').trim() || '/api/v1'
    const url = `${base.replace(/\/$/, '')}/catalog/${slug}`
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('Catálogo não encontrado')
        return r.json()
      })
      .then(setData)
      .catch(() => setError('Este catálogo não existe ou ainda não foi publicado.'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
          <p className="text-sm text-stone-500">Carregando catálogo...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <div className="max-w-md w-full rounded-2xl bg-white p-8 shadow-sm border border-stone-200 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h1 className="mt-4 text-xl font-semibold text-stone-900">Não encontrado</h1>
          <p className="mt-2 text-stone-600">{error}</p>
        </div>
      </div>
    )
  }

  const { catalog, tenant, items } = data

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200/80 bg-white/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-stone-900">
                {catalog.name}
              </h1>
              {catalog.subtitle && (
                <p className="mt-0.5 text-stone-500 text-sm">{catalog.subtitle}</p>
              )}
              {tenant && (
                <p className="mt-1 text-xs text-stone-400">{tenant.name}</p>
              )}
            </div>
            <Scale className="hidden sm:block h-8 w-8 text-stone-300" aria-hidden />
          </div>
          {catalog.header_description && (
            <p className="mt-4 text-stone-600 text-sm leading-relaxed max-w-2xl">
              {catalog.header_description}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
            <p className="text-stone-500">Este catálogo ainda não possui itens.</p>
          </div>
        ) : (
          <div className="grid gap-8 sm:gap-12">
            {items.map((item, idx) => (
              <article
                key={item.id}
                className="group rounded-2xl overflow-hidden bg-white border border-stone-200/80 shadow-sm hover:shadow-md transition-shadow duration-300"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-[42%] aspect-[4/3] sm:aspect-square bg-stone-100 relative overflow-hidden shrink-0">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Scale className="h-12 w-12 text-stone-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-6 sm:p-8 flex flex-col justify-center">
                    <h2 className="text-xl sm:text-2xl font-semibold text-stone-900 tracking-tight">
                      {item.title}
                    </h2>
                    {item.description && (
                      <p className="mt-3 text-stone-600 text-sm leading-relaxed">
                        {item.description}
                      </p>
                    )}
                    {item.service && (
                      <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wider text-stone-400 font-medium">
                          {item.service.code ? `#${item.service.code}` : 'Serviço'}
                        </span>
                        <span className="text-base font-semibold text-stone-800 tabular-nums">
                          {formatBRL(item.service.default_price)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <footer className="mt-16 pt-8 border-t border-stone-200/80 text-center text-xs text-stone-400">
          Catálogo gerado automaticamente
        </footer>
      </main>
    </div>
  )
}
