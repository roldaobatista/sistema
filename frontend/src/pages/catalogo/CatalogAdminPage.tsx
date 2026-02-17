import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  ImagePlus,
  Link2,
  Copy,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { catalogApi, getCatalogPublicUrl } from '@/lib/catalog-api'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { Badge } from '@/components/ui/badge'

type Catalog = NonNullable<Awaited<ReturnType<typeof catalogApi.list>>['data']>['data'][number]
type CatalogItem = NonNullable<Awaited<ReturnType<typeof catalogApi.items>>['data']>['data'][number]

export function CatalogAdminPage() {
  const qc = useQueryClient()
  const [selectedCatalog, setSelectedCatalog] = useState<Catalog | null>(null)
  const [showCatalogForm, setShowCatalogForm] = useState(false)
  const [editingCatalog, setEditingCatalog] = useState<Catalog | null>(null)
  const [catalogForm, setCatalogForm] = useState({
    name: '',
    slug: '',
    subtitle: '',
    header_description: '',
    is_published: false,
  })
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null)
  const [itemForm, setItemForm] = useState({ title: '', description: '', service_id: '' })
  const [confirmDelete, setConfirmDelete] = useState<'catalog' | 'item' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Catalog | CatalogItem | null>(null)

  const { data: catalogsRes } = useQuery({
    queryKey: ['catalogs'],
    queryFn: () => catalogApi.list(),
  })
  const catalogs = catalogsRes?.data?.data ?? []

  const { data: itemsRes } = useQuery({
    queryKey: ['catalogs', selectedCatalog?.id, 'items'],
    queryFn: () => catalogApi.items(selectedCatalog!.id),
    enabled: !!selectedCatalog,
  })
  const items = itemsRes?.data?.data ?? []

  const { data: servicesRes } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get('/services', { params: { per_page: 200 } }),
  })
  const services = servicesRes?.data?.data ?? []

  const catalogMut = useMutation({
    mutationFn: (d: typeof catalogForm) =>
      editingCatalog ? catalogApi.update(editingCatalog.id, d) : catalogApi.store(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogs'] })
      setShowCatalogForm(false)
      setEditingCatalog(null)
      toast.success(editingCatalog ? 'Catálogo atualizado!' : 'Catálogo criado!')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Erro ao salvar catálogo'),
  })

  const deleteCatalogMut = useMutation({
    mutationFn: (id: number) => catalogApi.destroy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogs'] })
      setConfirmDelete(null)
      setDeleteTarget(null)
      if (selectedCatalog && deleteTarget && 'slug' in deleteTarget && selectedCatalog.id === deleteTarget.id) {
        setSelectedCatalog(null)
      }
      toast.success('Catálogo excluído!')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Erro ao excluir'),
  })

  const itemMut = useMutation({
    mutationFn: (d: typeof itemForm & { sort_order?: number }) => {
      const payload = {
        ...d,
        service_id: d.service_id ? parseInt(d.service_id, 10) : null,
      }
      return editingItem
        ? catalogApi.updateItem(selectedCatalog!.id, editingItem.id, payload)
        : catalogApi.storeItem(selectedCatalog!.id, {
          ...payload,
          sort_order: items.length,
        })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogs', selectedCatalog?.id, 'items'] })
      setShowItemForm(false)
      setEditingItem(null)
      toast.success(editingItem ? 'Item atualizado!' : 'Item adicionado!')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Erro ao salvar item'),
  })

  const deleteItemMut = useMutation({
    mutationFn: (itemId: number) => catalogApi.destroyItem(selectedCatalog!.id, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogs', selectedCatalog?.id, 'items'] })
      setConfirmDelete(null)
      setDeleteTarget(null)
      toast.success('Item excluído!')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Erro ao excluir'),
  })

  const uploadImageMut = useMutation({
    mutationFn: ({ itemId, file }: { itemId: number; file: File }) =>
      catalogApi.uploadImage(selectedCatalog!.id, itemId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogs', selectedCatalog?.id, 'items'] })
      toast.success('Imagem atualizada!')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Erro ao enviar imagem'),
  })

  const reorderMut = useMutation({
    mutationFn: (itemIds: number[]) => catalogApi.reorderItems(selectedCatalog!.id, itemIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogs', selectedCatalog?.id, 'items'] })
    },
  })

  const openCatalogForm = (c?: Catalog) => {
    setEditingCatalog(c ?? null)
    setCatalogForm({
      name: c?.name ?? '',
      slug: c?.slug ?? '',
      subtitle: c?.subtitle ?? '',
      header_description: c?.header_description ?? '',
      is_published: c?.is_published ?? false,
    })
    setShowCatalogForm(true)
  }

  const openItemForm = (item?: CatalogItem) => {
    setEditingItem(item ?? null)
    setItemForm({
      title: item?.title ?? '',
      description: item?.description ?? '',
      service_id: item?.service_id?.toString() ?? '',
    })
    setShowItemForm(true)
  }

  const copyLink = (slug: string) => {
    const url = getCatalogPublicUrl(slug)
    navigator.clipboard.writeText(url)
    toast.success('Link copiado!')
  }

  const moveItem = (index: number, dir: 'up' | 'down') => {
    const arr = [...items]
    const j = dir === 'up' ? index - 1 : index + 1
    if (j < 0 || j >= arr.length) return
      ;[arr[index], arr[j]] = [arr[j], arr[index]]
    reorderMut.mutate(arr.map((i) => i.id))
  }

  const formatBRL = (v: string) =>
    parseFloat(v || '0').toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="flex h-[calc(100vh-var(--topbar-height,52px))] overflow-hidden">
      <div className="w-72 shrink-0 border-r border-default bg-surface-50 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-surface-900">Catálogos</h2>
          <Button size="sm" variant="ghost" onClick={() => openCatalogForm()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {catalogs.length === 0 ? (
            <p className="text-sm text-surface-500 py-4">Nenhum catálogo. Crie o primeiro.</p>
          ) : (
            catalogs.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCatalog(c)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${selectedCatalog?.id === c.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-surface-100 text-surface-700'
                  }`}
              >
                <span className="truncate">{c.name}</span>
                <div className="flex items-center shrink-0 gap-1">
                  <Badge variant="neutral" className="text-xs">
                    {c.items_count ?? 0}
                  </Badge>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!selectedCatalog ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <BookOpen className="h-16 w-16 text-surface-300 mb-4" />
            <h3 className="text-lg font-medium text-surface-700">Selecione um catálogo</h3>
            <p className="text-sm text-surface-500 mt-1">
              Ou crie um novo para começar a adicionar serviços e fotos.
            </p>
            <Button className="mt-4" onClick={() => openCatalogForm()}>
              <Plus className="h-4 w-4 mr-2" /> Novo catálogo
            </Button>
          </div>
        ) : (
          <div className="max-w-3xl space-y-6">
            <PageHeader
              title={selectedCatalog.name}
              subtitle={selectedCatalog.subtitle ?? `/${selectedCatalog.slug}`}
              actions={[
                {
                  label: 'Editar catálogo',
                  onClick: () => openCatalogForm(selectedCatalog),
                  icon: <Pencil className="h-4 w-4" />,
                },
                {
                  label: 'Copiar link',
                  onClick: () => copyLink(selectedCatalog.slug),
                  icon: <Link2 className="h-4 w-4" />,
                },
                {
                  label: 'Adicionar item',
                  onClick: () => openItemForm(),
                  icon: <Plus className="h-4 w-4" />,
                },
              ]}
            />

            <div className="rounded-lg border border-default bg-surface-0 p-4">
              <p className="text-sm text-surface-600 mb-2">Link para compartilhar com clientes:</p>
              <div className="flex gap-2">
                <code className="flex-1 rounded bg-surface-50 px-3 py-2 text-xs text-surface-700 truncate">
                  {getCatalogPublicUrl(selectedCatalog.slug)}
                </code>
                <Button size="sm" variant="outline" onClick={() => copyLink(selectedCatalog.slug)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {!selectedCatalog.is_published && (
                <p className="mt-2 text-xs text-amber-600">
                  O catálogo está como rascunho. Publique para clientes acessarem.
                </p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-surface-700 mb-3">Itens do catálogo</h3>
              {items.length === 0 ? (
                <EmptyState
                  icon={<ImagePlus className="h-10 w-10 text-surface-300" />}
                  message="Nenhum item ainda"
                  action={{ label: 'Adicionar item', onClick: () => openItemForm(), icon: <Plus className="h-4 w-4" /> }}
                />
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border border-default bg-surface-0 p-3 hover:border-surface-300 transition-colors"
                    >
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveItem(idx, 'up')}
                          disabled={idx === 0 || reorderMut.isPending}
                          className="p-0.5 text-surface-400 hover:text-surface-600 disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(idx, 'down')}
                          disabled={idx === items.length - 1 || reorderMut.isPending}
                          className="p-0.5 text-surface-400 hover:text-surface-600 disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </div>
                      <div className="h-16 w-24 shrink-0 rounded-lg bg-surface-100 overflow-hidden flex items-center justify-center">
                        {item.image_url ? (
                          <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <ImagePlus className="h-6 w-6 text-surface-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-surface-900 truncate">{item.title}</p>
                        {item.service && (
                          <p className="text-xs text-surface-500">
                            {item.service.name} · {formatBRL(item.service.default_price)}
                          </p>
                        )}
                      </div>
                      <label className="cursor-pointer" aria-label="Enviar imagem">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          aria-label="Selecionar imagem"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) uploadImageMut.mutate({ itemId: item.id, file: f })
                          }}
                        />
                        <Button size="sm" variant="outline" asChild>
                          <span>
                            {item.image_url ? 'Trocar' : 'Foto'}
                          </span>
                        </Button>
                      </label>
                      <Button size="sm" variant="ghost" onClick={() => openItemForm(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setConfirmDelete('item')
                          setDeleteTarget(item)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal open={showCatalogForm} onOpenChange={setShowCatalogForm} title={editingCatalog ? 'Editar catálogo' : 'Novo catálogo'} size="lg">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            catalogMut.mutate(catalogForm)
          }}
          className="space-y-4"
        >
          <Input
            label="Nome"
            value={catalogForm.name}
            onChange={(e) => setCatalogForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <Input
            label="Slug (URL)"
            value={catalogForm.slug}
            onChange={(e) => setCatalogForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
            placeholder="ex: meus-servicos"
          />
          <Input
            label="Subtítulo"
            value={catalogForm.subtitle}
            onChange={(e) => setCatalogForm((p) => ({ ...p, subtitle: e.target.value }))}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-700">Descrição do cabeçalho</label>
            <textarea
              aria-label="Descrição do cabeçalho"
              value={catalogForm.header_description}
              onChange={(e) => setCatalogForm((p) => ({ ...p, header_description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm"
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={catalogForm.is_published}
              onChange={(e) => setCatalogForm((p) => ({ ...p, is_published: e.target.checked }))}
              aria-label="Publicado (visível para clientes)"
            />
            <span className="text-sm text-surface-700">Publicado (visível para clientes)</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowCatalogForm(false)}>Cancelar</Button>
            <Button type="submit" loading={catalogMut.isPending}>Salvar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showItemForm} onOpenChange={setShowItemForm} title={editingItem ? 'Editar item' : 'Novo item'} size="lg">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            itemMut.mutate(itemForm)
          }}
          className="space-y-4"
        >
          <Input
            label="Título"
            value={itemForm.title}
            onChange={(e) => setItemForm((p) => ({ ...p, title: e.target.value }))}
            required
          />
          <div>
            <label htmlFor="item-service-select" className="mb-1.5 block text-sm font-medium text-surface-700">Serviço vinculado (opcional)</label>
            <select
              id="item-service-select"
              value={itemForm.service_id}
              onChange={(e) => setItemForm((p) => ({ ...p, service_id: e.target.value }))}
              className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm"
              aria-label="Serviço vinculado"
            >
              <option value="">Nenhum</option>
              {services.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatBRL(s.default_price)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-700">Descrição</label>
            <textarea
              aria-label="Descrição do item"
              value={itemForm.description}
              onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowItemForm(false)}>Cancelar</Button>
            <Button type="submit" loading={itemMut.isPending}>Salvar</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onOpenChange={() => {
          setConfirmDelete(null)
          setDeleteTarget(null)
        }}
        title={confirmDelete === 'catalog' ? 'Excluir catálogo?' : 'Excluir item?'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-600">
            {confirmDelete === 'catalog' && deleteTarget && 'slug' in deleteTarget
              ? `O catálogo "${deleteTarget.name}" e todos os itens serão excluídos.`
              : 'O item será removido do catálogo.'}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              loading={deleteCatalogMut.isPending || deleteItemMut.isPending}
              onClick={() => {
                if (!deleteTarget) return
                if (confirmDelete === 'catalog' && 'id' in deleteTarget) {
                  deleteCatalogMut.mutate(deleteTarget.id)
                } else if (confirmDelete === 'item' && 'id' in deleteTarget) {
                  deleteItemMut.mutate(deleteTarget.id)
                }
              }}
            >
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
