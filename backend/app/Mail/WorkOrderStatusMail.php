<?php

namespace App\Mail;

use App\Models\WorkOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WorkOrderStatusMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly WorkOrder $workOrder,
        public readonly string $statusType,
    ) {}

    public function envelope(): Envelope
    {
        $subjects = [
            'created' => "OS {$this->workOrder->business_number} - Ordem de Serviço Criada",
            'completed' => "OS {$this->workOrder->business_number} - Serviço Concluído",
            'awaiting_approval' => "OS {$this->workOrder->business_number} - Aguardando Aprovação",
        ];

        return new Envelope(
            subject: $subjects[$this->statusType] ?? "OS {$this->workOrder->business_number} - Atualização",
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.work-order-status',
            with: [
                'wo' => $this->workOrder,
                'statusType' => $this->statusType,
                'customerName' => $this->workOrder->customer?->name ?? 'Cliente',
            ],
        );
    }
}

