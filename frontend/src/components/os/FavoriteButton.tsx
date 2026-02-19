import { useState, useEffect } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const LS_KEY = 'os_favorites'

function getFavorites(): number[] {
    try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') }
    catch { return [] }
}

function setFavorites(ids: number[]) {
    localStorage.setItem(LS_KEY, JSON.stringify(ids))
}

export function useFavorites() {
    const [favs, setFavs] = useState<number[]>(getFavorites)

    const toggle = (id: number) => {
        setFavs(prev => {
            const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
            setFavorites(next)
            return next
        })
    }

    const isFav = (id: number) => favs.includes(id)

    return { favorites: favs, toggle, isFav }
}

interface FavoriteButtonProps {
    workOrderId: number
    className?: string
}

export default function FavoriteButton({ workOrderId, className }: FavoriteButtonProps) {
    const { isFav, toggle } = useFavorites()
    const active = isFav(workOrderId)

    return (
        <button
            onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                toggle(workOrderId)
                toast.success(active ? 'Removido dos favoritos' : 'Adicionado aos favoritos')
            }}
            className={cn('transition-all', className)}
            aria-label={active ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
            <Star className={cn(
                'h-4 w-4 transition-all',
                active ? 'fill-amber-400 text-amber-400 scale-110' : 'text-surface-300 hover:text-amber-300'
            )} />
        </button>
    )
}
