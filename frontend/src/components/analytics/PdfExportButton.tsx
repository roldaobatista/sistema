import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { toast } from 'sonner'

interface PdfExportButtonProps {
    elementId: string
    fileName?: string
}

export function PdfExportButton({ elementId, fileName = 'dashboard-analytics' }: PdfExportButtonProps) {
    const [isExporting, setIsExporting] = useState(false)

    const handleExport = async () => {
        const element = document.getElementById(elementId)
        if (!element) {
            toast.error('Elemento não encontrado para exportação')
            return
        }

        try {
            setIsExporting(true)
            toast.info('Gerando PDF...', { description: 'Isso pode levar alguns segundos.' })

            // Aguardar animações terminarem (opcional, hack de delay)
            await new Promise(resolve => setTimeout(resolve, 500))

            // Capturar
            const canvas = await html2canvas(element, {
                scale: 2, // Maior qualidade
                useCORS: true,
                logging: false,
                backgroundColor: '#f8fafc', // Cor de fundo fixa para evitar transparência preta (bg-surface-50 equivalent default)
                ignoreElements: (element) => element.classList.contains('no-print')
            })

            const imgData = canvas.toDataURL('image/png')

            // Configurar PDF (A4 Portrait ou Landscape dependendo do aspect ratio)
            const imgWidth = canvas.width
            const imgHeight = canvas.height
            const orientation = imgWidth > imgHeight ? 'l' : 'p'

            const pdf = new jsPDF(orientation, 'mm', 'a4')
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = pdf.internal.pageSize.getHeight()

            // Ajustar imagem ao PDF mantendo aspecto
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
            const finalWidth = imgWidth * ratio
            const finalHeight = imgHeight * ratio

            // Centralizar
            const x = (pdfWidth - finalWidth) / 2
            const y = 10 // Margem superior

            pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight)

            // Header do PDF
            pdf.setFontSize(10)
            pdf.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 10, pdfHeight - 10)

            pdf.save(`${fileName}.pdf`)
            toast.success('PDF gerado com sucesso!')

        } catch (error) {
            console.error('Erro ao gerar PDF:', error)
            toast.error('Falha ao gerar PDF')
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-default bg-surface-0 hover:bg-surface-50 text-surface-700 transition disabled:opacity-50"
            title="Exportar como PDF"
        >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            <span className="text-sm font-medium hidden sm:inline">Exportar PDF</span>
        </button>
    )
}
