import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function EquipmentDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/equipamentos')}>
                    Voltar
                </Button>
                <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Detalhes do Equipamento #{id}</h1>
            </div>
            <div className="rounded-xl border border-default bg-surface-0 p-6 shadow-card">
                <p className="text-surface-500">Detalhes do equipamento em desenvolvimento.</p>
            </div>
        </div>
    )
}
