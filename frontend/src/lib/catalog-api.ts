import api from './api'
import { getApiOrigin } from './api'

export interface Catalog {
  id: number
  name: string
  slug: string
  subtitle: string | null
  header_description: string | null
  is_published: boolean
  items_count?: number
}

export interface CatalogItem {
  id: number
  service_catalog_id: number
  service_id: number | null
  title: string
  description: string | null
  image_path: string | null
  image_url: string | null
  sort_order: number
  service?: { id: number; name: string; code: string | null; default_price: string }
}

export interface PublicCatalogResponse {
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

export const catalogApi = {
  list: () => api.get<{ data: Catalog[] }>('/catalogs'),
  show: (id: number) => api.get<Catalog>(`/catalogs/${id}`),
  store: (data: Partial<Catalog>) => api.post<Catalog>('/catalogs', data),
  update: (id: number, data: Partial<Catalog>) => api.put<Catalog>(`/catalogs/${id}`, data),
  destroy: (id: number) => api.delete(`/catalogs/${id}`),
  items: (catalogId: number) => api.get<{ data: CatalogItem[] }>(`/catalogs/${catalogId}/items`),
  storeItem: (catalogId: number, data: Partial<CatalogItem>) =>
    api.post<CatalogItem>(`/catalogs/${catalogId}/items`, data),
  updateItem: (catalogId: number, itemId: number, data: Partial<CatalogItem>) =>
    api.put<CatalogItem>(`/catalogs/${catalogId}/items/${itemId}`, data),
  destroyItem: (catalogId: number, itemId: number) =>
    api.delete(`/catalogs/${catalogId}/items/${itemId}`),
  uploadImage: (catalogId: number, itemId: number, file: File) => {
    const fd = new FormData()
    fd.append('image', file)
    return api.post<{ image_url: string }>(`/catalogs/${catalogId}/items/${itemId}/image`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  reorderItems: (catalogId: number, itemIds: number[]) =>
    api.post<{ data: CatalogItem[] }>(`/catalogs/${catalogId}/reorder`, { item_ids: itemIds }),
}

export function getCatalogPublicUrl(slug: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : getApiOrigin()
  return `${base}/catalogo/${slug}`
}
