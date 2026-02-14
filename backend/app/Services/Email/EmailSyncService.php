<?php

namespace App\Services\Email;

use App\Models\Customer;
use App\Models\Email;
use App\Models\EmailAccount;
use App\Models\EmailAttachment;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Webklex\IMAP\Facades\Client as ImapClient;

class EmailSyncService
{
    public function syncAccount(EmailAccount $account): int
    {
        $account->markSyncing();
        $synced = 0;

        try {
            $client = ImapClient::make([
                'host' => $account->imap_host,
                'port' => $account->imap_port,
                'encryption' => $account->imap_encryption,
                'validate_cert' => true,
                'username' => $account->imap_username,
                'password' => $account->imap_password,
                'protocol' => 'imap',
            ]);

            $client->connect();
            $folder = $client->getFolder('INBOX');

            if (!$folder) {
                throw new \RuntimeException('INBOX folder not found');
            }

            $query = $folder->messages();

            if ($account->last_sync_uid) {
                $query = $query->setFetchBody(true)->where('UID', '>', $account->last_sync_uid);
            } else {
                // First sync: get last 50 emails
                $query = $query->setFetchBody(true)->limit(50);
            }

            $messages = $query->get();
            $lastUid = $account->last_sync_uid ?? 0;

            foreach ($messages as $message) {
                try {
                    $email = $this->processMessage($account, $message);
                    if ($email) {
                        $synced++;
                        $msgUid = (int) $message->getUid();
                        if ($msgUid > $lastUid) {
                            $lastUid = $msgUid;
                        }
                    }
                } catch (\Exception $e) {
                    Log::warning('Email sync: failed to process message', [
                        'account' => $account->id,
                        'uid' => $message->getUid(),
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            $client->disconnect();
            $account->markSynced($lastUid);

            Log::info('Email sync completed', [
                'account' => $account->id,
                'name' => $account->name,
                'synced' => $synced,
            ]);
        } catch (\Exception $e) {
            $account->markSyncError($e->getMessage());
            Log::error('Email sync failed', [
                'account' => $account->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }

        return $synced;
    }

    private function processMessage(EmailAccount $account, $message): ?Email
    {
        $messageId = $message->getMessageId()?->toString() ?? '';
        if (!$messageId) {
            $messageId = md5($message->getSubject() . $message->getDate()->toDateTimeString() . $message->getFrom()[0]->mail);
        }

        // Skip duplicates
        if (Email::where('message_id', $messageId)->exists()) {
            return null;
        }

        $from = $message->getFrom()[0] ?? null;
        $fromAddress = $from ? $from->mail : 'unknown@unknown.com';
        $fromName = $from ? ($from->personal ?? null) : null;

        $toAddresses = collect($message->getTo() ?? [])
            ->map(fn($addr) => ['email' => $addr->mail, 'name' => $addr->personal ?? null])
            ->toArray();

        $ccAddresses = collect($message->getCc() ?? [])
            ->map(fn($addr) => ['email' => $addr->mail, 'name' => $addr->personal ?? null])
            ->toArray();

        $subject = $message->getSubject()?->toString() ?? '(sem assunto)';
        $bodyText = $message->getTextBody();
        $bodyHtml = $message->getHTMLBody();
        $snippet = Str::limit(strip_tags($bodyText ?: $bodyHtml ?: ''), 300);
        $date = $message->getDate()?->toDate() ?? now();

        $inReplyTo = $message->getInReplyTo()?->toString();
        $references = $message->getReferences()?->toString();
        $threadId = Email::resolveThreadId($messageId, $inReplyTo, $references);

        $hasAttachments = $message->getAttachments()->count() > 0;

        // Auto-link to customer by from_address
        $customerId = Customer::where('email', $fromAddress)->value('id');

        $email = Email::create([
            'tenant_id' => $account->tenant_id,
            'email_account_id' => $account->id,
            'message_id' => $messageId,
            'in_reply_to' => $inReplyTo,
            'thread_id' => $threadId,
            'folder' => 'INBOX',
            'uid' => (int) $message->getUid(),
            'from_email' => $fromAddress,
            'from_name' => $fromName,
            'to_email' => data_get($toAddresses, '0.email', ''),
            'subject' => Str::limit($subject, 500, ''),
            'body_text' => $bodyText,
            'body_html' => $bodyHtml,
            'snippet' => $snippet,
            'received_at' => $date,
            'has_attachments' => $hasAttachments,
            'customer_id' => $customerId,
            'direction' => 'inbound',
            'status' => 'new',
        ]);

        // Process attachments
        if ($hasAttachments) {
            foreach ($message->getAttachments() as $attachment) {
                $this->saveAttachment($email, $attachment);
            }
        }

        return $email;
    }

    private function saveAttachment(Email $email, $attachment): void
    {
        try {
            $filename = $attachment->getName() ?? 'attachment';
            $path = "email-attachments/{$email->tenant_id}/{$email->id}/" . Str::random(8) . '_' . $filename;

            Storage::put($path, $attachment->getContent());

            EmailAttachment::create([
                'email_id' => $email->id,
                'filename' => $filename,
                'mime_type' => $attachment->getMimeType() ?? 'application/octet-stream',
                'size_bytes' => $attachment->getSize() ?? strlen($attachment->getContent()),
                'storage_path' => $path,
            ]);
        } catch (\Exception $e) {
            Log::warning('Failed to save email attachment', [
                'email_id' => $email->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
