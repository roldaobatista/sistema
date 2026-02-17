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
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-300 border-t-surface-600" />
          <p className="text-sm text-surface-500">Carregando catálogo...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 p-4">
        <div className="max-w-md w-full rounded-2xl bg-surface-0 p-8 shadow-sm border border-surface-200 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h1 className="mt-4 text-xl font-semibold text-surface-900">Não encontrado</h1>
          <p className="mt-2 text-surface-600">{error}</p>
        </div>
      </div>
    )
  }

  const { catalog, tenant, items } = data

  return (
    <div className="min-h-screen bg-surface-50">
      <header className="border-b border-surface-200/80 dark:border-surface-700 bg-surface-0/90 dark:bg-surface-900/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-surface-900">
                {catalog.name}
              </h1>
              {catalog.subtitle && (
                <p className="mt-0.5 text-surface-500 text-sm">{catalog.subtitle}</p>
              )}
              {tenant && (
                <p className="mt-1 text-xs text-surface-400">{tenant.name}</p>
              )}
            </div>
            <Scale className="hidden sm:block h-8 w-8 text-surface-300" aria-hidden />
          </div>
          {catalog.header_description && (
            <p className="mt-4 text-surface-600 text-sm leading-relaxed max-w-2xl">
              {catalog.header_description}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-surface-200 bg-surface-0 p-12 text-center">
            <p className="text-surface-500">Este catálogo ainda não possui itens.</p>
          </div>
        ) : (
          <div className="grid gap-8 sm:gap-12">
            {items.map((item, idx) => (
              <article
                key={item.id}
                className="group rounded-2xl overflow-hidden bg-surface-0 border border-surface-200/80 dark:border-surface-700 shadow-sm hover:shadow-md transition-shadow duration-300"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-[42%] aspect-[4/3] sm:aspect-square bg-surface-100 relative overflow-hidden shrink-0">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Scale className="h-12 w-12 text-surface-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-6 sm:p-8 flex flex-col justify-center">
                    <h2 className="text-xl sm:text-2xl font-semibold text-surface-900 tracking-tight">
                      {item.title}
                    </h2>
                    {item.description && (
                      <p className="mt-3 text-surface-600 text-sm leading-relaxed">
                        {item.description}
                      </p>
                    )}
                    {item.service && (
                      <div className="mt-4 pt-4 border-t border-surface-100 flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wider text-surface-400 font-medium">
                          {item.service.code ? `#${item.service.code}` : 'Serviço'}
                        </span>
                        <span className="text-base font-semibold text-surface-800 tabular-nums">
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

        <footer className="mt-16 pt-8 border-t border-surface-200/80 dark:border-surface-700 text-center text-xs text-surface-400">
          Catálogo gerado automaticamente
        </footer>
      </main>
    </div>
  )
}
