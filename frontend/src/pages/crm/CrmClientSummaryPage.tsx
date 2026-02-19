import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getClientSummary } from '@/lib/crm-field-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, FileText, User, Phone, Mail, MapPin, Calendar, Wrench, Handshake, Printer, Download } from 'lucide-react'
import api from '@/lib/api'

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '-'
const ratingColors: Record<string, string> = { A: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300', B: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300', C: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300', D: 'bg-surface-100 text-surface-600' }

function exportPDF() {
    const style = document.createElement('style')
    style.id = 'pdf-print-style'
    style.textContent = `
        @media print {
            body > *:not(#root) { display: none !important; }
            nav, header, aside, [data-sidebar], .no-print { display: none !important; }
            main { padding: 0 !important; margin: 0 !important; }
            .print-area { break-inside: avoid; }
            @page { margin: 1cm; size: A4; }
        }
    `
    document.head.appendChild(style)
    window.print()
    setTimeout(() => style.remove(), 1000)
}

export function CrmClientSummaryPage() {
    const [customerId, setCustomerId] = useState<number | null>(null)
    const [search, setSearch] = useState('')

    const searchQ = useQuery({
        queryKey: ['customers-summary-search', search],
        queryFn: () => api.get('/customers', { params: { search, per_page: 8, is_active: true } }).then(r => r.data?.data ?? []),
        enabled: search.length >= 2,
    })

    const { data, isLoading } = useQuery({
        queryKey: ['client-summary', customerId],
        queryFn: () => getClientSummary(customerId!),
        enabled: !!customerId,
    })

    return (
        <div className="space-y-6">
            <PageHeader title="Ficha Resumo do Cliente" description="Resumo de uma página para levar na visita" />
            <div className="flex items-center gap-4 max-w-md no-print">
                <div className="flex-1">
                    <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
                    {(searchQ.data ?? []).length > 0 && search.length >= 2 && (
                        <div className="border rounded-md max-h-40 overflow-auto mt-1">{(searchQ.data ?? []).map((c: { id: number; name: string }) => (
                            <button key={c.id} className={`w-full text-left px-3 py-2 hover:bg-accent text-sm`} onClick={() => { setCustomerId(c.id); setSearch(c.name) }}>{c.name}</button>
                        ))}</div>
                    )}
                </div>
                {data && (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
                        <Button variant="default" onClick={exportPDF}><Download className="h-4 w-4 mr-2" />Exportar PDF</Button>
                    </div>
                )}
            </div>

            {customerId && isLoading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}

            {data && (
                <div className="print:p-4 space-y-4">
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />{data.customer.name}</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div><span className="text-muted-foreground">Documento:</span> {data.customer.document ?? '-'}</div>
                                <div><Phone className="h-3.5 w-3.5 inline mr-1" />{data.customer.phone ?? '-'}</div>
                                <div><Mail className="h-3.5 w-3.5 inline mr-1" />{data.customer.email ?? '-'}</div>
                                <div><MapPin className="h-3.5 w-3.5 inline mr-1" />{data.customer.address_city ?? '-'}, {data.customer.address_state ?? '-'}</div>
                                <div>Rating: {data.customer.rating ? <Badge className={ratingColors[data.customer.rating]}>{data.customer.rating}</Badge> : '-'}</div>
                                <div>Health Score: <Badge variant="outline">{data.customer.health_score ?? '-'}</Badge></div>
                                <div>Segmento: {data.customer.segment ?? '-'}</div>
                                <div>Último Contato: {fmtDate(data.customer.last_contact_at)}</div>
                                <div>Próx. Follow-up: {fmtDate(data.customer.next_follow_up_at)}</div>
                            </div>
                        </CardContent>
                    </Card>

                    {data.contacts?.length > 0 && (
                        <Card><CardHeader><CardTitle className="text-base">Contatos</CardTitle></CardHeader><CardContent>
                            <div className="grid grid-cols-2 gap-2 text-sm">{data.contacts.map((c: { name: string; role: string; phone: string; email: string; is_primary: boolean }, i: number) => (
                                <div key={i} className="p-2 bg-muted/50 rounded"><p className="font-medium">{c.name} {c.is_primary && <Badge className="ml-1 text-xs">Principal</Badge>}</p><p className="text-muted-foreground">{c.role} · {c.phone} · {c.email}</p></div>
                            ))}</div>
                        </CardContent></Card>
                    )}

                    {data.equipments_due?.length > 0 && (
                        <Card><CardHeader><CardTitle className="text-base"><Wrench className="h-4 w-4 inline mr-1" />Equipamentos - Calibração Vencendo</CardTitle></CardHeader><CardContent>
                            <div className="space-y-1 text-sm">{data.equipments_due.map((e: { code: string; brand: string; model: string; next_calibration_at: string }, i: number) => (
                                <div key={i} className="flex justify-between p-1.5 bg-orange-50 rounded"><span>{e.brand} {e.model} ({e.code})</span><span className="text-orange-600">{fmtDate(e.next_calibration_at)}</span></div>
                            ))}</div>
                        </CardContent></Card>
                    )}

                    {data.pending_commitments?.length > 0 && (
                        <Card><CardHeader><CardTitle className="text-base"><Handshake className="h-4 w-4 inline mr-1" />Compromissos Pendentes</CardTitle></CardHeader><CardContent>
                            <div className="space-y-1 text-sm">{data.pending_commitments.map((c: { title: string; due_date: string; responsible_type: string; priority: string }, i: number) => (
                                <div key={i} className="flex justify-between p-1.5 bg-muted/50 rounded"><span>{c.title}</span><span className="text-muted-foreground">{c.due_date ? fmtDate(c.due_date) : 'Sem prazo'}</span></div>
                            ))}</div>
                        </CardContent></Card>
                    )}

                    {data.pending_quotes?.length > 0 && (
                        <Card><CardHeader><CardTitle className="text-base"><FileText className="h-4 w-4 inline mr-1" />Orçamentos Pendentes</CardTitle></CardHeader><CardContent>
                            <div className="space-y-1 text-sm">{data.pending_quotes.map((q: { quote_number: string; total: number; created_at: string }, i: number) => (
                                <div key={i} className="flex justify-between p-1.5 bg-muted/50 rounded"><span>#{q.quote_number}</span><span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(q.total)}</span></div>
                            ))}</div>
                        </CardContent></Card>
                    )}
                </div>
            )}
        </div>
    )
}
