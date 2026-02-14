import { useState } from 'react'
import { toast } from 'sonner'
import { useComposeEmail } from '@/hooks/useEmails'
import { useEmailAccounts } from '@/hooks/useEmailAccounts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Send, ArrowLeft, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'

export default function EmailComposePage() {
  const { hasPermission } = useAuthStore()

    const navigate = useNavigate()
    const { data: accountsData } = useEmailAccounts()
    const composeMutation = useComposeEmail()
    const accounts = accountsData?.data || []

    const [form, setForm] = useState({
        account_id: '',
        to: '',
        subject: '',
        body: '',
        cc: '',
        bcc: '',
    })
    const [showCcBcc, setShowCcBcc] = useState(false)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.account_id || !form.to || !form.subject || !form.body) return

        composeMutation.mutate(
            {
                account_id: Number(form.account_id),
                to: form.to,
                subject: form.subject,
                body: form.body,
                cc: form.cc || undefined,
                bcc: form.bcc || undefined,
            },
            { onSuccess: () => navigate('/emails') }
        )
    }

    return (
        <div className="max-w-3xl mx-auto p-6">
            <div className="flex items-center gap-3 mb-6">
                <Button variant="ghost" size="icon" onClick={() => navigate('/emails')}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-2xl font-bold">Novo Email</h1>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Conta de envio</Label>
                            <Select
                                value={form.account_id}
                                onValueChange={v => setForm(f => ({ ...f, account_id: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione uma conta" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map(a => (
                                        <SelectItem key={a.id} value={String(a.id)}>
                                            {a.name} ({a.email})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Para</Label>
                                <button
                                    type="button"
                                    onClick={() => setShowCcBcc(!showCcBcc)}
                                    className="text-xs text-primary hover:underline"
                                >
                                    {showCcBcc ? 'Ocultar CC/BCC' : 'Mostrar CC/BCC'}
                                </button>
                            </div>
                            <Input
                                placeholder="destinatario@exemplo.com"
                                value={form.to}
                                onChange={e => setForm(f => ({ ...f, to: e.target.value }))}
                                required
                            />
                        </div>

                        {showCcBcc && (
                            <>
                                <div className="space-y-2">
                                    <Label>CC</Label>
                                    <Input
                                        placeholder="cc@exemplo.com"
                                        value={form.cc}
                                        onChange={e => setForm(f => ({ ...f, cc: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>BCC</Label>
                                    <Input
                                        placeholder="bcc@exemplo.com"
                                        value={form.bcc}
                                        onChange={e => setForm(f => ({ ...f, bcc: e.target.value }))}
                                    />
                                </div>
                            </>
                        )}

                        <div className="space-y-2">
                            <Label>Assunto</Label>
                            <Input
                                placeholder="Assunto do email"
                                value={form.subject}
                                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Mensagem</Label>
                            <Textarea
                                placeholder="Escreva sua mensagem..."
                                value={form.body}
                                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                                rows={12}
                                required
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => navigate('/emails')}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={composeMutation.isPending}>
                                {composeMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4 mr-2" />
                                )}
                                Enviar
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}