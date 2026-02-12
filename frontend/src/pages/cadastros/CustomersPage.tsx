import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Plus, Pencil, Trash2, Phone, Mail, MapPin,
  User as UserIcon, Building2, ChevronDown, Users, AlertTriangle, Loader2,
} from 'lucide-react'
import { useViaCep } from '@/hooks/useViaCep'
import { useCnpjLookup } from '@/hooks/useCnpjLookup'
import { useIbgeStates, useIbgeCities } from '@/hooks/useIbge'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'

interface Contact {
  id?: number
  name: string
  role: string
  phone: string
  email: string
  is_primary: boolean
}

interface Customer {
  id: number
  type: 'PF' | 'PJ'
  name: string
  trade_name?: string
  document: string | null
  email: string | null
  phone: string | null
  phone2: string | null
  address_zip?: string
  address_street?: string
  address_number?: string
  address_complement?: string
  address_neighborhood?: string
  address_city: string | null
  address_state: string | null
  notes?: string
  is_active: boolean
  contacts: Contact[]
}

const emptyForm = {
  type: 'PF' as 'PF' | 'PJ',
  name: '', trade_name: '', document: '', email: '', phone: '', phone2: '',
  address_zip: '', address_street: '', address_number: '',
  address_complement: '', address_neighborhood: '',
  address_city: '', address_state: '', notes: '',
  is_active: true, contacts: [] as Contact[],
}

