import { useState , useMemo } from 'react'
import { useEmailAccounts, useCreateEmailAccount, useUpdateEmailAccount, useDeleteEmailAccount, useSyncEmailAccount, useTestEmailConnection, type EmailAccount, type EmailAccountFormData } from '@/hooks/useEmailAccounts'
import { useEmailRules, useCreateEmailRule, useUpdateEmailRule, useDeleteEmailRule, useToggleEmailRuleActive, type EmailRule, type EmailRuleFormData, type RuleCondition, type RuleAction } from '@/hooks/useEmailRules'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import {
    Mail, Plus, Settings, Trash2, Edit, RefreshCw, Check, X,
    Loader2, Wifi, WifiOff, Zap, ArrowLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// ── Account Form ─────────────────────────────
function AccountFormDialog({
    open,
    onOpenChange,
    account,
}: {
    open: boolean
    onOpenChange: (o: boolean) => void
    account?: EmailAccount
}) {
    const createMut = useCreateEmailAccount()
    const updateMut = useUpdateEmailAccount()
    const isEdit = !!account

    const [form, setForm] = useState<EmailAccountFormData>({
        name: account?.name || '',
        email: account?.email || '',
        imap_host: account?.imap_host || 'imap.titan.email',
        imap_port: account?.imap_port || 993,
        imap_encryption: account?.imap_encryption || 'ssl',
        imap_username: account?.imap_username || '',
        imap_password: '',
        smtp_host: account?.smtp_host || 'smtp.titan.email',
        smtp_port: account?.smtp_port || 465,
        smtp_encryption: account?.smtp_encryption || 'ssl',
        is_active: account?.is_active ?? true,
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (isEdit) {
            const data = { ...form }
            if (!data.imap_password) delete (data as Partial<EmailAccountFormData>).imap_password
            updateMut.mutate({ id: account.id, data }, { onSuccess: () => onOpenChange(false) })
        } else {
            createMut.mutate(form, { onSuccess: () => onOpenChange(false) })
        }
    }

    const isPending = createMut.isPending || updateMut.isPending

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Editar Conta' : 'Nova Conta de Email'}</DialogTitle>
                    <DialogDescription>Configure as credenciais IMAP e SMTP para sincronização.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>Nome *</Label>
                            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                        </div>
                        <div className="space-y-1">
                            <Label>Email *</Label>
                            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                        </div>
                    </div>

                    <p className="text-xs font-medium text-muted-foreground pt-2">IMAP (recebimento)</p>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1 space-y-1">
                            <Label>Host *</Label>
                            <Input value={form.imap_host} onChange={e => setForm(f => ({ ...f, imap_host: e.target.value }))} required />
                        </div>
                        <div className="space-y-1">
                            <Label>Porta *</Label>
                            <Input type="number" value={form.imap_port} onChange={e => setForm(f => ({ ...f, imap_port: Number(e.target.value) }))} required />
                        </div>
                        <div className="space-y-1">
                            <Label>Criptografia</Label>
                            <Select value={form.imap_encryption} onValueChange={v => setForm(f => ({ ...f, imap_encryption: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ssl">SSL</SelectItem>
                                    <SelectItem value="tls">TLS</SelectItem>
                                    <SelectItem value="none">Nenhuma</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>Usuário *</Label>
                            <Input value={form.imap_username} onChange={e => setForm(f => ({ ...f, imap_username: e.target.value }))} required />
                        </div>
                        <div className="space-y-1">
                            <Label>Senha {isEdit && '(deixe vazio para manter)'}</Label>
                            <Input type="password" value={form.imap_password} onChange={e => setForm(f => ({ ...f, imap_password: e.target.value }))} required={!isEdit} />
                        </div>
                    </div>

                    <p className="text-xs font-medium text-muted-foreground pt-2">SMTP (envio)</p>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1 space-y-1">
                            <Label>Host SMTP</Label>
                            <Input value={form.smtp_host || ''} onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <Label>Porta</Label>
                            <Input type="number" value={form.smtp_port || ''} onChange={e => setForm(f => ({ ...f, smtp_port: Number(e.target.value) }))} />
                        </div>
                        <div className="space-y-1">
                            <Label>Criptografia</Label>
                            <Select value={form.smtp_encryption || 'ssl'} onValueChange={v => setForm(f => ({ ...f, smtp_encryption: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ssl">SSL</SelectItem>
                                    <SelectItem value="tls">TLS</SelectItem>
                                    <SelectItem value="none">Nenhuma</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {isEdit ? 'Salvar' : 'Criar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

// ── Main Settings Page ──────────────────────────
export default function EmailSettingsPage() {

  // MVP: Data fetching
  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: ['email-settings'],
    queryFn: () => api.get('/email-settings').then(r => r.data?.data ?? r.data ?? []),
  })

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/email-settings/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['email-settings'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }
  const { hasPermission } = useAuthStore()

    const navigate = useNavigate()
    const { data: accountsData, isLoading: loadingAccounts } = useEmailAccounts()
    const { data: rulesData, isLoading: loadingRules } = useEmailRules()
    const deleteMut = useDeleteEmailAccount()
    const syncMut = useSyncEmailAccount()
    const testMut = useTestEmailConnection()
    const deleteRuleMut = useDeleteEmailRule()
    const toggleRuleMut = useToggleEmailRuleActive()

    const accounts = accountsData?.data || []
    const rules = rulesData?.data || []

    const [accountFormOpen, setAccountFormOpen] = useState(false)
    const [editingAccount, setEditingAccount] = useState<EmailAccount | undefined>()

    const openCreate = () => { setEditingAccount(undefined); setAccountFormOpen(true) }
    const openEdit = (a: EmailAccount) => { setEditingAccount(a); setAccountFormOpen(true) }

  const [searchTerm, setSearchTerm] = useState('')
    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate('/emails')}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Configurações de Email</h1>
                    <p className="text-muted-foreground text-sm">Gerencie contas de email e regras de automação</p>
                </div>
            </div>

            <Tabs defaultValue="accounts" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="accounts"><Mail className="w-4 h-4 mr-2" /> Contas</TabsTrigger>
                    <TabsTrigger value="rules"><Zap className="w-4 h-4 mr-2" /> Regras de Automação</TabsTrigger>
                </TabsList>

                {/* ─── Accounts Tab ─────────────────── */}
                <TabsContent value="accounts" className="space-y-4">
                    <div className="flex justify-end">
                        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Nova Conta</Button>
                    </div>

                    {loadingAccounts ? (
                        <div className="space-y-3">
                            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                        </div>
                    ) : accounts.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
                                <Mail className="w-12 h-12 opacity-30" />
                                <p>Nenhuma conta de email configurada</p>
                                <Button variant="outline" onClick={openCreate}>Adicionar conta</Button>
                            </CardContent>
                        </Card>
                    ) : (
                        accounts.map(account => (
                            <Card key={account.id}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                'w-2 h-2 rounded-full',
                                                account.is_active ? 'bg-green-500' : 'bg-gray-400'
                                            )} />
                                            <div>
                                                <CardTitle className="text-base">{account.name}</CardTitle>
                                                <CardDescription>{account.email}</CardDescription>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={account.sync_status === 'error' ? 'destructive' : 'outline'} className="text-xs">
                                                {account.sync_status === 'syncing' && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
                                                {account.sync_status}
                                            </Badge>
                                            <Button variant="outline" size="sm" onClick={() => testMut.mutate(account.id)} disabled={testMut.isPending}>
                                                {testMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => syncMut.mutate(account.id)} disabled={syncMut.isPending || !account.is_active}>
                                                <RefreshCw className={cn('w-4 h-4', syncMut.isPending && 'animate-spin')} />
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => openEdit(account)}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Remover conta?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esta ação não pode ser desfeita. Emails sincronizados permanecerão no sistema.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => deleteMut.mutate(account.id)}
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        >
                                                            Remover
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-xs text-muted-foreground flex items-center gap-4">
                                    <span>IMAP: {account.imap_host}:{account.imap_port}</span>
                                    {account.smtp_host && <span>SMTP: {account.smtp_host}:{account.smtp_port}</span>}
                                    {account.last_synced_at && <span>Última sync: {new Date(account.last_synced_at).toLocaleString('pt-BR')}</span>}
                                    {account.sync_error && <span className="text-destructive">{account.sync_error}</span>}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>

                {/* ─── Rules Tab ──────────────────────── */}
                <TabsContent value="rules" className="space-y-4">
                    <div className="flex justify-end">
                        <Button onClick={() => toast.info('Editor de regras em desenvolvimento')}>
                            <Plus className="w-4 h-4 mr-2" /> Nova Regra
                        </Button>
                    </div>

                    {loadingRules ? (
                        <div className="space-y-3">
                            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                        </div>
                    ) : rules.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
                                <Zap className="w-12 h-12 opacity-30" />
                                <p>Nenhuma regra de automação configurada</p>
                            </CardContent>
                        </Card>
                    ) : (
                        rules.map(rule => (
                            <Card key={rule.id}>
                                <CardContent className="py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Switch
                                                checked={rule.is_active}
                                                onCheckedChange={() => toggleRuleMut.mutate(rule.id)}
                                            />
                                            <div>
                                                <p className="font-medium text-sm">{rule.name}</p>
                                                {rule.description && (
                                                    <p className="text-xs text-muted-foreground">{rule.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                {rule.conditions.length} condição(ões)
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                {rule.actions.length} ação(ões)
                                            </Badge>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Remover regra?</AlertDialogTitle>
                                                        <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => deleteRuleMut.mutate(rule.id)}
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        >
                                                            Remover
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {rule.conditions.map((c, i) => (
                                            <Badge key={i} variant="secondary" className="text-xs">
                                                {c.field} {c.operator} "{c.value}"
                                            </Badge>
                                        ))}
                                        <span className="text-xs text-muted-foreground mx-1">→</span>
                                        {rule.actions.map((a, i) => (
                                            <Badge key={i} variant="outline" className="text-xs bg-violet-50 dark:bg-violet-950/20">
                                                {a.type}
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>
            </Tabs>

            <AccountFormDialog
                open={accountFormOpen}
                onOpenChange={setAccountFormOpen}
                account={editingAccount}
            />
        </div>
    )
}
