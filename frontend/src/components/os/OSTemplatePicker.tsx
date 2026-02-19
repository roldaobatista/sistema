import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, ChevronDown } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Template {
    id: number
    name: string
    description?: string
    checklist_items?: string[]
    default_priority?: string
    default_category?: string
}

interface OSTemplatePickerProps {
    onApply: (template: Template) => void
}

export default function OSTemplatePicker({ onApply }: OSTemplatePickerProps) {
    const [isOpen, setIsOpen] = useState(false)

    const { data: templatesRes } = useQuery({
        queryKey: ['os-templates'],
        queryFn: () => api.get('/work-order-templates'),
        enabled: isOpen,
    })
    const templates: Template[] = templatesRes?.data?.data ?? []

    return (
        <div className="relative">
            <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(!isOpen)}
                icon={<FileText className="h-4 w-4" />}
            >
                <span>Templates</span>
                <ChevronDown className={cn('ml-1 h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
            </Button>

            {isOpen && (
                <div className="absolute top-full mt-1 right-0 z-50 w-72 rounded-xl border border-default bg-surface-0 shadow-lg overflow-hidden">
                    <div className="px-3 py-2 border-b border-subtle">
                        <p className="text-xs font-semibold text-surface-600">Selecione um template</p>
                    </div>
                    {templates.length === 0 ? (
                        <div className="px-3 py-4 text-center">
                            <p className="text-xs text-surface-400">Nenhum template encontrado</p>
                        </div>
                    ) : (
                        <div className="max-h-48 overflow-y-auto">
                            {templates.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => {
                                        onApply(t)
                                        setIsOpen(false)
                                        toast.success(`Template "${t.name}" aplicado`)
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-brand-50 transition-colors border-b border-subtle/50 last:border-0"
                                >
                                    <span className="text-xs font-medium text-surface-800">{t.name}</span>
                                    {t.description && (
                                        <p className="text-[10px] text-surface-400 mt-0.5 truncate">{t.description}</p>
                                    )}
                                    {t.checklist_items && (
                                        <p className="text-[10px] text-brand-500 mt-0.5">
                                            {t.checklist_items.length} itens de checklist
                                        </p>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
