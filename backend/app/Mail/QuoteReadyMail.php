<?php

namespace App\Mail;

use App\Models\Quote;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class QuoteReadyMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Quote $quote,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Orcamento #{$this->quote->quote_number} - Pronto para Aprovacao",
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.quote-ready',
            with: [
                'quote' => $this->quote,
                'customerName' => $this->quote->customer?->name ?? 'Cliente',
                'total' => number_format((float) $this->quote->total, 2, ',', '.'),
                'approvalUrl' => $this->quote->publicApprovalUrl(),
            ],
        );
    }
}
