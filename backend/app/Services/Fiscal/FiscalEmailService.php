<?php

namespace App\Services\Fiscal;

use App\Models\FiscalNote;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

/**
 * Sends fiscal documents (PDF + XML) via email.
 * Supports sending to customer, to a custom address, or both.
 */
class FiscalEmailService
{
    /**
     * Send fiscal note documents via email.
     *
     * @param FiscalNote $note The fiscal note to send
     * @param string|null $recipientEmail Override recipient email (null = use customer email)
     * @param string|null $customMessage Optional custom message body
     */
    public function send(FiscalNote $note, ?string $recipientEmail = null, ?string $customMessage = null): array
    {
        $customer = $note->customer;
        $email = $recipientEmail ?? $customer?->email;

        if (!$email) {
            return ['success' => false, 'message' => 'Nenhum e-mail de destinatário disponível'];
        }

        $attachments = $this->prepareAttachments($note);

        if (empty($attachments)) {
            return ['success' => false, 'message' => 'Nenhum arquivo (PDF/XML) disponível para envio'];
        }

        try {
            $tenant = $note->tenant;
            $noteType = $note->isNFe() ? 'NF-e' : 'NFS-e';
            $noteNumber = $note->number ?? $note->reference;

            $subject = "{$noteType} #{$noteNumber} - {$tenant->name}";
            $body = $customMessage ?? $this->buildDefaultBody($note, $noteType, $noteNumber, $tenant);

            Mail::raw($body, function ($message) use ($email, $subject, $attachments, $tenant) {
                $message->to($email)
                    ->subject($subject);

                if ($tenant->email) {
                    $message->replyTo($tenant->email, $tenant->name);
                }

                foreach ($attachments as $attachment) {
                    $message->attach($attachment['path'], [
                        'as' => $attachment['name'],
                        'mime' => $attachment['mime'],
                    ]);
                }
            });

            Log::info('FiscalEmailService: Email sent', [
                'note_id' => $note->id,
                'recipient' => $email,
                'attachments' => count($attachments),
            ]);

            return [
                'success' => true,
                'message' => "Documentos enviados para {$email}",
                'recipient' => $email,
            ];
        } catch (\Exception $e) {
            Log::error('FiscalEmailService: Send failed', [
                'note_id' => $note->id,
                'recipient' => $email,
                'error' => $e->getMessage(),
            ]);

            return ['success' => false, 'message' => 'Erro ao enviar e-mail: ' . $e->getMessage()];
        }
    }

    /**
     * Prepare file attachments (PDF and XML).
     */
    private function prepareAttachments(FiscalNote $note): array
    {
        $attachments = [];
        $noteType = $note->isNFe() ? 'NFe' : 'NFSe';
        $reference = $note->number ?? $note->reference;

        // PDF
        if ($note->pdf_path && Storage::exists($note->pdf_path)) {
            $attachments[] = [
                'path' => Storage::path($note->pdf_path),
                'name' => "{$noteType}_{$reference}.pdf",
                'mime' => 'application/pdf',
            ];
        }

        // XML
        if ($note->xml_path && Storage::exists($note->xml_path)) {
            $attachments[] = [
                'path' => Storage::path($note->xml_path),
                'name' => "{$noteType}_{$reference}.xml",
                'mime' => 'application/xml',
            ];
        }

        return $attachments;
    }

    /**
     * Build the default email body text.
     */
    private function buildDefaultBody(FiscalNote $note, string $noteType, $noteNumber, $tenant): string
    {
        $customerName = $note->customer?->company_name ?? $note->customer?->name ?? 'Cliente';
        $totalFormatted = 'R$ ' . number_format((float) $note->total_amount, 2, ',', '.');
        $issuedDate = $note->issued_at?->format('d/m/Y H:i') ?? now()->format('d/m/Y H:i');

        $lines = [
            "Prezado(a) {$customerName},",
            "",
            "Segue em anexo a {$noteType} nº {$noteNumber} emitida em {$issuedDate}.",
            "",
            "Valor total: {$totalFormatted}",
        ];

        if ($note->isNFe() && $note->access_key) {
            $lines[] = "Chave de acesso: {$note->access_key}";
        }

        if ($note->isNFSe() && $note->verification_code) {
            $lines[] = "Código de verificação: {$note->verification_code}";
        }

        $lines[] = "";
        $lines[] = "Este é um e-mail automático. Caso tenha dúvidas, entre em contato conosco.";
        $lines[] = "";
        $lines[] = "Atenciosamente,";
        $lines[] = $tenant->name;

        if ($tenant->phone) {
            $lines[] = "Tel: {$tenant->phone}";
        }

        if ($tenant->email) {
            $lines[] = $tenant->email;
        }

        return implode("\n", $lines);
    }
}
