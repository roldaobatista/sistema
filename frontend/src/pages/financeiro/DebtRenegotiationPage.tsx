import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Check, X, HandCoins, Search, Loader2 } from 'lucide-react'

const statusLabels: Record<string, { label: string; variant: 'warning' | 'success' | 'destructive' | 'secondary' }> = {
  pending: { label: 'Pendente', variant: 'warning' },
  approved: { label: 'Aprovada', variant: 'success' },
  rejected: { label: 'Rejeitada', variant: 'destructive' },
  completed: { label: 'Concluída', variant: 'secondary' },
}

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')

interface CustomerOption {
  id: number
  name: string
  document?: string
}

interface ReceivableOption {
  id: number
  description: string
  amount: string
  amount_paid: string
  due_date: string
  status: string
  customer?: { id: number; name: string }
}

export default function DebtRenegotiationPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [selectedCustomerName, setSelectedCustomerName] = useState('')
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
  const [selectedReceivableIds, setSelectedReceivableIds] = useState<number[]>([])
  const [form, setForm] = useState({
    negotiated_total: '',
    discount_amount: '0',
    interest_amount: '0',
    fine_amount: '0',
    new_installments: '1',
    first_due_date: '',
    notes: '',
  })

  const { data: renegotiationsData, isLoading } = useQuery({
    queryKey: ['renegotiations'],
    queryFn: () => api.get('/renegotiations').then(r => r.data),
  })

  const { data: customersData, isFetching: customersLoading } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: () =>
      api.get('/customers', { params: { search: customerSearch.trim() || undefined, per_page: 30 } }).then(r => r.data),
    enabled: showForm && customerDropdownOpen,
  })

  const customerOptions: CustomerOption[] = useMemo(
    () => (customersData?.data ?? customersData ?? []).map((c: any) => ({ id: c.id, name: c.name, document: c.document })),
    [customersData]
  )

  const { data: receivablesData, isFetching: receivablesLoading } = useQuery({
    queryKey: ['accounts-receivable', selectedCustomerId],
    queryFn: () =>
      api.get('/accounts-receivable', {
        params: {
          customer_id: selectedCustomerId,
          status: 'pending,partial,overdue',
          per_page: 100,
        },
      }).then(r => r.data),
    enabled: showForm && !!selectedCustomerId,
  })

  const receivables: ReceivableOption[] = useMemo(
    () => (receivablesData?.data ?? receivablesData ?? []),
    [receivablesData]
  )

  const selectedTotal = useMemo(() => {
    return receivables
      .filter(r => selectedReceivableIds.includes(r.id))
      .reduce((sum, r) => sum + (Number(r.amount) - Number(r.amount_paid)), 0)
  }, [receivables, selectedReceivableIds])

  const createMut = useMutation({
    mutationFn: (payload: {
      customer_id: number
      receivable_ids: number[]
      negotiated_total: number
      discount_amount: number
      interest_amount: number
      fine_amount: number
      new_installments: number
      first_due_date: string
      notes: string
    }) => api.post('/renegotiations', payload),
    onSuccess: () => {
      toast.success('Renegociação criada')
      setShowForm(false)
      setSelectedCustomerId('')
      setSelectedCustomerName('')
      setSelectedReceivableIds([])
      setForm({ negotiated_total: '', discount_amount: '0', interest_amount: '0', fine_amount: '0', new_installments: '1', first_due_date: '', notes: '' })
      qc.invalidateQueries({ queryKey: ['renegotiations'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao criar'),
  })

  const approveMut = useMutation({
    mutationFn: (id: number) => api.post(`/renegotiations/${id}/approve`),
    onSuccess: () => {
      toast.success('Renegociação aprovada! Novas parcelas geradas.')
      qc.invalidateQueries({ queryKey: ['renegotiations'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao aprovar renegociação'),
  })

  const rejectMut = useMutation({
    mutationFn: (id: number) => api.post(`/renegotiations/${id}/reject`),
    onSuccess: () => {
      toast.info('Renegociação rejeitada.')
      qc.invalidateQueries({ queryKey: ['renegotiations'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao rejeitar renegociação'),
  })

  const handleSubmit = () => {
    if (!selectedCustomerId || selectedReceivableIds.length === 0) {
      toast.error('Selecione o cliente e ao menos uma parcela.')
      return
    }
    const negotiated = parseFloat(form.negotiated_total) || selectedTotal
    createMut.mutate({
      customer_id: parseInt(selectedCustomerId, 10),
      receivable_ids: selectedReceivableIds,
      negotiated_total: negotiated,
      discount_amount: parseFloat(form.discount_amount) || 0,
      interest_amount: parseFloat(form.interest_amount) || 0,
      fine_amount: parseFloat(form.fine_amount) || 0,
      new_installments: parseInt(form.new_installments, 10) || 1,
      first_due_date: form.first_due_date,
      notes: form.notes,
    })
  }

  const toggleReceivable = (id: number) => {
    setSelectedReceivableIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectAllReceivables = () => {
    if (selectedReceivableIds.length === receivables.length) {
      setSelectedReceivableIds([])
    } else {
      setSelectedReceivableIds(receivables.map(r => r.id))
    }
  }

  const list = renegotiationsData?.data ?? renegotiationsData ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Renegociação de Dívidas" subtitle="Gerencie renegociações de parcelas em atraso">
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Nova Renegociação</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Renegociação</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Cliente</label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-content-secondary" />
                  <Input
                    placeholder="Buscar cliente por nome..."
                    value={selectedCustomerId ? selectedCustomerName : customerSearch}
                    onChange={e => {
                      setCustomerSearch(e.target.value)
                      setCustomerDropdownOpen(true)
                      if (!e.target.value) {
                        setSelectedCustomerId('')
                        setSelectedCustomerName('')
                      }
                    }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 200)}
                    className="pl-9"
                  />
                </div>
                {customerDropdownOpen && !selectedCustomerId && (
                  <ul className="mt-1 border rounded-lg max-h-48 overflow-y-auto bg-surface-0">
                    {customersLoading && (
                      <li className="p-3 flex items-center gap-2 text-content-secondary">
                        <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                      </li>
                    )}
                    {!customersLoading && customerOptions.length === 0 && (
                      <li className="p-3 text-sm text-content-secondary">Nenhum cliente encontrado.</li>
                    )}
                    {!customersLoading && customerOptions.map(c => (
                      <li
                        key={c.id}
                        className={`p-3 cursor-pointer hover:bg-surface-100 ${selectedCustomerId === String(c.id) ? 'bg-brand-50' : ''}`}
                        onClick={() => {
                          setSelectedCustomerId(String(c.id))
                          setSelectedCustomerName(c.name)
                          setCustomerSearch('')
                        }}
                      >
                        <span className="font-medium">{c.name}</span>
                        {c.document && <span className="text-xs text-content-secondary ml-2">{c.document}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selectedCustomerId && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Parcelas em aberto do cliente</label>
                    <Button type="button" variant="ghost" size="sm" onClick={selectAllReceivables}>
                      {selectedReceivableIds.length === receivables.length ? 'Desmarcar todas' : 'Selecionar todas'}
                    </Button>
                  </div>
                  {receivablesLoading ? (
                    <div className="flex items-center gap-2 py-4 text-content-secondary">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando parcelas...
                    </div>
                  ) : receivables.length === 0 ? (
                    <p className="text-sm text-content-secondary py-2">Nenhuma parcela em aberto para este cliente.</p>
                  ) : (
                    <ul className="border rounded-lg max-h-48 overflow-y-auto divide-y">
                      {receivables.map(r => {
                        const remaining = Number(r.amount) - Number(r.amount_paid)
                        const checked = selectedReceivableIds.includes(r.id)
                        return (
                          <li
                            key={r.id}
                            className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-50 ${checked ? 'bg-brand-50' : ''}`}
                            onClick={() => toggleReceivable(r.id)}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleReceivable(r.id)}
                              onClick={e => e.stopPropagation()}
                              className="rounded border-default"
                              aria-label={`Selecionar parcela ${r.description || r.id}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{r.description || '—'}</div>
                              <div className="text-xs text-content-secondary">
                                Venc.: {fmtDate(r.due_date)} · {r.status}
                              </div>
                            </div>
                            <span className="font-medium shrink-0">{fmt(remaining)}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {selectedReceivableIds.length > 0 && (
                    <p className="mt-2 text-sm text-content-secondary">
                      Total selecionado: <strong>{fmt(selectedTotal)}</strong> ({selectedReceivableIds.length} parcela(s))
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Valor Negociado (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.negotiated_total || (selectedReceivableIds.length ? String(selectedTotal) : '')}
                    onChange={e => setForm(p => ({ ...p, negotiated_total: e.target.value }))}
                    placeholder={selectedReceivableIds.length ? String(selectedTotal) : ''}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Nº de Parcelas</label>
                  <Input
                    type="number"
                    min={1}
                    value={form.new_installments}
                    onChange={e => setForm(p => ({ ...p, new_installments: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Desconto</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.discount_amount}
                    onChange={e => setForm(p => ({ ...p, discount_amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Juros</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.interest_amount}
                    onChange={e => setForm(p => ({ ...p, interest_amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Multa</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.fine_amount}
                    onChange={e => setForm(p => ({ ...p, fine_amount: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">1º Vencimento</label>
                <Input
                  type="date"
                  value={form.first_due_date}
                  onChange={e => setForm(p => ({ ...p, first_due_date: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="reneg-notes" className="text-sm font-medium">Observações</label>
                <textarea
                  id="reneg-notes"
                  className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-surface-0"
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  placeholder="Observações da renegociação"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMut.isPending || !selectedCustomerId || selectedReceivableIds.length === 0}
                >
                  {createMut.isPending ? 'Criando...' : 'Criar Renegociação'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-content-secondary">Carregando...</p>
          ) : list.length === 0 ? (
            <div className="text-center py-12 text-content-secondary">
              <HandCoins className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma renegociação registrada.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3">#</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Valor Original</th>
                  <th className="p-3">Valor Negociado</th>
                  <th className="p-3">Parcelas</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Criado em</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r: any) => {
                  const st = statusLabels[r.status] ?? statusLabels.pending
                  return (
                    <tr key={r.id} className="border-b hover:bg-surface-50">
                      <td className="p-3">{r.id}</td>
                      <td className="p-3 font-medium">{r.customer?.name ?? '—'}</td>
                      <td className="p-3">{fmt(r.original_total)}</td>
                      <td className="p-3 font-medium">{fmt(r.negotiated_total)}</td>
                      <td className="p-3">{r.new_installments}x</td>
                      <td className="p-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                      <td className="p-3">{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3">
                        {r.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => approveMut.mutate(r.id)}>
                              <Check className="h-3 w-3 mr-1" /> Aprovar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => rejectMut.mutate(r.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
