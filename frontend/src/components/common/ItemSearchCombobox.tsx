import React, { useState } from 'react'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ChevronsUpDown, Package, Wrench, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ItemSearchCombobox({
    items,
    type,
    value,
    onSelect,
    placeholder,
    className
}: {
    items: any[]
    type: 'product' | 'service'
    value?: number | null
    onSelect: (id: number) => void
    placeholder?: string
    className?: string
}) {
    const [open, setOpen] = useState(false)
    const Icon = type === 'product' ? Package : Wrench
    const selectedItem = items?.find(i => i.id === value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("justify-between font-normal text-left", className)}
                >
                    <span className="flex items-center gap-2 truncate min-w-0 flex-1 mr-2">
                        <Icon className="h-4 w-4 shrink-0 text-surface-500" />
                        <span className={cn("truncate", selectedItem ? "text-surface-900" : "text-surface-500")}>
                            {selectedItem ? selectedItem.name : (placeholder || 'Selecione...')}
                        </span>
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] sm:w-[350px] md:w-[400px] p-0" align="start">
                <Command filter={(val, search) => {
                    const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                    const normalizedValue = normalize(val)
                    const normalizedSearch = normalize(search)
                    return normalizedValue.includes(normalizedSearch) ? 1 : 0
                }}>
                    <CommandInput placeholder="Buscar por nome ou código..." className="h-9" />
                    <CommandList>
                        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                        <CommandGroup>
                            {items?.map((item) => {
                                const price = item.sell_price ?? item.default_price ?? 0
                                return (
                                    <CommandItem
                                        key={item.id}
                                        value={`[${item.id}] ${item.name} ${item.code || ''}`}
                                        onSelect={() => {
                                            onSelect(item.id)
                                            setOpen(false)
                                        }}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4 shrink-0", value === item.id ? "opacity-100" : "opacity-0")} />
                                        <div className="flex flex-col gap-0.5 w-full min-w-0">
                                            <div className="flex justify-between w-full min-w-0">
                                                <span className="font-medium truncate mr-2">{item.name}</span>
                                                <span className="text-xs text-brand-600 font-medium whitespace-nowrap shrink-0">
                                                    R$ {Number(price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-surface-400">
                                                Cód: {item.id} {item.code ? `| Ref: ${item.code}` : ''}
                                            </span>
                                        </div>
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
