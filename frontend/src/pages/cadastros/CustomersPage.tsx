import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Users, Search, X, Star, Heart, Building2, User, ChevronLeft, ChevronRight, UploadCloud, FileText, MapPin, Loader2, CheckCircle2, Zap, Sprout, Briefcase, DollarSign, AlertTriangle, Sparkles } from 'lucide-react'
import api from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/iconbutton'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAuvoExport } from '@/hooks/useAuvoExport'

// â”€â”€â”€ Masks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function maskCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface Contact { id?: number; name: string; role: string; phone: string; email: string; is_primary: boolean }
interface Partner { name: string | null; role: string | null; document: string | null; entry_date?: string | null; share_percentage?: number | null }
interface CnaeEntry { code: string; description: string | null }
interface DeleteDependencies {
  active_work_orders?: boolean
  receivables?: boolean
  quotes?: number
  deals?: number
}
interface CustomerForm {
  type: 'PF' | 'PJ'
  name: string
  trade_name: string
  document: string
  email: string
  phone: string
  phone2: string
  notes: string
  is_active: boolean
  // Address
  address_zip: string
  address_street: string
  address_number: string
  address_complement: string
  address_neighborhood: string
  address_city: string
  address_state: string
  latitude: string
  longitude: string
  google_maps_link: string
  // Enrichment
  state_registration: string
  municipal_registration: string
  cnae_code: string
  cnae_description: string
  legal_nature: string
  capital: string
  simples_nacional: boolean | null
  mei: boolean | null
  company_status: string
  opened_at: string
  is_rural_producer: boolean
  partners: Partner[]
  secondary_activities: CnaeEntry[]
  // CRM
  source: string
  segment: string
  company_size: string
  rating: string
  assigned_seller_id: string
  // Contacts
  contacts: Contact[]
}

const emptyForm: CustomerForm = {
  type: 'PJ', name: '', trade_name: '', document: '', email: '', phone: '', phone2: '', notes: '', is_active: true,
  address_zip: '', address_street: '', address_number: '', address_complement: '',
  address_neighborhood: '', address_city: '', address_state: '',
  latitude: '', longitude: '', google_maps_link: '',
  state_registration: '', municipal_registration: '',
  cnae_code: '', cnae_description: '', legal_nature: '', capital: '',
  simples_nacional: null, mei: null, company_status: '', opened_at: '',
  is_rural_producer: false, partners: [], secondary_activities: [],
  source: '', segment: '', company_size: '', rating: '', assigned_seller_id: '',
  contacts: [],
}

const emptyContact: Contact = { name: '', role: '', phone: '', email: '', is_primary: false }

