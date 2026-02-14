<?php

namespace App\Services\Email;

use App\Models\Email;
use App\Models\EmailAccount;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class EmailSendService
{
    public function send(
        EmailAccount $account,
        string $to,
        string $subject,
        string $body,
        array $cc = [],
        array $bcc = [],
        ?int $replyToEmailId = null,
        ?string $scheduledAt = null
    ): Email {
        $messageId = '<' . Str::uuid() . '@' . Str::after($account->email, '@') . '>';
        
        $inReplyTo = null;
        $threadId = null;

        if ($replyToEmailId) {
            $originalEmail = Email::find($replyToEmailId);
            if ($originalEmail) {
                $inReplyTo = $originalEmail->message_id;
                $threadId = $originalEmail->thread_id;
            }
        }

        // Create email record first
        $email = Email::create([
            'tenant_id' => $account->tenant_id,
            'email_account_id' => $account->id,
            'message_id' => $messageId,
            'in_reply_to' => $inReplyTo,
            'thread_id' => $threadId ?? md5($messageId),
            'folder' => 'Sent',
            'from_email' => $account->email,
            'from_name' => $account->name,
            'to_email' => $to,
            'subject' => $subject,
            'body_html' => $body,
            'body_text' => strip_tags($body),
            'snippet' => Str::limit(strip_tags($body), 300),
            'received_at' => now(), // Creation time
            'is_read' => true,
            'direction' => 'outbound',
            'status' => $scheduledAt ? 'scheduled' : 'sent',
            'scheduled_at' => $scheduledAt,
        ]);

        // If scheduled, stop here
        if ($scheduledAt) {
            Log::info('Email scheduled', ['email_id' => $email->id, 'scheduled_at' => $scheduledAt]);
            return $email;
        }

        // Validate before sending?
        
        return $this->deliver($email, $cc, $bcc);
    }

    /**
     * Actually deliver the email via SMTP/IMAP
     */
    public function deliver(Email $email, array $cc = [], array $bcc = []): Email
    {
        if ($email->status === 'sent' && $email->sent_at) {
             // Already sent?
             return $email;
        }

        $account = $email->account;
        
        $smtpHost = $account->smtp_host ?? str_replace('imap', 'smtp', $account->imap_host);
        $smtpPort = $account->smtp_port ?? 465;
        $smtpEncryption = $account->smtp_encryption ?? $account->imap_encryption ?? 'ssl';

        // Configure dynamic SMTP transport
        config([
            'mail.mailers.email_account' => [
                'transport' => 'smtp',
                'host' => $smtpHost,
                'port' => $smtpPort,
                'encryption' => $smtpEncryption,
                'username' => $account->imap_username,
                'password' => $account->imap_password,
            ],
        ]);

        try {
            Mail::mailer('email_account')->html($email->body_html, function ($message) use ($email, $cc, $bcc) {
                $message->from($email->from_email, $email->from_name)
                    ->to($email->to_email)
                    ->subject($email->subject);

                if (!empty($cc)) {
                    $message->cc($cc);
                }
                if (!empty($bcc)) {
                    $message->bcc($bcc);
                }

                if ($email->in_reply_to) {
                    $message->getHeaders()->addTextHeader('In-Reply-To', $email->in_reply_to);
                    $message->getHeaders()->addTextHeader('References', $email->in_reply_to);
                }
            });

            $email->update([
                'status' => 'sent',
                'sent_at' => now(),
            ]);

            Log::info('Email delivered', [
                'email_id' => $email->id,
                'account' => $account->id
            ]);

            return $email;
        } catch (\Exception $e) {
            $email->update(['status' => 'failed']);
            Log::error('Email delivery failed', [
                'email_id' => $email->id,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    public function compose(int $accountId, int $tenantId, array $data): Email
    {
        $account = EmailAccount::where('id', $accountId)
            ->where('tenant_id', $tenantId)
            ->firstOrFail();

        $cc = !empty($data['cc']) ? array_map('trim', explode(',', $data['cc'])) : [];
        $bcc = !empty($data['bcc']) ? array_map('trim', explode(',', $data['bcc'])) : [];

        return $this->send(
            account: $account,
            to: $data['to'],
            subject: $data['subject'],
            body: $data['body'],
            cc: $cc,
            bcc: $bcc,
            scheduledAt: $data['scheduled_at'] ?? null
        );
    }

    public function reply(Email $originalEmail, array $data): Email
    {
        $account = $originalEmail->account;
        $to = $originalEmail->from_email;
        $subject = str_starts_with(strtolower($originalEmail->subject), 're:')
            ? $originalEmail->subject
            : "Re: {$originalEmail->subject}";

        $cc = !empty($data['cc']) ? array_map('trim', explode(',', $data['cc'])) : [];
        $bcc = !empty($data['bcc']) ? array_map('trim', explode(',', $data['bcc'])) : [];

        $email = $this->send(
            account: $account,
            to: $to,
            subject: $subject,
            body: $data['body'],
            cc: $cc,
            bcc: $bcc,
            replyToEmailId: $originalEmail->id,
            scheduledAt: $data['scheduled_at'] ?? null
        );

        // Update original only if sent immediately? or valid regardless?
        // Let's say we mark as replied immediately for UX
        $originalEmail->update(['status' => 'replied']);

        return $email;
    }

    public function forward(Email $originalEmail, array $data): Email
    {
        $account = $originalEmail->account;
        $subject = str_starts_with(strtolower($originalEmail->subject), 'fwd:')
            ? $originalEmail->subject
            : "Fwd: {$originalEmail->subject}";

        $forwardBody = (!empty($data['body']) ? "<p>{$data['body']}</p><hr>" : '')
            . '<p>---------- Forwarded message ----------</p>'
            . "<p><strong>De:</strong> {$originalEmail->from_name} &lt;{$originalEmail->from_email}&gt;</p>"
            . "<p><strong>Data:</strong> {$originalEmail->received_at->format('d/m/Y H:i')}</p>"
            . "<p><strong>Assunto:</strong> {$originalEmail->subject}</p>"
            . '<hr>'
            . ($originalEmail->body_html ?? nl2br($originalEmail->body_text ?? ''));

        return $this->send(
            account: $account,
            to: $data['to'],
            subject: $subject,
            body: $forwardBody,
            scheduledAt: $data['scheduled_at'] ?? null
        );
    }
}
