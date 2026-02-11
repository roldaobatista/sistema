import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface Option {
    id: number;
    label: string;
    subLabel?: string;
    value: any;
}

interface AsyncSelectProps {
    value?: number | null;
    onChange: (value: Option | null) => void;
    endpoint: string;
    placeholder?: string;
    label?: string;
    disabled?: boolean;
    renderOption?: (option: any) => React.ReactNode;
    mapData?: (data: any[]) => Option[];
}

export function AsyncSelect({
    value,
    onChange,
    endpoint,
    placeholder = 'Selecione...',
    label,
    disabled = false,
    renderOption,
    mapData
}: AsyncSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [options, setOptions] = useState<Option[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedOption, setSelectedOption] = useState<Option | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load initial selection if value provided
    useEffect(() => {
        if (value && !selectedOption) {
            // If we have a value but no object, we might need to fetch it or generic display
            // For now, simpler approach: we assume the parent handles the "selected" state display if we don't have the object
            // Or we fetch the specific item. Let's try to fetch specific item if endpoint supports it.
            // But usually this component is used for *searching*.
            // Let's rely on the parent updating selectedOption via some mechanism or just displaying ID if not found?
            // Better: trigger a search for the ID if possible? No, standard APIs usually search by name.
            // Let's just trust the parent to pass the full object if they want, OR we fetch.
            // For create page, value starts null, so it's fine. 
        }
    }, [value]);

    const fetchOptions = async (query: string) => {
        setLoading(true);
        try {
            const res = await api.get(endpoint, { params: { search: query, per_page: 20 } });
            const data = res.data.data || res.data;

            let mapped: Option[] = [];
            if (mapData) {
                mapped = mapData(data);
            } else {
                mapped = data.map((item: any) => ({
                    id: item.id,
                    label: item.name || item.title || `#${item.id}`,
                    subLabel: item.price ? `R$ ${item.price}` : undefined,
                    value: item
                }));
            }
            setOptions(mapped);
        } catch (error) {
            console.error('Error fetching options', error);
            setOptions([]);
        } finally {
            setLoading(false);
        }
    };

    // Debounce search
    useEffect(() => {
        if (isOpen) {
            const timeout = setTimeout(() => {
                fetchOptions(search);
            }, 300);
            return () => clearTimeout(timeout);
        }
    }, [search, isOpen, endpoint]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (opt: Option) => {
        setSelectedOption(opt);
        onChange(opt);
        setIsOpen(false);
        setSearch('');
    };

    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={cn(
                    "relative flex w-full items-center justify-between rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm shadow-sm cursor-pointer hover:bg-surface-100 transition-colors",
                    disabled && "opacity-50 cursor-not-allowed",
                    isOpen && "ring-2 ring-brand-500/20 border-brand-500"
                )}
            >
                <div className="flex-1 truncate">
                    {selectedOption ? (
                        <span className="font-medium text-surface-900">{selectedOption.label}</span>
                    ) : (
                        <span className="text-surface-400">{placeholder}</span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {selectedOption && !disabled && (
                        <div onClick={(e) => { e.stopPropagation(); setSelectedOption(null); onChange(null); }}
                            className="rounded-full p-0.5 hover:bg-surface-200 text-surface-400">
                            <X className="h-4 w-4" />
                        </div>
                    )}
                    <Search className="h-4 w-4 text-surface-400" />
                </div>
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-default bg-surface-0 shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-subtle">
                        <input
                            ref={inputRef}
                            autoFocus
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar..."
                            className="w-full rounded-lg bg-surface-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                        {loading ? (
                            <div className="flex items-center justify-center py-4 text-surface-400">
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                        ) : options.length === 0 ? (
                            <div className="py-3 text-center text-sm text-surface-500">
                                Nenhum resultado encontrado
                            </div>
                        ) : (
                            options.map((opt) => (
                                <div
                                    key={opt.id}
                                    onClick={() => handleSelect(opt)}
                                    className="cursor-pointer rounded-lg px-3 py-2 text-sm hover:bg-surface-50 transition-colors"
                                >
                                    <div className="font-medium text-surface-900">{opt.label}</div>
                                    {opt.subLabel && <div className="text-xs text-surface-500">{opt.subLabel}</div>}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
