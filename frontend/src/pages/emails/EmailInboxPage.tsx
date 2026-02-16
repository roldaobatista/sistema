import { useState, useMemo, useEffect } from 'react'
import DOMPurify from 'dompurify'
import { toast } from 'sonner'
import { useEmails, useEmail, useEmailStats, useToggleEmailStar, useMarkEmailRead, useArchiveEmail, useEmailBatchAction, useReplyEmail, useForwardEmail, useCreateTaskFromEmail, type EmailItem, type EmailFilters } from '@/hooks/useEmails'
import { useEmailAccounts } from '@/hooks/useEmailAccounts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
    Mail, Inbox, Send, Star, Archive, Search, RefreshCw, MoreHorizontal,
    Reply, Forward, Paperclip, CheckCheck, Clock, Sparkles, Tag,
    AlertCircle, ArrowRight, Plus, Eye, EyeOff, ChevronDown, Loader2,
    MessageSquarePlus, FileText, Wrench
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { format, isToday, isYesterday, isThisWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// â”€â”€ AI Badge Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AICategoryBadge({ category }: { category: string | null }) {
    if (!category) return null
    const variants: Record<string, { color: string; icon: React.ReactNode }> = {
        'orcamento': { color: 'bg-blue-100 text-blue-800', icon: <FileText className="w-3 h-3" /> },
        'suporte': { color: 'bg-orange-100 text-orange-800', icon: <Wrench className="w-3 h-3" /> },
        'financeiro': { color: 'bg-green-100 text-green-800', icon: <Tag className="w-3 h-3" /> },
        'reclamacao': { color: 'bg-red-100 text-red-800', icon: <AlertCircle className="w-3 h-3" /> },
        'informacao': { color: 'bg-surface-100 text-surface-800', icon: <Mail className="w-3 h-3" /> },
    }
    const v = variants[category] || variants['informacao']!
    return (
        <Badge variant="outline" className={cn('text-xs gap-1', v.color)}>
            {v.icon} {category}
        </Badge>
    )
}

function AIPriorityBadge({ priority }: { priority: string | null }) {
    if (!priority) return null
    const colors: Record<string, string> = {
        'urgente': 'bg-red-500 text-white',
        'alta': 'bg-orange-500 text-white',
        'media': 'bg-yellow-100 text-yellow-800',
        'baixa': 'bg-surface-100 text-surface-600',
    }
    return <Badge className={cn('text-xs', colors[priority] || 'bg-surface-100')}>{priority}</Badge>
}

function formatEmailDate(dateStr: string): string {
    const date = new Date(dateStr)
    if (isToday(date)) return format(date, 'HH:mm')
    if (isYesterday(date)) return 'Ontem'
    if (isThisWeek(date)) return format(date, 'EEEE', { locale: ptBR })
    return format(date, 'dd/MM/yy')
}

// â”€â”€ Folder Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const FOLDERS = [
    { key: 'inbox', label: 'Entrada', icon: Inbox },
    { key: 'sent', label: 'Enviados', icon: Send },
    { key: 'starred', label: 'Favoritos', icon: Star },
    { key: 'archived', label: 'Arquivo', icon: Archive },
] as const

