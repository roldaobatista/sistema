import { FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'

interface ExcelExportProps {
    filters?: Record<string, any>
}

export default function ExcelExport({ filters = {} }: ExcelExportProps) {
    const handleExport = async () => {
        try {
            toast.loading('Gerando relatório...')
            const response = await api.get('/work-orders/export', {
                params: { ...filters, format: 'xlsx' },
                responseType: 'blob',
            })

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `ordens-servico-${new Date().toISOString().slice(0, 10)}.xlsx`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)

            toast.dismiss()
            toast.success('Relatório exportado com sucesso!')
        } catch {
            toast.dismiss()
            toast.error('Erro ao exportar relatório')
        }
    }

    return (
        <Button variant="outline" size="sm" onClick={handleExport} icon={<FileSpreadsheet className="h-4 w-4" />}>
            <span>Excel</span>
        </Button>
    )
}