export function CustomersPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 500)
  const [showConfirmDelete, setShowConfirmDelete] = useState<Customer | null>(null)
  const [deleteDependencies, setDeleteDependencies] = useState<any>(null)
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null)
  const viaCep = useViaCep()
  const cnpjLookup = useCnpjLookup()
  const { data: ibgeStates = [] } = useIbgeStates()
  const { data: ibgeCities = [] } = useIbgeCities(form.address_state)

  async function handleCepBlur() {
    const result = await viaCep.lookup(form.address_zip)
    if (result) {
      setForm(f => ({
        ...f,
        address_street: result.street || f.address_street,
        address_neighborhood: result.neighborhood || f.address_neighborhood,
        address_city: result.city || f.address_city,
        address_state: result.state || f.address_state,
      }))
    }
  }

  async function handleCnpjLookup() {
    const result = await cnpjLookup.lookup(form.document)
    if (result) {
      setForm(f => ({
        ...f,
        name: f.name || result.name,
        trade_name: f.trade_name || result.trade_name,
        email: f.email || result.email,
        phone: f.phone || result.phone,
        address_zip: f.address_zip || result.address_zip,
        address_street: f.address_street || result.address_street,
        address_number: f.address_number || result.address_number,
        address_complement: f.address_complement || result.address_complement,
        address_neighborhood: f.address_neighborhood || result.address_neighborhood,
        address_city: f.address_city || result.address_city,
        address_state: f.address_state || result.address_state,
      }))
    }
  }

  const { data: res, isLoading } = useQuery({
    queryKey: ['customers', debouncedSearch],
    queryFn: () => api.get('/customers', { params: { search: debouncedSearch } }),
  })
  const customers: Customer[] = res?.data?.data ?? res?.data ?? []

  const saveMut = useMutation({
    mutationFn: (data: typeof emptyForm) => {
      const sanitized = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v === '' ? null : v])
      )
      return editingId ? api.put(`/customers/${editingId}`, sanitized) : api.post('/customers', sanitized)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      closeModal()
      toast.success(editingId ? 'Cliente atualizado com sucesso!' : 'Cliente criado com sucesso!')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Erro ao salvar cliente.')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['work-orders'] })
      qc.invalidateQueries({ queryKey: ['quotes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setShowConfirmDelete(null)
      toast.success('Cliente excluído com sucesso!')
    },
    onError: (err: any) => {
      if (err.response?.status === 409 || err.response?.status === 422) {
        setDeleteDependencies(err.response.data.dependencies)
        setDeleteMessage(err.response.data.message)
      } else {
        toast.error(err.response?.data?.message ?? 'Erro ao excluir cliente.')
        setShowConfirmDelete(null)
      }
    },
  })

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEdit(c: Customer) {
    setEditingId(c.id)
    setForm({
      type: c.type, name: c.name, trade_name: c.trade_name ?? '',
      document: c.document ?? '', email: c.email ?? '',
      phone: c.phone ?? '', phone2: c.phone2 ?? '',
      address_zip: c.address_zip ?? '', address_street: c.address_street ?? '',
      address_number: c.address_number ?? '', address_complement: c.address_complement ?? '',
      address_neighborhood: c.address_neighborhood ?? '',
      address_city: c.address_city ?? '', address_state: c.address_state ?? '',
      notes: c.notes ?? '', is_active: c.is_active,
      contacts: c.contacts ?? [],
    })
    setShowModal(true)
  }

  function closeModal() { setShowModal(false); setEditingId(null) }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: key === 'is_active' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const updateContact = (i: number, field: keyof Contact, val: string | boolean) =>
    setForm(prev => ({ ...prev, contacts: prev.contacts.map((c, idx) => idx === i ? { ...c, [field]: val } : c) }))

  const addContact = () =>
    setForm(prev => ({ ...prev, contacts: [...prev.contacts, { name: '', role: '', phone: '', email: '', is_primary: false }] }))

  const removeContact = (i: number) =>
    setForm(prev => ({ ...prev, contacts: prev.contacts.filter((_, idx) => idx !== i) }))


  if (isLoading) return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <div className="skeleton h-7 w-32" />
          <div className="skeleton mt-2 h-4 w-48" />
        </div>
        <div className="skeleton h-9 w-28" />
      </div>
      <div className="skeleton h-10 w-full max-w-md" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Clientes</h1>
          <p className="text-sm text-surface-500">Gerencie sua base de clientes</p>
        </div>
        <Button onClick={openNew} icon={<Plus className="h-4 w-4" />}>Novo Cliente</Button>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-surface-0 p-2 shadow-sm border border-surface-100 max-w-md">
        <Search className="h-4 w-4 text-surface-400 ml-2" />
        <input
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-surface-400"
          placeholder="Buscar por nome, documento ou e-mail..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-300 bg-surface-50 py-16 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-surface-300" />
          <p className="text-sm font-medium text-surface-500">Nenhum cliente encontrado</p>
          {searchTerm && <p className="mt-1 text-xs text-surface-400">Tente buscar por outro termo</p>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {customers.map((c, i) => (
            <div key={c.id} className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border border-surface-200 bg-surface-0 p-5 shadow-sm transition-all hover:border-brand-200 hover:shadow-md stagger-${Math.min(i + 1, 6)} animate-slide-up`}>
              <div>
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100 text-surface-600 font-medium text-sm">
                    {c.name.substring(0, 2).toUpperCase()}
                  </div>
                  <Badge variant={c.is_active ? 'success' : 'neutral'} className="capitalize">
                    {c.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <h3 className="font-semibold text-surface-900 line-clamp-1" title={c.name}>{c.name}</h3>
                {c.trade_name && <p className="text-xs text-surface-500 line-clamp-1">{c.trade_name}</p>}

                <div className="mt-4 space-y-2 text-xs text-surface-500">
                  {c.document && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px] h-5 px-1.5">{c.type}</Badge>
                      <span className="font-mono">{c.document}</span>
                    </div>
                  )}
                  {c.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {c.phone}</div>}
                  {c.email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> <span className="truncate">{c.email}</span></div>}
                  {c.address_city && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {c.address_city}/{c.address_state}</div>}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-surface-100 pt-3 opacity-0 transition-opacity group-hover:opacity-100">
                <Button variant="ghost" size="sm" onClick={() => openEdit(c)} className="h-8 w-8 p-0 text-surface-500 hover:text-brand-600">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  setShowConfirmDelete(c)
                  setDeleteDependencies(null)
                  setDeleteMessage(null)
                }} className="h-8 w-8 p-0 text-surface-500 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={showModal} onOpenChange={setShowModal} title={editingId ? 'Editar Cliente' : 'Novo Cliente'} size="xl">
        <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4 max-h-[80vh] overflow-y-auto px-1">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-surface-700">Tipo</label>
              <div className="mt-1.5 flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="type" value="PF" checked={form.type === 'PF'} onChange={set('type')} className="text-brand-600 focus:ring-brand-500" />
                  Pessoa Física
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="type" value="PJ" checked={form.type === 'PJ'} onChange={set('type')} className="text-brand-600 focus:ring-brand-500" />
                  Pessoa Jurídica
                </label>
              </div>
            </div>
            <div className="md:col-span-2">
              <Input label="Nome / Razão Social *" value={form.name} onChange={set('name')} required />
            </div>
            <div className="md:col-span-1">
              <div className="relative">
                <Input label={form.type === 'PF' ? 'CPF' : 'CNPJ'} value={form.document} onChange={set('document')} />
                {form.type === 'PJ' && form.document.replace(/\D/g, '').length === 14 && (
                  <button type="button" onClick={handleCnpjLookup} disabled={cnpjLookup.loading}
                    className="absolute right-2 top-8 rounded p-1 text-surface-400 hover:text-brand-600 transition-colors"
                    title="Buscar dados do CNPJ">
                    {cnpjLookup.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Nome Fantasia" value={form.trade_name} onChange={set('trade_name')} disabled={form.type === 'PF'} />
            <Input label="E-mail" type="email" value={form.email} onChange={set('email')} />
            <Input label="Telefone Principal" value={form.phone} onChange={set('phone')} />
          </div>

          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-surface-700 flex items-center gap-1 py-1">
              <MapPin className="h-4 w-4" /> Endereço
              <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3 pl-2 border-l-2 border-surface-100">
              <div className="relative">
                <Input label="CEP" value={form.address_zip} onChange={set('address_zip')} onBlur={handleCepBlur} />
                {viaCep.loading && <Loader2 className="absolute right-2 top-8 h-4 w-4 animate-spin text-brand-500" />}
              </div>
              <div className="sm:col-span-2">
                <Input label="Rua" value={form.address_street} onChange={set('address_street')} />
              </div>
              <Input label="Número" value={form.address_number} onChange={set('address_number')} />
              <Input label="Complemento" value={form.address_complement} onChange={set('address_complement')} />
              <Input label="Bairro" value={form.address_neighborhood} onChange={set('address_neighborhood')} />
              <div>
                <label className="text-sm font-medium text-surface-700 mb-1 block">UF</label>
                <select value={form.address_state} onChange={e => { setForm(f => ({ ...f, address_state: e.target.value, address_city: '' })) }}
                  className="w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none">
                  <option value="">Selecione</option>
                  {ibgeStates.map(s => <option key={s.abbr} value={s.abbr}>{s.abbr} — {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-surface-700 mb-1 block">Cidade</label>
                <select value={form.address_city} onChange={e => setForm(f => ({ ...f, address_city: e.target.value }))}
                  className="w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  disabled={!form.address_state}>
                  <option value="">{form.address_state ? 'Selecione' : 'Selecione o UF primeiro'}</option>
                  {ibgeCities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <Input label="Telefone Secundário" value={form.phone2} onChange={set('phone2')} />
            </div>
          </details>

          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-surface-700 flex items-center gap-1 py-1">
              <Users className="h-4 w-4" /> Contatos Adicionais
              <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 space-y-3 pl-2 border-l-2 border-surface-100">
              {form.contacts.map((ct, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-surface-50 p-2 rounded-lg relative group/contact">
                  <div className="sm:col-span-3"><Input placeholder="Nome" value={ct.name} onChange={(e) => updateContact(i, 'name', e.target.value)} className="bg-white" /></div>
                  <div className="sm:col-span-3"><Input placeholder="Cargo" value={ct.role} onChange={(e) => updateContact(i, 'role', e.target.value)} className="bg-white" /></div>
                  <div className="sm:col-span-3"><Input placeholder="Email" value={ct.email} onChange={(e) => updateContact(i, 'email', e.target.value)} className="bg-white" /></div>
                  <div className="sm:col-span-2"><Input placeholder="Telefone" value={ct.phone} onChange={(e) => updateContact(i, 'phone', e.target.value)} className="bg-white" /></div>
                  <div className="sm:col-span-1 flex items-center justify-center">
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeContact(i)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addContact} icon={<Plus className="h-3 w-3" />}>Adicionar Contato</Button>
            </div>
          </details>

          <div className="flex items-center gap-2 py-2">
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={set('is_active')} className="rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
            <label htmlFor="is_active" className="text-sm font-medium text-surface-700">Cliente Ativo</label>
          </div>

          <div>
            <label className="text-sm font-medium text-surface-700 mb-1 block">Observações</label>
            <textarea className="w-full rounded-md border border-surface-300 p-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none min-h-[80px]"
              value={form.notes} onChange={set('notes')} />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-surface-100">
            <Button variant="outline" type="button" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={saveMut.isPending}>{editingId ? 'Salvar Alterações' : 'Criar Cliente'}</Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal open={!!showConfirmDelete} onOpenChange={() => setShowConfirmDelete(null)} size="sm" title="Excluir Cliente">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-medium text-surface-900">Tem certeza?</h3>
              <p className="text-sm text-surface-500">
                Deseja realmente excluir <strong>{showConfirmDelete?.name}</strong>?
              </p>
            </div>
          </div>

          {deleteMessage && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-100">
              <p className="font-medium mb-1">Não é possível excluir:</p>
              <p>{deleteMessage}</p>
            </div>
          )}

          {deleteDependencies && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-surface-600 uppercase tracking-wide">Vínculos encontrados:</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(deleteDependencies).map(([key, count]) => (
                  <div key={key} className="flex items-center justify-between rounded bg-surface-50 px-3 py-2 text-sm border border-surface-100">
                    <span className="text-surface-600 capitalize">{key.replace(/_/g, ' ')}</span>
                    <Badge variant="neutral">{String(count)}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowConfirmDelete(null)}>Cancelar</Button>
            {deleteDependencies ? (
              <Button variant="ghost" disabled className="text-surface-400 cursor-not-allowed">
                Resolva as pendências acima
              </Button>
            ) : (
              <Button className="bg-red-600 hover:bg-red-700 text-white" loading={deleteMut.isPending}
                onClick={() => showConfirmDelete && deleteMut.mutate(showConfirmDelete.id)}>
                Excluir Cliente
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