const RATING_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-amber-100 text-amber-700',
  D: 'bg-red-100 text-red-700',
}

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function CustomersPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { hasPermission } = useAuthStore()
  const canCreate = hasPermission('cadastros.customer.create')
  const canUpdate = hasPermission('cadastros.customer.update')
  const canDelete = hasPermission('cadastros.customer.delete')
  const canExportAuvo = hasPermission('auvo.export.execute')

  const { exportCustomer } = useAuvoExport()

  // Filters
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [segmentFilter, setSegmentFilter] = useState<string>('')
  const [ratingFilter, setRatingFilter] = useState<string>('')
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [sellerFilter, setSellerFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const perPage = 20
  const debouncedSearch = useDebounce(search, 300)

  // Modal
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<CustomerForm>({ ...emptyForm })
  const [activeTab, setActiveTab] = useState<'info' | 'empresa' | 'address' | 'crm' | 'contacts'>('info')

  // Delete
  const [delId, setDelId] = useState<number | null>(null)
  const [delDeps, setDelDeps] = useState<DeleteDependencies | null>(null)

  // Fetch CRM options
  const { data: crmOptions } = useQuery({
    queryKey: ['customer-options'],
    queryFn: () => api.get('/customers/options').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  // Sellers
  const { data: sellersRes } = useQuery({
    queryKey: ['sellers-options'],
    queryFn: () => api.get('/users', { params: { role: 'vendedor', per_page: 100 } }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const sellers = sellersRes?.data ?? []

  // Fetch customers
  const { data: res, isLoading } = useQuery({
    queryKey: ['customers', debouncedSearch, typeFilter, statusFilter, segmentFilter, ratingFilter, sourceFilter, sellerFilter, page],
    queryFn: () => api.get('/customers', {
      params: {
        search: debouncedSearch || undefined,
        type: typeFilter || undefined,
        is_active: statusFilter === '' ? undefined : statusFilter === '1',
        segment: segmentFilter || undefined,
        rating: ratingFilter || undefined,
        source: sourceFilter || undefined,
        assigned_seller_id: sellerFilter || undefined,
        page,
        per_page: perPage,
      }
    }),
  })

  const customers = res?.data?.data ?? []
  const totalCount = res?.data?.total ?? 0
  const lastPage = res?.data?.last_page ?? 1

  // ViaCep lookup
  const lookupCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    try {
      const r = await api.get(`/external/cep/${digits}`)
      if (r.data && !r.data.erro) {
        setForm(prev => ({
          ...prev,
          address_street: r.data.logradouro || prev.address_street,
          address_neighborhood: r.data.bairro || prev.address_neighborhood,
          address_city: r.data.localidade || prev.address_city,
          address_state: r.data.uf || prev.address_state,
        }))
      }
    } catch { /* ignore */ }
  }

  // Document lookup state
  const [lookupLoading, setLookupLoading] = useState(false)
  const [enrichmentData, setEnrichmentData] = useState<any>(null)

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const lookupDocument = async (doc: string) => {
    const digits = doc.replace(/\D/g, '')
    if (digits.length !== 14 && digits.length !== 11) return
    setLookupLoading(true)
    setEnrichmentData(null)
    try {
      const r = await api.get(`/external/document/${digits}`)
      const d = r.data
      if (!d) { toast.error('Documento não encontrado'); return }

      if (d.source === 'cpf_validation') {
        toast.success('CPF válido!')
        setEnrichmentData(d)
        return
      }

      // CNPJ — preencher formulário
      setForm(prev => ({
        ...prev,
        name: d.name || prev.name,
        trade_name: d.trade_name || prev.trade_name,
        email: d.email || prev.email,
        phone: d.phone ? maskPhone(d.phone) : prev.phone,
        phone2: d.phone2 ? maskPhone(d.phone2) : prev.phone2,
        address_zip: d.address_zip ? String(d.address_zip).replace(/\D/g, '') : prev.address_zip,
        address_street: d.address_street || prev.address_street,
        address_number: d.address_number || prev.address_number,
        address_complement: d.address_complement || prev.address_complement,
        address_neighborhood: d.address_neighborhood || prev.address_neighborhood,
        address_city: d.address_city || prev.address_city,
        address_state: d.address_state || prev.address_state,
        cnae_code: d.cnae_code || prev.cnae_code,
        cnae_description: d.cnae_description || prev.cnae_description,
        legal_nature: d.legal_nature || prev.legal_nature,
        capital: d.capital != null ? String(d.capital) : prev.capital,
        company_status: d.company_status || prev.company_status,
        opened_at: d.opened_at || prev.opened_at,
        simples_nacional: d.simples_nacional ?? prev.simples_nacional,
        mei: d.mei ?? prev.mei,
        partners: d.partners?.length ? d.partners : prev.partners,
        secondary_activities: d.secondary_activities?.length ? d.secondary_activities : prev.secondary_activities,
        company_size: mapCompanySize(d.company_size) || prev.company_size,
      }))

      setEnrichmentData(d)
      toast.success(`Dados obtidos via ${d.source === 'brasilapi' ? 'BrasilAPI' : d.source === 'opencnpj' ? 'OpenCNPJ' : 'CNPJ.ws'}!`)
    } catch (err: any) {
      if (err.response?.status === 404) {
        toast.error('Documento não encontrado na base da Receita Federal')
      } else if (err.response?.status === 422) {
        toast.error(err.response.data?.message || 'Documento inválido')
      } else {
        toast.error('Erro ao consultar documento. Tente novamente.')
      }
    } finally {
      setLookupLoading(false)
    }
  }

  const mapCompanySize = (raw: string | null): string => {
    if (!raw) return ''
    const lower = raw.toLowerCase()
    if (lower.includes('micro') || lower === 'mei') return 'micro'
    if (lower.includes('peque')) return 'pequena'
    if (lower.includes('méd') || lower.includes('med')) return 'media'
    if (lower.includes('grand')) return 'grande'
    return ''
  }

  // Google Maps Parser
  const parseGoogleMapsLink = (link: string) => {
    if (!link) return
    // Patterns: @lat,lng or q=lat,lng or just lat,lng
    const regex = /(@|q=|query=|place\/|search\/)(-?\d+\.\d+),\s*(-?\d+\.\d+)/
    const match = link.match(regex)

    if (match) {
      const lat = match[2]
      const lng = match[3]
      setForm(prev => ({
        ...prev,
        latitude: lat,
        longitude: lng
      }))
      toast.success('Coordenadas extraídas do link!')
    } else {
      // Try raw coords "lat, lng"
      const rawRegex = /^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/
      const rawMatch = link.trim().match(rawRegex)
      if (rawMatch) {
        setForm(prev => ({ ...prev, latitude: rawMatch[1], longitude: rawMatch[2] }))
        toast.success('Coordenadas identificadas!')
      } else {
        toast.info('Não foi possível extrair coordenadas deste link automaticamente. Tente preencher manualmente.')
      }
    }
  }

  // Validation Helpers
  const validateDoc = (doc: string, type: 'PF' | 'PJ') => {
    const digits = doc.replace(/\D/g, '')
    if (type === 'PF') return digits.length === 11
    if (type === 'PJ') return digits.length === 14
    return false
  }

  // Save
  const saveMut = useMutation({
    mutationFn: (data: CustomerForm) => {
      const sanitized: Record<string, unknown> = { ...data }
      const nullableStrings = [
        'trade_name', 'email', 'phone', 'phone2', 'source', 'segment',
        'company_size', 'rating', 'assigned_seller_id',
        'state_registration', 'municipal_registration', 'cnae_code',
        'cnae_description', 'legal_nature', 'capital', 'company_status', 'opened_at',
      ]
      for (const k of nullableStrings) {
        if (sanitized[k] === '') sanitized[k] = null
      }
      if (sanitized.assigned_seller_id) sanitized.assigned_seller_id = Number(sanitized.assigned_seller_id)
      if (sanitized.capital && typeof sanitized.capital === 'string') sanitized.capital = parseFloat(sanitized.capital) || null
      if (enrichmentData && enrichmentData.source !== 'cpf_validation') {
        sanitized.enrichment_data = enrichmentData
        sanitized.enriched_at = new Date().toISOString()
      }
      return editingId
        ? api.put(`/customers/${editingId}`, sanitized)
        : api.post('/customers', sanitized)
    },
    onSuccess: () => {
      toast.success(editingId ? 'Cliente atualizado!' : 'Cliente criado!')
      qc.invalidateQueries({ queryKey: ['customers'] })
      closeModal()
    },
    onError: (err: any) => {
      if (err.response?.status === 422) {
        const errs = err.response.data.errors
        if (errs?.document) {
          toast.error(`Documento inválido: ${errs.document[0]}`)
          setActiveTab('info')
        } else {
          const firstField = Object.keys(errs)[0]
          const firstMsg = Object.values(errs).flat()[0] as string
          toast.error(firstMsg || 'Erro de validação')

          // Auto-switch tab based on which field failed
          if (['address_zip', 'address_street', 'address_number', 'address_complement', 'address_neighborhood', 'address_city', 'address_state', 'latitude', 'longitude', 'google_maps_link'].includes(firstField)) {
            setActiveTab('address')
          } else if (['cnae_code', 'cnae_description', 'legal_nature', 'capital', 'company_status', 'opened_at', 'simples_nacional', 'mei'].includes(firstField) || firstField.startsWith('partners') || firstField.startsWith('secondary_activities')) {
            setActiveTab('empresa')
          } else if (['source', 'segment', 'company_size', 'rating', 'assigned_seller_id'].includes(firstField)) {
            setActiveTab('crm')
          } else if (firstField.startsWith('contacts')) {
            setActiveTab('contacts')
          } else {
            setActiveTab('info')
          }
        }
      } else if (err.response?.status === 403) {
        toast.error('Você não tem permissão')
      } else {
        toast.error(err.response?.data?.message || 'Erro ao salvar cliente')
      }
    },
  })

  // Delete
  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      toast.success('Cliente excluído!')
      qc.invalidateQueries({ queryKey: ['customers'] })
      setDelId(null)
      setDelDeps(null)
    },
    onError: (err: any) => {
      if (err.response?.status === 409) {
        setDelDeps((err.response.data.dependencies ?? null) as DeleteDependencies | null)
      } else if (err.response?.status === 403) {
        toast.error('Você não tem permissão')
        setDelId(null)
      } else {
        toast.error(err.response?.data?.message || 'Erro ao excluir')
      }
    },
  })

  function openCreate() {
    setEditingId(null)
    setForm({ ...emptyForm })
    setEnrichmentData(null)
    setActiveTab('info')
    setOpen(true)
  }

  function openEdit(c: any) {
    setEditingId(c.id)
    setEnrichmentData(null)
    setForm({
      type: c.type ?? 'PJ',
      name: c.name ?? '',
      trade_name: c.trade_name ?? '',
      document: c.document ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      phone2: c.phone2 ?? '',
      notes: c.notes ?? '',
      is_active: c.is_active ?? true,
      address_zip: c.address_zip ?? '',
      address_street: c.address_street ?? '',
      address_number: c.address_number ?? '',
      address_complement: c.address_complement ?? '',
      address_neighborhood: c.address_neighborhood ?? '',
      address_city: c.address_city ?? '',
      address_state: c.address_state ?? '',
      latitude: c.latitude ?? '',
      longitude: c.longitude ?? '',
      google_maps_link: c.google_maps_link ?? '',
      state_registration: c.state_registration ?? '',
      municipal_registration: c.municipal_registration ?? '',
      cnae_code: c.cnae_code ?? '',
      cnae_description: c.cnae_description ?? '',
      legal_nature: c.legal_nature ?? '',
      capital: c.capital ?? '',
      simples_nacional: c.simples_nacional ?? null,
      mei: c.mei ?? null,
      company_status: c.company_status ?? '',
      opened_at: c.opened_at ?? '',
      is_rural_producer: c.is_rural_producer ?? false,
      partners: c.partners ?? [],
      secondary_activities: c.secondary_activities ?? [],
      source: c.source ?? '',
      segment: c.segment ?? '',
      company_size: c.company_size ?? '',
      rating: c.rating ?? '',
      assigned_seller_id: c.assigned_seller_id?.toString() ?? '',
      contacts: (c.contacts ?? []).map((ct: any) => ({
        id: ct.id,
        name: ct.name ?? '',
        role: ct.role ?? '',
        phone: ct.phone ?? '',
        email: ct.email ?? '',
        is_primary: ct.is_primary ?? false,
      })),
    })
    setActiveTab('info')
    setOpen(true)
  }

  function closeModal() {
    setOpen(false)
    setEditingId(null)
    setForm({ ...emptyForm })
  }

  function handleSave() {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }
    saveMut.mutate(form)
  }

  // Contact helpers
  function addContact() { setForm(prev => ({ ...prev, contacts: [...prev.contacts, { ...emptyContact }] })) }
  function removeContact(i: number) { setForm(prev => ({ ...prev, contacts: prev.contacts.filter((_, idx) => idx !== i) })) }
  function updateContact(i: number, field: string, value: any) {
    setForm(prev => ({
      ...prev,
      contacts: prev.contacts.map((c, idx) => idx === i ? { ...c, [field]: value } : c),
    }))
  }

  const healthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600'
    if (score >= 50) return 'text-amber-600'
    return 'text-red-600'
  }

  // Handle pagination reset on filter change
  const handleSearch = (val: string) => { setSearch(val); setPage(1) }
  const handleTypeFilter = (val: string) => { setTypeFilter(val); setPage(1) }
  const handleStatusFilter = (val: string) => { setStatusFilter(val); setPage(1) }
  const handleSegmentFilter = (val: string) => { setSegmentFilter(val); setPage(1) }
  const handleRatingFilter = (val: string) => { setRatingFilter(val); setPage(1) }
  const handleSourceFilter = (val: string) => { setSourceFilter(val); setPage(1) }
  const handleSellerFilter = (val: string) => { setSellerFilter(val); setPage(1) }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle="Gerencie seus clientes e informações de contato"
        count={totalCount}
        actions={[
          {
            label: 'Novo Cliente',
            onClick: openCreate,
            icon: <Plus className="h-4 w-4" />,
            permission: canCreate,
          },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          <input
            type="text"
            placeholder="Buscar por nome, documento, e-mail..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-surface-0"
          />
          {search && (
            <button onClick={() => handleSearch('')} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          value={typeFilter}
          onChange={(e) => handleTypeFilter(e.target.value)}
          aria-label="Filtrar por tipo"
          className="text-sm border border-default rounded-lg px-3 py-2 bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todos os tipos</option>
          <option value="PF">Pessoa Física</option>
          <option value="PJ">Pessoa Jurídica</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => handleStatusFilter(e.target.value)}
          aria-label="Filtrar por status"
          className="text-sm border border-default rounded-lg px-3 py-2 bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todos os status</option>
          <option value="1">Ativos</option>
          <option value="0">Inativos</option>
        </select>
        <select
          value={segmentFilter}
          onChange={(e) => handleSegmentFilter(e.target.value)}
          aria-label="Filtrar por segmento"
          className="text-sm border border-default rounded-lg px-3 py-2 bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todos segmentos</option>
          {crmOptions?.segments && Object.entries(crmOptions.segments).map(([k, v]) => (
            <option key={k} value={k}>{v as string}</option>
          ))}
        </select>
        <select
          value={ratingFilter}
          onChange={(e) => handleRatingFilter(e.target.value)}
          aria-label="Filtrar por rating"
          className="text-sm border border-default rounded-lg px-3 py-2 bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todos ratings</option>
          {crmOptions?.ratings && Object.entries(crmOptions.ratings).map(([k, v]) => (
            <option key={k} value={k}>{v as string}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => handleSourceFilter(e.target.value)}
          aria-label="Filtrar por origem"
          className="text-sm border border-default rounded-lg px-3 py-2 bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todas origens</option>
          {crmOptions?.sources && Object.entries(crmOptions.sources).map(([k, v]) => (
            <option key={k} value={k}>{v as string}</option>
          ))}
        </select>
        <select
          value={sellerFilter}
          onChange={(e) => handleSellerFilter(e.target.value)}
          aria-label="Filtrar por vendedor"
          className="text-sm border border-default rounded-lg px-3 py-2 bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todos vendedores</option>
          {sellers.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Nenhum cliente encontrado"
          description={search || typeFilter || statusFilter || segmentFilter || ratingFilter || sourceFilter || sellerFilter ? 'Tente ajustar os filtros de busca' : 'Comece cadastrando seu primeiro cliente'}
          action={canCreate ? { label: 'Novo Cliente', onClick: openCreate, icon: <Plus className="h-4 w-4" /> } : undefined}
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {customers.map((c: any) => (
              <div
                key={c.id}
                className="group relative rounded-xl border border-default bg-surface-0 p-4 hover:shadow-md hover:border-brand-200 transition-all cursor-pointer"
                onClick={() => navigate(`/cadastros/clientes/${c.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${c.type === 'PJ' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                      {c.type === 'PJ' ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-900 truncate">{c.name}</p>
                      {c.trade_name && (
                        <p className="text-xs text-surface-500 truncate">{c.trade_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {c.rating && (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${RATING_COLORS[c.rating] || 'bg-surface-100 text-surface-500'}`}>
                        {c.rating}
                      </span>
                    )}
                    <Badge variant={c.is_active ? 'success' : 'default'} size="sm">
                      {c.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-surface-500">
                  {c.document && <p>{maskCpfCnpj(c.document)}</p>}
                  {c.email && <p>{c.email}</p>}
                  {c.phone && <p>{maskPhone(c.phone)}</p>}
                  {c.contacts?.length > 0 && (() => {
                    const primary = c.contacts.find((ct: any) => ct.is_primary) || c.contacts[0]
                    return primary ? (
                      <p className="text-surface-400 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {primary.name}{primary.role ? ` (${primary.role})` : ''}
                      </p>
                    ) : null
                  })()}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {typeof c.health_score === 'number' && (
                      <span className={`flex items-center gap-1 text-xs font-medium ${healthColor(c.health_score)}`}>
                        <Heart className="h-3 w-3" />
                        {c.health_score}
                      </span>
                    )}
                    {c.assigned_seller && (
                      <span className="text-xs text-surface-400">
                        {c.assigned_seller.name}
                      </span>
                    )}
                    {c.documents_count > 0 && (
                      <span className="flex items-center gap-1 text-xs font-bold text-surface-400" title={`${c.documents_count} documentos anexados`}>
                        <FileText className="h-3 w-3" />
                        {c.documents_count}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canUpdate && (
                      <IconButton
                        icon={<Pencil className="h-3.5 w-3.5" />}
                        aria-label="Editar"
                        tooltip="Editar"
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); openEdit(c) }}
                      />
                    )}
                    {canExportAuvo && (
                      <IconButton
                        icon={<UploadCloud className="h-3.5 w-3.5" />}
                        aria-label="Exportar para Auvo"
                        tooltip="Exportar para Auvo"
                        size="sm"
                        variant="ghost"
                        className="hover:text-blue-600 hover:bg-blue-50"
                        disabled={exportCustomer.isPending}
                        onClick={(e) => { e.stopPropagation(); exportCustomer.mutate(c.id) }}
                      />
                    )}
                    {canDelete && (
                      <IconButton
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        aria-label="Excluir"
                        tooltip="Excluir"
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); setDelId(c.id); setDelDeps(null) }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {lastPage > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-surface-500">
                Mostrando {((page - 1) * perPage) + 1}—{Math.min(page * perPage, totalCount)} de {totalCount}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  icon={<ChevronLeft className="h-4 w-4" />}
                >
                  Anterior
                </Button>
                <span className="text-xs text-surface-600 px-2 tabular-nums">
                  {page} / {lastPage}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= lastPage}
                  onClick={() => setPage(p => p + 1)}
                  icon={<ChevronRight className="h-4 w-4" />}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={open}
        onClose={closeModal}
        title={editingId ? 'Editar Cliente' : 'Novo Cliente'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMut.isPending}>
              {saveMut.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        }
      >
        <div className="flex border-b border-default mb-4 -mx-1 overflow-x-auto">
          {(['info', 'empresa', 'address', 'crm', 'contacts'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${activeTab === tab ? 'border-b-2 border-brand-600 text-brand-600' : 'text-surface-500 hover:text-surface-700'}`}
            >
              {{ info: 'Informações', empresa: 'Dados Empresa', address: 'Endereço', crm: 'CRM', contacts: 'Contatos' }[tab]}
            </button>
          ))}
        </div>

        {activeTab === 'info' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-surface-700 mb-1">Tipo *</label>
              <div className="flex gap-2">
                {(['PJ', 'PF'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, type: t }))}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${form.type === t ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-default text-surface-600 hover:bg-surface-50'}`}
                  >
                    {t === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Consulta Inteligente de Documento ── */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-surface-700 mb-1">
                {form.type === 'PJ' ? 'CNPJ' : 'CPF'} — Consulta Automática
              </label>
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <input
                    value={form.document}
                    onChange={(e) => {
                      const masked = maskCpfCnpj(e.target.value)
                      setForm({ ...form, document: masked })
                      const digits = masked.replace(/\D/g, '')
                      if (digits.length === 14) setForm(prev => ({ ...prev, type: 'PJ' }))
                      else if (digits.length === 11) setForm(prev => ({ ...prev, type: 'PF' }))
                    }}
                    maxLength={form.type === 'PJ' ? 18 : 14}
                    placeholder={form.type === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                    className="w-full px-3 py-2.5 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-surface-0 font-mono tracking-wide"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => lookupDocument(form.document)}
                  disabled={lookupLoading || form.document.replace(/\D/g, '').length < 11}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  {lookupLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : enrichmentData ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  {lookupLoading ? 'Consultando...' : enrichmentData ? 'Consultado' : 'Consultar'}
                </button>
              </div>
              <p className="text-xs text-surface-400 mt-1.5">
                {form.type === 'PJ'
                  ? 'Preencha o CNPJ e clique em Consultar para importar automaticamente todos os dados da Receita Federal (razão social, endereço, sócios, CNAE, Simples Nacional, etc.)'
                  : 'Preencha o CPF para validação automática. Para produtores rurais, marque a flag abaixo.'}
              </p>
            </div>

            {/* ── Painel de Dados Enriquecidos (após consulta) ── */}
            {enrichmentData && enrichmentData.source !== 'cpf_validation' && (
              <div className="sm:col-span-2 rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50/50 to-indigo-50/30 p-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-brand-600" />
                  <h4 className="text-sm font-bold text-brand-800">Dados Obtidos da Receita Federal</h4>
                  <Badge variant="info" size="sm">{enrichmentData.source}</Badge>
                  {enrichmentData.company_status && (
                    <Badge
                      variant={enrichmentData.company_status.toUpperCase().includes('ATIVA') ? 'success' : 'danger'}
                      size="sm"
                    >
                      {enrichmentData.company_status}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {enrichmentData.capital != null && (
                    <div className="rounded-lg bg-surface-0/60 dark:bg-surface-800/60 p-2.5 border border-brand-100 dark:border-brand-900">
                      <div className="text-surface-400 flex items-center gap-1"><DollarSign className="h-3 w-3" /> Capital Social</div>
                      <div className="font-bold text-surface-900 mt-0.5">{fmtBRL(enrichmentData.capital)}</div>
                    </div>
                  )}
                  {enrichmentData.cnae_code && (
                    <div className="rounded-lg bg-surface-0/60 dark:bg-surface-800/60 p-2.5 border border-brand-100 dark:border-brand-900">
                      <div className="text-surface-400 flex items-center gap-1"><Briefcase className="h-3 w-3" /> CNAE Principal</div>
                      <div className="font-bold text-surface-900 mt-0.5">{enrichmentData.cnae_code}</div>
                      <div className="text-surface-500 truncate">{enrichmentData.cnae_description}</div>
                    </div>
                  )}
                  {enrichmentData.simples_nacional != null && (
                    <div className="rounded-lg bg-surface-0/60 dark:bg-surface-800/60 p-2.5 border border-brand-100 dark:border-brand-900">
                      <div className="text-surface-400">Simples Nacional</div>
                      <div className={`font-bold mt-0.5 ${enrichmentData.simples_nacional ? 'text-emerald-600' : 'text-surface-500'}`}>
                        {enrichmentData.simples_nacional ? 'Optante' : 'Não optante'}
                      </div>
                    </div>
                  )}
                  {enrichmentData.opened_at && (
                    <div className="rounded-lg bg-surface-0/60 dark:bg-surface-800/60 p-2.5 border border-brand-100 dark:border-brand-900">
                      <div className="text-surface-400">Abertura</div>
                      <div className="font-bold text-surface-900 mt-0.5">{enrichmentData.opened_at}</div>
                    </div>
                  )}
                </div>

                {enrichmentData.partners?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-brand-700 mb-1.5 flex items-center gap-1">
                      <Users className="h-3 w-3" /> Quadro Societário ({enrichmentData.partners.length})
                    </p>
                    <div className="grid gap-1.5">
                      {enrichmentData.partners.slice(0, 5).map((p: Partner, i: number) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-surface-0/60 dark:bg-surface-800/60 px-3 py-1.5 border border-brand-100 dark:border-brand-900 text-xs">
                          <span className="font-medium text-surface-800">{p.name}</span>
                          <span className="text-surface-400">{p.role}</span>
                        </div>
                      ))}
                      {enrichmentData.partners.length > 5 && (
                        <p className="text-xs text-surface-400 text-center">+ {enrichmentData.partners.length - 5} sócio(s)</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="sm:col-span-2">
              <Input
                label={form.type === 'PJ' ? 'Razão Social *' : 'Nome Completo *'}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            {form.type === 'PJ' && (
              <div className="sm:col-span-2">
                <Input
                  label="Nome Fantasia"
                  value={form.trade_name}
                  onChange={(e) => setForm({ ...form, trade_name: e.target.value })}
                />
              </div>
            )}
            <Input
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="Telefone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
              maxLength={15}
              placeholder="(00) 00000-0000"
            />
            <Input
              label="Telefone 2"
              value={form.phone2}
              onChange={(e) => setForm({ ...form, phone2: maskPhone(e.target.value) })}
              maxLength={15}
              placeholder="(00) 00000-0000"
            />

            {/* ── Produtor Rural / IE / IM ── */}
            <div className="sm:col-span-2 border-t border-default mt-2 pt-4">
              <h4 className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <Sprout className="h-4 w-4 text-emerald-600" /> Produtor Rural / Registros
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_rural_producer"
                    checked={form.is_rural_producer}
                    onChange={(e) => setForm({ ...form, is_rural_producer: e.target.checked })}
                    className="rounded border-default"
                  />
                  <label htmlFor="is_rural_producer" className="text-sm text-surface-700">Produtor Rural</label>
                </div>
                <Input
                  label="Inscrição Estadual (IE)"
                  value={form.state_registration}
                  onChange={(e) => setForm({ ...form, state_registration: e.target.value })}
                  placeholder="Ex: 123.456.789.012"
                />
                <Input
                  label="Inscrição Municipal (IM)"
                  value={form.municipal_registration}
                  onChange={(e) => setForm({ ...form, municipal_registration: e.target.value })}
                  placeholder="Ex: 12345678"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-surface-700 mb-1">Observações</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                rows={3}
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded border-default"
              />
              <label htmlFor="is_active" className="text-sm text-surface-700">Cliente ativo</label>
            </div>
          </div>
        )}

        {activeTab === 'empresa' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 flex items-center gap-3 rounded-lg border border-surface-200 bg-surface-50 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-surface-600">
                Estes campos são preenchidos automaticamente ao consultar o CNPJ. Você pode editá-los manualmente se necessário.
              </p>
            </div>

            <Input
              label="CNAE Principal"
              value={form.cnae_code}
              onChange={(e) => setForm({ ...form, cnae_code: e.target.value })}
              placeholder="Ex: 4321500"
            />
            <Input
              label="Descrição CNAE"
              value={form.cnae_description}
              onChange={(e) => setForm({ ...form, cnae_description: e.target.value })}
            />
            <Input
              label="Natureza Jurídica"
              value={form.legal_nature}
              onChange={(e) => setForm({ ...form, legal_nature: e.target.value })}
            />
            <Input
              label="Capital Social (R$)"
              value={form.capital}
              onChange={(e) => setForm({ ...form, capital: e.target.value })}
              placeholder="Ex: 100000.00"
            />
            <Input
              label="Situação Cadastral"
              value={form.company_status}
              onChange={(e) => setForm({ ...form, company_status: e.target.value })}
              placeholder="Ex: ATIVA"
            />
            <Input
              label="Data de Abertura"
              type="date"
              value={form.opened_at}
              onChange={(e) => setForm({ ...form, opened_at: e.target.value })}
            />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-surface-700">
                <input
                  type="checkbox"
                  checked={form.simples_nacional === true}
                  onChange={(e) => setForm({ ...form, simples_nacional: e.target.checked })}
                  className="rounded border-default"
                />
                Simples Nacional
              </label>
              <label className="flex items-center gap-2 text-sm text-surface-700">
                <input
                  type="checkbox"
                  checked={form.mei === true}
                  onChange={(e) => setForm({ ...form, mei: e.target.checked })}
                  className="rounded border-default"
                />
                MEI
              </label>
            </div>

            {/* Atividades Secundárias */}
            {form.secondary_activities.length > 0 && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-surface-700 mb-2">Atividades Secundárias</label>
                <div className="rounded-lg border border-default overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-surface-50">
                        <th className="text-left px-3 py-2 font-medium text-surface-500">Código</th>
                        <th className="text-left px-3 py-2 font-medium text-surface-500">Descrição</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                      {form.secondary_activities.map((act, i) => (
                        <tr key={i} className="hover:bg-surface-50">
                          <td className="px-3 py-1.5 font-mono text-surface-700">{act.code}</td>
                          <td className="px-3 py-1.5 text-surface-600">{act.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Quadro Societário */}
            {form.partners.length > 0 && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-surface-700 mb-2">Quadro Societário</label>
                <div className="rounded-lg border border-default overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-surface-50">
                        <th className="text-left px-3 py-2 font-medium text-surface-500">Nome</th>
                        <th className="text-left px-3 py-2 font-medium text-surface-500">Qualificação</th>
                        <th className="text-left px-3 py-2 font-medium text-surface-500">Entrada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                      {form.partners.map((p, i) => (
                        <tr key={i} className="hover:bg-surface-50">
                          <td className="px-3 py-1.5 font-medium text-surface-800">{p.name}</td>
                          <td className="px-3 py-1.5 text-surface-600">{p.role}</td>
                          <td className="px-3 py-1.5 text-surface-500">{p.entry_date || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'address' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="CEP"
              value={form.address_zip}
              onChange={(e) => setForm({ ...form, address_zip: e.target.value.replace(/\D/g, '').slice(0, 8) })}
              onBlur={() => lookupCep(form.address_zip)}
              maxLength={8}
              placeholder="00000000"
            />
            <div /> {/* spacer */}
            <div className="sm:col-span-2">
              <Input
                label="Rua"
                value={form.address_street}
                onChange={(e) => setForm({ ...form, address_street: e.target.value })}
              />
            </div>
            <Input
              label="Número"
              value={form.address_number}
              onChange={(e) => setForm({ ...form, address_number: e.target.value })}
            />
            <Input
              label="Complemento"
              value={form.address_complement}
              onChange={(e) => setForm({ ...form, address_complement: e.target.value })}
            />
            <Input
              label="Bairro"
              value={form.address_neighborhood}
              onChange={(e) => setForm({ ...form, address_neighborhood: e.target.value })}
            />
            <Input
              label="Cidade"
              value={form.address_city}
              onChange={(e) => setForm({ ...form, address_city: e.target.value })}
            />
            <Input
              label="UF"
              value={form.address_state}
              onChange={(e) => setForm({ ...form, address_state: e.target.value.toUpperCase().slice(0, 2) })}
              maxLength={2}
            />

            <div className="sm:col-span-2 border-t border-default mt-2 pt-4">
              <h4 className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-600" />
                Localização (Google Maps)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Input
                        label="Link do Google Maps"
                        value={form.google_maps_link}
                        onChange={(e) => setForm({ ...form, google_maps_link: e.target.value })}
                        placeholder="Ex: https://maps.google.com/?q=-23.5,-46.6"
                      />
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => parseGoogleMapsLink(form.google_maps_link)}
                      type="button"
                      className="mb-0.5"
                    >
                      Extrair Coordenadas
                    </Button>
                  </div>
                  <p className="text-xs text-surface-500 mt-1">
                    Cole o link do Google Maps para tentar preencher Latitude e Longitude automaticamente.
                  </p>
                </div>

                <Input
                  label="Latitude"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  placeholder="-00.000000"
                />
                <Input
                  label="Longitude"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  placeholder="-00.000000"
                />

                {(form.latitude && form.longitude) && (
                  <div className="sm:col-span-2">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${form.latitude},${form.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium"
                    >
                      <MapPin className="w-4 h-4" />
                      Visualizar localização no Google Maps
                      <UploadCloud className="w-3 h-3 rotate-45" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'crm' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="crm-source" className="block text-sm font-medium text-surface-700 mb-1">Origem</label>
              <select
                id="crm-source"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-surface-0"
              >
                <option value="">Selecione...</option>
                {crmOptions?.sources && Object.entries(crmOptions.sources).map(([k, v]) => (
                  <option key={k} value={k}>{v as string}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="crm-segment" className="block text-sm font-medium text-surface-700 mb-1">Segmento</label>
              <select
                id="crm-segment"
                value={form.segment}
                onChange={(e) => setForm({ ...form, segment: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-surface-0"
              >
                <option value="">Selecione...</option>
                {crmOptions?.segments && Object.entries(crmOptions.segments).map(([k, v]) => (
                  <option key={k} value={k}>{v as string}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="crm-company-size" className="block text-sm font-medium text-surface-700 mb-1">Porte</label>
              <select
                id="crm-company-size"
                value={form.company_size}
                onChange={(e) => setForm({ ...form, company_size: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-surface-0"
              >
                <option value="">Selecione...</option>
                {crmOptions?.company_sizes && Object.entries(crmOptions.company_sizes).map(([k, v]) => (
                  <option key={k} value={k}>{v as string}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="crm-rating" className="block text-sm font-medium text-surface-700 mb-1">Classificação</label>
              <select
                id="crm-rating"
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-surface-0"
              >
                <option value="">Selecione...</option>
                {crmOptions?.ratings && Object.entries(crmOptions.ratings).map(([k, v]) => (
                  <option key={k} value={k}>{v as string}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="crm-seller" className="block text-sm font-medium text-surface-700 mb-1">Vendedor Responsável</label>
              <select
                id="crm-seller"
                value={form.assigned_seller_id}
                onChange={(e) => setForm({ ...form, assigned_seller_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-surface-0"
              >
                <option value="">Nenhum</option>
                {sellers.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="space-y-4">
            {form.contacts.length === 0 && (
              <p className="text-sm text-surface-500 text-center py-4">Nenhum contato adicionado</p>
            )}
            {form.contacts.map((ct, i) => (
              <div key={i} className="border border-surface-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-surface-700">Contato {i + 1}</p>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-surface-600">
                      <input
                        type="checkbox"
                        checked={ct.is_primary}
                        onChange={(e) => updateContact(i, 'is_primary', e.target.checked)}
                        className="rounded border-default"
                      />
                      Principal
                    </label>
                    <IconButton
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      aria-label="Remover contato"
                      tooltip="Remover"
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => removeContact(i)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Nome *" value={ct.name} onChange={(e) => updateContact(i, 'name', e.target.value)} />
                  <Input label="Cargo" value={ct.role} onChange={(e) => updateContact(i, 'role', e.target.value)} />
                  <Input
                    label="Telefone"
                    value={ct.phone}
                    onChange={(e) => updateContact(i, 'phone', maskPhone(e.target.value))}
                    maxLength={15}
                  />
                  <Input label="E-mail" value={ct.email} onChange={(e) => updateContact(i, 'email', e.target.value)} />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addContact} icon={<Plus className="h-4 w-4" />}>
              Adicionar Contato
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={delId !== null}
        onClose={() => { setDelId(null); setDelDeps(null) }}
        title="Excluir Cliente"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setDelId(null); setDelDeps(null) }}>Cancelar</Button>
            {!delDeps && (
              <Button
                variant="danger"
                onClick={() => {
                  if (delId) {
                    deleteMut.mutate(delId)
                  }
                }}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? 'Excluindo...' : 'Excluir'}
              </Button>
            )}
          </div>
        }
      >
        {delDeps ? (
          <div className="space-y-2">
            <p className="text-sm text-surface-700">Não é possível excluir este cliente. Existem dependências:</p>
            <ul className="text-sm text-surface-600 list-disc pl-5 space-y-1">
              {delDeps.active_work_orders && <li>Ordens de serviço ativas</li>}
              {delDeps.receivables && <li>Pendências financeiras</li>}
              {(delDeps.quotes ?? 0) > 0 && <li>{delDeps.quotes} orçamento(s)</li>}
              {(delDeps.deals ?? 0) > 0 && <li>{delDeps.deals} negociação(ões)</li>}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-surface-700">Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.</p>
        )}
      </Modal>
    </div>
  )
}