// â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function EmailInboxPage() {

    const navigate = useNavigate()
    const [filters, setFilters] = useState<EmailFilters>({ folder: 'inbox', per_page: 25 })
    const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [replyOpen, setReplyOpen] = useState(false)
    const [forwardOpen, setForwardOpen] = useState(false)
    const [createTaskOpen, setCreateTaskOpen] = useState(false)
    const [replyBody, setReplyBody] = useState('')
    const [forwardTo, setForwardTo] = useState('')
    const [forwardBody, setForwardBody] = useState('')
    const [taskType, setTaskType] = useState<string>('tarefa')

    const { data: emailsData, isLoading, isError: isErrorEmails, refetch } = useEmails(filters)
    const { data: emailDetail, isLoading: isLoadingDetail } = useEmail(selectedEmailId)
    const { data: statsData, isError: isErrorStats } = useEmailStats()
    const { data: accountsData } = useEmailAccounts()

    useEffect(() => {
        if (isErrorEmails || isErrorStats) {
            toast.error('Erro ao carregar emails. Tente novamente.')
        }
    }, [isErrorEmails, isErrorStats])

    const toggleStar = useToggleEmailStar()
    const markRead = useMarkEmailRead()
    const archiveEmail = useArchiveEmail()
    const batchAction = useEmailBatchAction()
    const replyMutation = useReplyEmail()
    const forwardMutation = useForwardEmail()
    const createTaskMutation = useCreateTaskFromEmail()

    const emails = emailsData?.data || []
    const stats = statsData?.data
    const email = emailDetail?.data
    const accounts = accountsData?.data || []

    const handleSearch = () => {
        setFilters(f => ({ ...f, search: searchTerm || undefined, page: 1 }))
    }

    const handleSelectAll = () => {
        if (selectedIds.length === emails.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(emails.map((e: EmailItem) => e.id))
        }
    }

    const handleBatch = (action: string) => {
        if (selectedIds.length === 0) return
        batchAction.mutate({ ids: selectedIds, action }, {
            onSuccess: () => setSelectedIds([]),
            onError: () => toast.error('Erro na ação em lote')
        })
    }

    const handleReply = () => {
        if (!selectedEmailId || !replyBody.trim()) return
        replyMutation.mutate(
            { emailId: selectedEmailId, data: { body: replyBody } },
            {
                onSuccess: () => { setReplyOpen(false); setReplyBody('') },
                onError: () => toast.error('Erro ao enviar resposta')
            }
        )
    }

    const handleForward = () => {
        if (!selectedEmailId || !forwardTo.trim()) return
        forwardMutation.mutate(
            { emailId: selectedEmailId, data: { to: forwardTo, body: forwardBody } },
            {
                onSuccess: () => { setForwardOpen(false); setForwardTo(''); setForwardBody('') },
                onError: () => toast.error('Erro ao encaminhar email')
            }
        )
    }

    const handleCreateTask = () => {
        if (!selectedEmailId) return
        createTaskMutation.mutate(
            { emailId: selectedEmailId, data: { type: taskType } },
            {
                onSuccess: () => { setCreateTaskOpen(false); toast.success('Item criado com sucesso') },
                onError: () => toast.error('Erro ao criar item')
            }
        )
    }

    return (
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
            {/* â”€â”€â”€ Folder Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <aside className="w-56 shrink-0 border-r bg-muted/30 p-3 flex flex-col gap-1">
                <Button onClick={() => navigate('/emails/compose')} className="w-full mb-3 gap-2">
                    <Plus className="w-4 h-4" /> Novo Email
                </Button>

                {FOLDERS.map(f => (
                    <button
                        key={f.key}
                        onClick={() => { setFilters(prev => ({ ...prev, folder: f.key, page: 1 })); setSelectedEmailId(null) }}
                        className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left w-full',
                            filters.folder === f.key
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'hover:bg-muted text-muted-foreground'
                        )}
                    >
                        <f.icon className="w-4 h-4" />
                        <span className="flex-1">{f.label}</span>
                        {f.key === 'inbox' && stats?.unread ? (
                            <Badge variant="destructive" className="text-xs h-5 min-w-[20px] justify-center">
                                {stats.unread}
                            </Badge>
                        ) : null}
                    </button>
                ))}

                {/* Account filter */}
                {accounts.length > 1 && (
                    <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-2 px-3">Conta</p>
                        <Select
                            value={filters.account_id ? String(filters.account_id) : 'all'}
                            onValueChange={v => setFilters(f => ({ ...f, account_id: v === 'all' ? undefined : Number(v) }))}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Todas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                {accounts.map(a => (
                                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* AI Category filter */}
                <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-2 px-3">Categoria AI</p>
                    <Select
                        value={filters.ai_category || 'all'}
                        onValueChange={v => setFilters(f => ({ ...f, ai_category: v === 'all' ? undefined : v }))}
                    >
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            <SelectItem value="orcamento">Orçamento</SelectItem>
                            <SelectItem value="suporte">Suporte</SelectItem>
                            <SelectItem value="financeiro">Financeiro</SelectItem>
                            <SelectItem value="reclamacao">Reclamação</SelectItem>
                            <SelectItem value="informacao">Informação</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Stats summary */}
                {stats && (
                    <div className="mt-auto pt-4 border-t text-xs text-muted-foreground px-3 space-y-1">
                        <div className="flex justify-between"><span>Total</span><span>{stats.total}</span></div>
                        <div className="flex justify-between"><span>Hoje</span><span>{stats.today}</span></div>
                        <div className="flex justify-between"><span>Não lidos</span>
                            <span className="text-primary font-medium">{stats.unread}</span>
                        </div>
                    </div>
                )}
            </aside>

            {/* â”€â”€â”€ Email List â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Toolbar */}
                <div className="flex items-center gap-2 p-2 border-b bg-background shrink-0">
                    <Checkbox
                        checked={selectedIds.length > 0 && selectedIds.length === emails.length}
                        onCheckedChange={handleSelectAll}
                    />
                    {selectedIds.length > 0 && (
                        <>
                            <Button variant="ghost" size="sm" onClick={() => handleBatch('mark_read')}>
                                <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleBatch('mark_unread')}>
                                <EyeOff className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleBatch('archive')}>
                                <Archive className="w-4 h-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground">{selectedIds.length} selecionados</span>
                        </>
                    )}
                    <div className="flex-1" />
                    <div className="flex items-center gap-1">
                        <Input
                            placeholder="Buscar emails..."
                            className="h-8 w-48"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSearch}>
                            <Search className="w-4 h-4" />
                        </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()}>
                        <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                    </Button>
                </div>

                {/* Email list */}
                <div className="flex-1 overflow-y-auto divide-y">
                    {isLoading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 p-3">
                                <Skeleton className="h-4 w-4 rounded" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-40" />
                                    <Skeleton className="h-3 w-full" />
                                </div>
                                <Skeleton className="h-3 w-12" />
                            </div>
                        ))
                    ) : emails.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                            <Mail className="w-12 h-12 opacity-30" />
                            <p>Nenhum email encontrado</p>
                        </div>
                    ) : (
                        emails.map((e: EmailItem) => (
                            <div
                                key={e.id}
                                onClick={() => { setSelectedEmailId(e.id); if (!e.is_read) markRead.mutate(e.id) }}
                                className={cn(
                                    'flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors group',
                                    selectedEmailId === e.id ? 'bg-primary/5' : 'hover:bg-muted/50',
                                    !e.is_read && 'bg-blue-50/50'
                                )}
                            >
                                <Checkbox
                                    checked={selectedIds.includes(e.id)}
                                    onCheckedChange={checked => {
                                        setSelectedIds(prev =>
                                            checked ? [...prev, e.id] : prev.filter(id => id !== e.id)
                                        )
                                    }}
                                    onClick={ev => ev.stopPropagation()}
                                />

                                <button
                                    onClick={ev => { ev.stopPropagation(); toggleStar.mutate(e.id) }}
                                    className="mt-0.5 shrink-0"
                                    title={e.is_starred ? 'Remover estrela' : 'Favoritar'}
                                >
                                    <Star className={cn('w-4 h-4', e.is_starred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30')} />
                                </button>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={cn('text-sm truncate', !e.is_read && 'font-semibold')}>
                                            {e.direction === 'outbound' ? `â†’ ${e.to_email}` : (e.from_name || e.from_email)}
                                        </span>
                                        {e.has_attachments && <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />}
                                        <AICategoryBadge category={e.ai_category} />
                                    </div>
                                    <p className={cn('text-sm truncate', !e.is_read ? 'text-foreground' : 'text-muted-foreground')}>
                                        {e.subject}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">{e.snippet}</p>
                                </div>

                                <div className="text-right shrink-0 space-y-1">
                                    <p className="text-xs text-muted-foreground">{formatEmailDate(e.received_at)}</p>
                                    <AIPriorityBadge priority={e.ai_priority} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* â”€â”€â”€ Detail Pane â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="w-[480px] shrink-0 border-l flex flex-col bg-background overflow-hidden">
                {!selectedEmailId ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <div className="text-center space-y-2">
                            <Mail className="w-16 h-16 mx-auto opacity-20" />
                            <p>Selecione um email para visualizar</p>
                        </div>
                    </div>
                ) : isLoadingDetail ? (
                    <div className="p-4 space-y-4">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                ) : email ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b space-y-3 shrink-0">
                            <div className="flex items-start justify-between gap-2">
                                <h2 className="text-lg font-semibold leading-tight">{email.subject}</h2>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => archiveEmail.mutate(email.id)}>
                                            <Archive className="w-4 h-4 mr-2" /> Arquivar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toggleStar.mutate(email.id)}>
                                            <Star className="w-4 h-4 mr-2" /> {email.is_starred ? 'Remover estrela' : 'Favoritar'}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setCreateTaskOpen(true)}>
                                            <MessageSquarePlus className="w-4 h-4 mr-2" /> Criar Tarefa/Chamado
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">{email.from_name || email.from_email}</span>
                                <span>&lt;{email.from_email}&gt;</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {format(new Date(email.received_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                {email.account && (
                                    <>
                                        <span>Â·</span>
                                        <span>{email.account.name}</span>
                                    </>
                                )}
                            </div>

                            {/* AI Analysis */}
                            {email.ai_category && (
                                <Card className="bg-gradient-to-r from-violet-50 to-indigo-50 border-violet-200/50">
                                    <CardContent className="p-3 space-y-2">
                                        <div className="flex items-center gap-2 text-xs">
                                            <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                                            <span className="font-medium text-violet-700">Análise AI</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            <AICategoryBadge category={email.ai_category} />
                                            <AIPriorityBadge priority={email.ai_priority} />
                                            {email.ai_sentiment && (
                                                <Badge variant="outline" className="text-xs">
                                                    {email.ai_sentiment}
                                                </Badge>
                                            )}
                                        </div>
                                        {email.ai_summary && (
                                            <p className="text-xs text-muted-foreground">{email.ai_summary}</p>
                                        )}
                                        {email.ai_suggested_action && (
                                            <div className="flex items-center gap-1 text-xs text-violet-600">
                                                <ArrowRight className="w-3 h-3" />
                                                <span>{email.ai_suggested_action}</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-2">
                                <TooltipProvider>
                                    <Tooltip><TooltipTrigger asChild>
                                        <Button variant="outline" size="sm" onClick={() => setReplyOpen(true)}>
                                            <Reply className="w-4 h-4 mr-1" /> Responder
                                        </Button>
                                    </TooltipTrigger><TooltipContent>Responder email</TooltipContent></Tooltip>
                                    <Tooltip><TooltipTrigger asChild>
                                        <Button variant="outline" size="sm" onClick={() => setForwardOpen(true)}>
                                            <Forward className="w-4 h-4 mr-1" /> Encaminhar
                                        </Button>
                                    </TooltipTrigger><TooltipContent>Encaminhar email</TooltipContent></Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {email.body_html ? (
                                <div
                                    className="prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(email.body_html) }}
                                />
                            ) : (
                                <pre className="whitespace-pre-wrap text-sm text-foreground font-sans">
                                    {email.body_text || '(sem conteúdo)'}
                                </pre>
                            )}

                            {/* Attachments */}
                            {email.attachments && email.attachments.length > 0 && (
                                <div className="mt-6 pt-4 border-t space-y-2">
                                    <p className="text-sm font-medium flex items-center gap-2">
                                        <Paperclip className="w-4 h-4" /> Anexos ({email.attachments.length})
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {email.attachments.map(att => (
                                            <div key={att.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                                                <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                                                <span className="truncate">{att.filename}</span>
                                                <span className="text-xs text-muted-foreground shrink-0">
                                                    {(att.size_bytes / 1024).toFixed(0)}KB
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : null}
            </div>

            {/* â”€â”€â”€ Reply Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Responder: {email?.subject}</DialogTitle>
                    </DialogHeader>
                    <div className="text-sm text-muted-foreground mb-2">
                        Para: {email?.from_email}
                    </div>
                    <Textarea
                        placeholder="Escreva sua resposta..."
                        value={replyBody}
                        onChange={e => setReplyBody(e.target.value)}
                        rows={6}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReplyOpen(false)}>Cancelar</Button>
                        <Button onClick={handleReply} disabled={replyMutation.isPending || !replyBody.trim()}>
                            {replyMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Enviar resposta
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* â”€â”€â”€ Forward Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <Dialog open={forwardOpen} onOpenChange={setForwardOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Encaminhar: {email?.subject}</DialogTitle>
                    </DialogHeader>
                    <Input
                        placeholder="Para: email@exemplo.com"
                        value={forwardTo}
                        onChange={e => setForwardTo(e.target.value)}
                    />
                    <Textarea
                        placeholder="Mensagem adicional (opcional)..."
                        value={forwardBody}
                        onChange={e => setForwardBody(e.target.value)}
                        rows={4}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setForwardOpen(false)}>Cancelar</Button>
                        <Button onClick={handleForward} disabled={forwardMutation.isPending || !forwardTo.trim()}>
                            {forwardMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Encaminhar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* â”€â”€â”€ Create Task Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Criar item a partir do email</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">{email?.subject}</p>
                        <Select value={taskType} onValueChange={setTaskType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="tarefa">Tarefa</SelectItem>
                                <SelectItem value="chamado">Chamado</SelectItem>
                                <SelectItem value="os">Ordem de Serviço</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateTaskOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateTask} disabled={createTaskMutation.isPending}>
                            {createTaskMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Criar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}