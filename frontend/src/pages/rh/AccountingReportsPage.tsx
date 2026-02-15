import { useState , useMemo } from 'react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileDown, Search } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface ReportEntry {
    id: number
    date: string
    user: { name: string }
    scheduled_hours: string
    worked_hours: string
    overtime_hours_50: string
    overtime_hours_100: string
    night_hours: string
    absence_hours: string
    hour_bank_balance: string
}

export default function AccountingReportsPage() {

    const [startDate, setStartDate] = useState(format(new Date().setDate(1), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [data, setData] = useState<ReportEntry[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const fetchReport = async () => {
        setIsLoading(true)
        try {
            const response = await api.get('/hr/reports/accounting', {
                params: { start_date: startDate, end_date: endDate }
            })
            setData(response.data.data)
        } catch (error) {
            toast.error('Erro ao gerar relatório')
        } finally {
            setIsLoading(false)
        }
    }

    const handleExport = async (format: 'csv' | 'json') => {
        try {
            const response = await api.get('/hr/reports/accounting/export', {
                params: { start_date: startDate, end_date: endDate, format },
                responseType: 'blob'
            })

            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `relatorio_contabil.${format}`)
            document.body.appendChild(link)
            link.click()
            link.remove()
        } catch (error) {
            toast.error('Erro ao exportar relatório')
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Relatórios Contábeis</h1>
                <p className="text-muted-foreground">Exportação de jornada para a contabilidade.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                    <CardDescription>Selecione o período para gerar o relatório.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="space-y-2 flex-1">
                            <Label>Data Inicial</Label>
                            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-2 flex-1">
                            <Label>Data Final</Label>
                            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                        <Button onClick={fetchReport} disabled={isLoading}>
                            <Search className="mr-2 h-4 w-4" /> Gerar Visualização
                        </Button>
                        <Button variant="outline" onClick={() => handleExport('csv')} disabled={isLoading}>
                            <FileDown className="mr-2 h-4 w-4" /> Exportar CSV
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {data.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Pré-visualização</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Colaborador</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Previsto</TableHead>
                                    <TableHead>Trabalhado</TableHead>
                                    <TableHead>HE 50%</TableHead>
                                    <TableHead>HE 100%</TableHead>
                                    <TableHead>Ad. Noturno</TableHead>
                                    <TableHead>Faltas</TableHead>
                                    <TableHead>Banco</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((entry) => (
                                    <TableRow key={entry.id}>
                                        <TableCell>{entry.user.name}</TableCell>
                                        <TableCell>{format(new Date(entry.date), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>{entry.scheduled_hours}</TableCell>
                                        <TableCell>{entry.worked_hours}</TableCell>
                                        <TableCell>{entry.overtime_hours_50}</TableCell>
                                        <TableCell>{entry.overtime_hours_100}</TableCell>
                                        <TableCell>{entry.night_hours}</TableCell>
                                        <TableCell>{entry.absence_hours}</TableCell>
                                        <TableCell>{entry.hour_bank_balance}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
            {!isLoading && data.length === 0 && (
                <Card>
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                        Sem dados para o período selecionado.
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

