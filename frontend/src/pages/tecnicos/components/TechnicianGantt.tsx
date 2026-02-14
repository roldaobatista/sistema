import { useMemo , useState } from 'react'
import { format, differenceInMinutes, startOfDay, addHours, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

import type { Technician, ScheduleItem } from '@/types/operational'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Loader2, Search, Trash2, AlertCircle, Inbox } from 'lucide-react'

interface TechnicianGanttProps {
    date: Date
    technicians: Technician[]
    items: ScheduleItem[]
    onItemClick?: (item: ScheduleItem) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const PIXELS_PER_HOUR = 100
const START_HOUR = 6 // 06:00
const END_HOUR = 20 // 20:00

export function TechnicianGantt({ date, technicians, items, onItemClick }: TechnicianGanttProps) {

  // MVP: Data fetching
  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: ['technician-gantt'],
    queryFn: () => api.get('/technician-gantt').then(r => r.data?.data ?? r.data ?? []),
  })

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/technician-gantt/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['technician-gantt'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }

  // MVP: Loading/Error/Empty states
  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (isError) return <div className="flex flex-col items-center justify-center p-8 text-red-500"><AlertCircle className="h-8 w-8 mb-2" /><p>Erro ao carregar dados</p><button onClick={() => refetch()} className="mt-2 text-blue-500 underline">Tentar novamente</button></div>
  if (!items || (Array.isArray(items) && items.length === 0)) return <div className="flex flex-col items-center justify-center p-8 text-gray-400"><Inbox className="h-12 w-12 mb-2" /><p>Nenhum registro encontrado</p></div>
  const { user } = useAuthStore()
  const hasPermission = (p: string) => user?.all_permissions?.includes(p) ?? false
    // Filter items for the selected date
    const dailyItems = useMemo(() => {
        return items.filter(item => isSameDay(new Date(item.start), date))
    }, [items, date])

    // Convert time to pixels relative to START_HOUR
    const getPosition = (dateStr: string) => {
        const d = new Date(dateStr)
        const startOfDayDate = startOfDay(d)
        const startOffset = addHours(startOfDayDate, START_HOUR)

        const minutesFromStart = differenceInMinutes(d, startOffset)
        return (minutesFromStart / 60) * PIXELS_PER_HOUR
    }

    const getWidth = (startStr: string, endStr: string) => {
        const start = new Date(startStr)
        const end = new Date(endStr)
        const durationMinutes = differenceInMinutes(end, start)
        return Math.max((durationMinutes / 60) * PIXELS_PER_HOUR, 4) // Min 4px width
    }

    const getStatusColor = (status: string, source: string) => {
        if (source === 'crm') return 'bg-purple-100 border-purple-300 text-purple-700'
        if (source === 'service_call') return 'bg-orange-100 border-orange-300 text-orange-700'

        switch (status) {
            case 'scheduled': return 'bg-blue-100 border-blue-300 text-blue-700'
            case 'confirmed': return 'bg-indigo-100 border-indigo-300 text-indigo-700'
            case 'completed': return 'bg-green-100 border-green-300 text-green-700'
            case 'cancelled': return 'bg-red-100 border-red-300 text-red-700'
            default: return 'bg-gray-100 border-gray-300 text-gray-700'
        }
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-border bg-white shadow-sm">
            <div className="min-w-[800px]">
                {/* Header: Hours */}
                <div className="flex border-b border-border bg-muted/50">
                    <div className="w-48 shrink-0 border-r border-border p-3 text-sm font-medium text-muted-foreground">
                        Técnico
                    </div>
                    <div className="relative flex h-10 grow">
                        {HOURS.slice(START_HOUR, END_HOUR + 1).map(hour => (
                            <div
                                key={hour}
                                className="absolute border-l border-border/50 px-1 text-xs text-muted-foreground"
                                style={{ left: `${(hour - START_HOUR) * PIXELS_PER_HOUR}px`, width: `${PIXELS_PER_HOUR}px` }}
                            >
                                {hour}:00
                            </div>
                        ))}
                    </div>
                </div>

                {/* Body: Technicians Rows */}
                <div className="divide-y divide-border">
                    {technicians.map(tech => {
                        const techItems = dailyItems.filter(i => i.technician?.id === tech.id)

                        return (
                            <div key={tech.id} className="flex h-20 group hover:bg-muted/5">
                                {/* Technician Info */}
                                <div className="flex w-48 shrink-0 items-center gap-3 border-r border-border p-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={tech.avatar} />
                                        <AvatarFallback>{tech.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="overflow-hidden">
                                        <p className="truncate text-sm font-medium text-foreground">{tech.name}</p>
                                        <p className="text-xs text-muted-foreground">{techItems.length} tarefas</p>
                                    </div>
                                </div>

                                {/* Timeline Track */}
                                <div className="relative grow bg-[repeating-linear-gradient(90deg,transparent,transparent_99px,rgba(0,0,0,0.05)_100px)]">
                                    {techItems.map(item => {
                                        const left = getPosition(item.start)
                                        const width = getWidth(item.start, item.end)

                                        // Skip items completely out of view
                                        if (left + width < 0) return null

                                        return (
                                            <TooltipProvider key={item.id}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            onClick={() => onItemClick?.(item)}
                                                            className={cn(
                                                                "absolute top-2 h-14 rounded-md border text-left text-xs transition-all hover:brightness-95",
                                                                getStatusColor(item.status, item.source)
                                                            )}
                                                            style={{
                                                                left: `${Math.max(0, left)}px`,
                                                                width: `${width}px`
                                                            }}
                                                        >
                                                            <div className="mx-1 mt-1 truncate font-medium leading-tight">
                                                                {item.title}
                                                            </div>
                                                            <div className="mx-1 truncate opacity-80">
                                                                {item.customer?.name}
                                                            </div>
                                                            <div className="mx-1 truncate text-[10px] opacity-70">
                                                                {format(new Date(item.start), 'HH:mm')} - {format(new Date(item.end), 'HH:mm')}
                                                            </div>
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <div className="space-y-1">
                                                            <p className="font-semibold">{item.title}</p>
                                                            <p className="text-sm">{item.customer?.name}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {format(new Date(item.start), 'dd/MM HH:mm')} - {format(new Date(item.end), 'HH:mm', { locale: ptBR })}
                                                            </p>
                                                            {item.notes && <p className="text-xs italic text-muted-foreground">{item.notes}</p>}
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )
                                    })}

                                    {/* Current Time Indicator */}
                                    {isSameDay(date, new Date()) && (
                                        <div
                                            className="absolute top-0 bottom-0 w-0.5 z-10 bg-red-500 pointer-events-none"
                                            style={{ left: `${getPosition(new Date().toISOString())}px` }}
                                        >
                                            <div className="absolute -top-1 -ml-1 h-2 w-2 rounded-full bg-red-500" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
