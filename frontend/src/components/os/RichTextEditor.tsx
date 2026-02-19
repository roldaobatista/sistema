import { useState, useRef, useCallback } from 'react'
import { Bold, Italic, List, ListOrdered, Heading2, Image as ImageIcon, Type } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    minHeight?: string
}

export default function RichTextEditor({ value, onChange, placeholder = 'Digite o laudo...', minHeight = '200px' }: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null)

    const exec = (cmd: string, val?: string) => {
        document.execCommand(cmd, false, val)
        editorRef.current?.focus()
        // Sync value
        if (editorRef.current) onChange(editorRef.current.innerHTML)
    }

    const handleInput = () => {
        if (editorRef.current) onChange(editorRef.current.innerHTML)
    }

    const tools = [
        { icon: Bold, cmd: 'bold', label: 'Negrito' },
        { icon: Italic, cmd: 'italic', label: 'Itálico' },
        { icon: Heading2, cmd: 'formatBlock', val: 'h3', label: 'Título' },
        { icon: List, cmd: 'insertUnorderedList', label: 'Lista' },
        { icon: ListOrdered, cmd: 'insertOrderedList', label: 'Lista numerada' },
    ]

    return (
        <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-subtle bg-surface-50">
                {tools.map(t => {
                    const Icon = t.icon
                    return (
                        <button
                            key={t.cmd}
                            onClick={() => exec(t.cmd, t.val)}
                            className="rounded-md p-1.5 text-surface-500 hover:bg-surface-200 hover:text-surface-700 transition-colors"
                            aria-label={t.label}
                            title={t.label}
                        >
                            <Icon className="h-3.5 w-3.5" />
                        </button>
                    )
                })}
            </div>

            {/* Editable area */}
            <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                dangerouslySetInnerHTML={{ __html: value }}
                data-placeholder={placeholder}
                className={cn(
                    'px-4 py-3 text-sm text-surface-800 focus:outline-none',
                    'prose prose-sm max-w-none',
                    '[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-surface-400'
                )}
                style={{ minHeight }}
            />
        </div>
    )
}
