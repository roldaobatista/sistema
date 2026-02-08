import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Plus, Pencil, Trash2, Phone, Mail, MapPin,
  User as UserIcon, Building2, ChevronDown, ChevronUp,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'

interface Customer {
  id: number
  type: 'PF' | 'PJ'
  name: string
  document: string | null
  email: string | null
  phone: string | null
  phone2: string | null
  address_city: string | null
  address_state: string | null
  is_active: boolean
  contacts: Contact[]
}

interface Contact {
  id?: number
  name: string
  role: string
  phone: string
  email: string
  is_primary: boolean
}

const emptyForm = {
  type: 'PF' as 'PF' | 'PJ',
  name: '', document: '', email: '', phone: '', phone2: '',
  address_zip: '', address_street: '', address_number: '',
  address_complement: '', address_neighborhood: '',
  address_city: '', address_state: '', notes: '',
  is_active: true, contacts: [] as Contact[],
}

export function CustomersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState(emptyForm)

  const { data: res, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => api.get('/customers', { params: { search, per_page: 50 } }),
  })
  const customers: Customer[] = res?.data?.data ?? []

  const saveMut = useMutation({
    mutationFn: (data: typeof form) =>
      editing ? api.put(`/customers/${editing.id}`, data) : api.post('/customers', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setShowForm(false) },
  })

  const delMut = useMutation({
    mutationFn: (id: number) => api.delete(`/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true) }
  const openEdit = (c: Customer) => {
    setEditing(c)
    setForm({
      ...emptyForm,
      type: c.type, name: c.name, document: c.document ?? '', email: c.email ?? '',
      phone: c.phone ?? '', phone2: c.phone2 ?? '',
      is_active: c.is_active, contacts: c.contacts ?? [],
    })
    setShowForm(true)
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const addContact = () =>
    set('contacts', [...form.contacts, { name: '', role: '', phone: '', email: '', is_primary: false }])

  const updateContact = (i: number, field: keyof Contact, val: string | boolean) =>
    set('contacts', form.contacts.map((c, idx) => idx === i ? { ...c, [field]: val } : c))

  const removeContact = (i: number) =>
    set('contacts', form.contacts.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Clientes</h1>
          <p className="mt-1 text-sm text-surface-500">Cadastro de clientes PF e PJ</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Novo Cliente</Button>
      </div>

      <div className="max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input type="text" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder="Buscar nome, CPF/CNPJ, email..."
            className="w-full rounded-lg border border-surface-300 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">Cliente</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600 md:table-cell">Documento</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600 lg:table-cell">Contato</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600 lg:table-cell">Cidade</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-surface-500">Carregando...</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-surface-500">Nenhum cliente encontrado</td></tr>
            ) : customers.map(c => (
              <tr key={c.id} className="hover:bg-surface-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold',
                      c.type === 'PJ' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700')}>
                      {c.type === 'PJ' ? <Building2 className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-surface-900">{c.name}</p>
                      <Badge variant={c.type === 'PJ' ? 'info' : 'success'} className="mt-0.5">{c.type}</Badge>
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-sm text-surface-600 md:table-cell">{c.document || '—'}</td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <div className="space-y-0.5 text-xs text-surface-600">
                    {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                    {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-sm text-surface-600 lg:table-cell">
                  {c.address_city ? `${c.address_city}/${c.address_state}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={c.is_active ? 'success' : 'danger'} dot>{c.is_active ? 'Ativo' : 'Inativo'}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm('Excluir?')) delMut.mutate(c.id) }}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      <Modal open={showForm} onOpenChange={setShowForm} title={editing ? 'Editar Cliente' : 'Novo Cliente'} size="xl">
        <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="max-h-[70vh] overflow-y-auto space-y-4 pr-1">
          {/* Tipo */}
          <div className="flex gap-2">
            {(['PF', 'PJ'] as const).map(t => (
              <button key={t} type="button" onClick={() => set('type', t)}
                className={cn('flex-1 rounded-lg border py-2 text-sm font-medium transition-all',
                  form.type === t ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-300 text-surface-600 hover:border-surface-400')}>
                {t === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nome" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('name', e.target.value)} required />
            <Input label={form.type === 'PJ' ? 'CNPJ' : 'CPF'} value={form.document} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('document', e.target.value)} />
            <Input label="E-mail" type="email" value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('email', e.target.value)} />
            <Input label="Telefone" value={form.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('phone', e.target.value)} />
          </div>

          {/* Endereço */}
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-surface-700 flex items-center gap-1">
              <MapPin className="h-4 w-4" /> Endereço
              <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Input label="CEP" value={form.address_zip} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('address_zip', e.target.value)} />
              <div className="sm:col-span-2">
                <Input label="Rua" value={form.address_street} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('address_street', e.target.value)} />
              </div>
              <Input label="Número" value={form.address_number} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('address_number', e.target.value)} />
              <Input label="Complemento" value={form.address_complement} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('address_complement', e.target.value)} />
              <Input label="Bairro" value={form.address_neighborhood} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('address_neighborhood', e.target.value)} />
              <Input label="Cidade" value={form.address_city} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('address_city', e.target.value)} />
              <Input label="UF" value={form.address_state} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('address_state', e.target.value)} maxLength={2} />
            </div>
          </details>

          {/* Contatos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-surface-700">Contatos</span>
              <Button variant="ghost" size="sm" type="button" onClick={addContact}><Plus className="h-4 w-4" /> Adicionar</Button>
            </div>
            {form.contacts.map((ct, i) => (
              <div key={i} className="mb-2 grid gap-2 rounded-lg border border-surface-200 p-3 sm:grid-cols-4">
                <Input placeholder="Nome" value={ct.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateContact(i, 'name', e.target.value)} />
                <Input placeholder="Cargo" value={ct.role} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateContact(i, 'role', e.target.value)} />
                <Input placeholder="Telefone" value={ct.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateContact(i, 'phone', e.target.value)} />
                <div className="flex items-end gap-2">
                  <Input placeholder="E-mail" value={ct.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateContact(i, 'email', e.target.value)} className="flex-1" />
                  <Button variant="ghost" size="sm" type="button" onClick={() => removeContact(i)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-surface-200 pt-4">
            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" loading={saveMut.isPending}>{editing ? 'Salvar' : 'Criar Cliente'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
