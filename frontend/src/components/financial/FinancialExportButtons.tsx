import React, { useState } from 'react'
import { Download, FileSpreadsheet, Landmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'

interface ExportButtonsProps {
    type: 'receivable' | 'payable'
}

export function FinancialExportButtons({ type }: ExportButtonsProps) {
    const [showModal, setShowModal] = useState(false)
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [loading, setLoading] = useState(false)

    async function doExport(format: 'csv' | 'ofx') {
        if (!from || !to) return
        setLoading(true)
        try {
            const res = await api.get(`/financial/export/${format}`, {
                params: { type, from, to },
                responseType: 'blob',
            })
            const blob = new Blob([res.data])
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `export_${type}_${from}_${to}.${format}`
            a.click()
            URL.revokeObjectURL(url)
            setShowModal(false)
        } catch {
            alert('Erro ao exportar')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <Button variant="secondary" size="sm" onClick={() => setShowModal(true)}>
                <Download className="h-4 w-4 mr-1" /> Exportar
            </Button>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowModal(false)}>
                    <div className="bg-surface-0 border border-default rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-surface-900">Exportar Financeiro</h3>

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-sm text-surface-500">De</label>
                                <input type="date" className="w-full rounded-lg bg-surface-50 border border-default px-3 py-2 text-sm text-surface-900"
                                    value={from} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFrom(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm text-surface-500">Até</label>
                                <input type="date" className="w-full rounded-lg bg-surface-50 border border-default px-3 py-2 text-sm text-surface-900"
                                    value={to} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTo(e.target.value)} />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button onClick={() => doExport('csv')} disabled={loading || !from || !to} className="flex-1">
                                <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
                            </Button>
                            <Button onClick={() => doExport('ofx')} disabled={loading || !from || !to} variant="secondary" className="flex-1">
                                <Landmark className="h-4 w-4 mr-1" /> OFX
                            </Button>
                        </div>

                        <button className="text-sm text-surface-400 hover:text-surface-600 w-full text-center"
                            onClick={() => setShowModal(false)}>
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
