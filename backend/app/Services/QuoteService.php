<?php

namespace App\Services;

use App\Enums\PaymentTerms;
use App\Enums\QuoteStatus;
use App\Events\QuoteApproved;
use App\Mail\QuoteReadyMail;
use App\Models\AuditLog;
use App\Models\Quote;
use App\Models\QuoteEmail;
use App\Models\QuoteEquipment;
use App\Models\QuoteItem;
use App\Models\QuoteTemplate;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderItem;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class QuoteService
{
    public function createQuote(array $data, int $tenantId, int $userId): Quote
    {
        return DB::transaction(function () use ($data, $tenantId, $userId) {
            $quote = Quote::create([
                'tenant_id' => $tenantId,
                'quote_number' => Quote::nextNumber($tenantId),
                'customer_id' => $data['customer_id'],
                'seller_id' => $data['seller_id'] ?? $userId,
                'status' => Quote::STATUS_DRAFT,
                'source' => $data['source'] ?? null,
                'valid_until' => $data['valid_until'] ?? null,
                'discount_percentage' => $data['discount_percentage'] ?? 0,
                'discount_amount' => $data['discount_amount'] ?? 0,
                'displacement_value' => $data['displacement_value'] ?? 0,
                'observations' => $data['observations'] ?? null,
                'internal_notes' => $data['internal_notes'] ?? null,
                'payment_terms' => $data['payment_terms'] ?? null,
                'payment_terms_detail' => $data['payment_terms_detail'] ?? null,
                'template_id' => $data['template_id'] ?? null,
                'opportunity_id' => $data['opportunity_id'] ?? null,
                'currency' => $data['currency'] ?? 'BRL',
                'custom_fields' => $data['custom_fields'] ?? null,
            ]);

            foreach ($data['equipments'] as $i => $eqData) {
                $eq = $quote->equipments()->create([
                    'tenant_id' => $tenantId,
                    'equipment_id' => $eqData['equipment_id'],
                    'description' => $eqData['description'] ?? null,
                    'sort_order' => $i,
                ]);

                foreach ($eqData['items'] as $j => $itemData) {
                    $eq->items()->create([
                        'tenant_id' => $tenantId,
                        ...Arr::only($itemData, [
                            'type', 'product_id', 'service_id', 'custom_description',
                            'quantity', 'original_price', 'cost_price', 'unit_price',
                            'discount_percentage', 'internal_note',
                        ]),
                        'sort_order' => $j,
                    ]);
                }
            }

            $quote->recalculateTotal();
            AuditLog::log('created', "Orçamento {$quote->quote_number} criado", $quote);

            return $quote;
        });
    }

    public function updateQuote(Quote $quote, array $data): Quote
    {
        return DB::transaction(function () use ($quote, $data) {
            $quote->update($data);
            $quote->increment('revision');
            $quote->recalculateTotal();
            return $quote;
        });
    }

    /**
     * Request internal approval: draft -> pending_internal_approval.
     */
    public function requestInternalApproval(Quote $quote): Quote
    {
        if ($quote->status !== QuoteStatus::DRAFT) {
            throw new \DomainException('Apenas orçamentos em rascunho podem solicitar aprovação interna');
        }

        $hasItems = $quote->equipments()->whereHas('items')->exists();
        if (!$hasItems) {
            throw new \DomainException('Orçamento precisa ter pelo menos um equipamento com itens');
        }

        $quote->update(['status' => Quote::STATUS_PENDING_INTERNAL]);
        AuditLog::log('status_changed', "Orçamento {$quote->quote_number} enviado para aprovação interna", $quote);
        return $quote;
    }

    public function sendQuote(Quote $quote): Quote
    {
        if ($quote->status !== QuoteStatus::INTERNALLY_APPROVED) {
            throw new \DomainException('Orçamento precisa estar aprovado internamente antes de enviar ao cliente');
        }

        $hasItems = $quote->equipments()->whereHas('items')->exists();
        if (!$hasItems) {
            throw new \DomainException('Orçamento precisa ter pelo menos um equipamento com itens para ser enviado');
        }

        $quote->update(['status' => Quote::STATUS_SENT, 'sent_at' => now()]);
        AuditLog::log('status_changed', "Orçamento {$quote->quote_number} enviado ao cliente", $quote);
        return $quote;
    }

    public function approveQuote(Quote $quote, ?User $actor = null): Quote
    {
        if ($quote->status !== QuoteStatus::SENT) {
            throw new \DomainException('Orçamento precisa estar enviado para aprovar');
        }

        return DB::transaction(function () use ($quote, $actor) {
            $quote->update(['status' => Quote::STATUS_APPROVED, 'approved_at' => now()]);
            AuditLog::log('status_changed', "Orçamento {$quote->quote_number} aprovado", $quote);

            $approver = $actor ?? $this->resolveApprovalActor($quote);
            if ($approver) {
                QuoteApproved::dispatch($quote, $approver);
            }

            return $quote;
        });
    }

    public function publicApprove(Quote $quote): Quote
    {
        if ($quote->status !== QuoteStatus::SENT) {
            throw new \DomainException('Orçamento não está disponível para aprovação');
        }

        if ($quote->isExpired()) {
            throw new \DomainException('Orçamento expirado');
        }

        return DB::transaction(function () use ($quote) {
            $quote->update([
                'status' => Quote::STATUS_APPROVED,
                'approved_at' => now(),
            ]);

            AuditLog::log('status_changed', "Orçamento {$quote->quote_number} aprovado pelo cliente via link público", $quote);
            $actor = $this->resolveApprovalActor($quote);
            if ($actor) {
                QuoteApproved::dispatch($quote, $actor);
            }

            return $quote;
        });
    }

    public function rejectQuote(Quote $quote, ?string $reason): Quote
    {
        if ($quote->status !== QuoteStatus::SENT) {
            throw new \DomainException('Orçamento precisa estar enviado para rejeitar');
        }

        return DB::transaction(function () use ($quote, $reason) {
            $quote->update([
                'status' => Quote::STATUS_REJECTED,
                'rejected_at' => now(),
                'rejection_reason' => $reason,
            ]);
            AuditLog::log('status_changed', "Orçamento {$quote->quote_number} rejeitado", $quote);

            return $quote;
        });
    }

    public function reopenQuote(Quote $quote): Quote
    {
        $allowedStatuses = [QuoteStatus::REJECTED, QuoteStatus::EXPIRED];
        if (!in_array($quote->status, $allowedStatuses, true)) {
            throw new \DomainException('Só é possível reabrir orçamentos rejeitados ou expirados');
        }

        return DB::transaction(function () use ($quote) {
            $quote->update([
                'status' => Quote::STATUS_DRAFT,
                'rejected_at' => null,
                'rejection_reason' => null,
            ]);
            $quote->increment('revision');
            AuditLog::log('status_changed', "Orçamento {$quote->quote_number} reaberto (rev. {$quote->revision})", $quote);

            return $quote;
        });
    }

    public function duplicateQuote(Quote $quote): Quote
    {
        return DB::transaction(function () use ($quote) {
            $newQuote = $quote->replicate(['quote_number', 'status', 'sent_at', 'approved_at', 'rejected_at']);
            $newQuote->quote_number = Quote::nextNumber($quote->tenant_id);
            $newQuote->status = Quote::STATUS_DRAFT;
            $newQuote->save();

            foreach ($quote->equipments as $eq) {
                $newEq = $newQuote->equipments()->create([
                    'tenant_id' => $quote->tenant_id,
                    ...$eq->only(['equipment_id', 'description', 'sort_order']),
                ]);
                foreach ($eq->items as $item) {
                    $newEq->items()->create([
                        'tenant_id' => $quote->tenant_id,
                        ...$item->only([
                            'type', 'product_id', 'service_id', 'custom_description',
                            'quantity', 'original_price', 'cost_price', 'unit_price',
                            'discount_percentage', 'sort_order', 'internal_note',
                        ]),
                    ]);
                }
            }

            $newQuote->recalculateTotal();
            AuditLog::log('created', "Orçamento {$newQuote->quote_number} duplicado de {$quote->quote_number}", $newQuote);

            return $newQuote;
        });
    }

    public function updateItem(QuoteItem $item, array $data): QuoteItem
    {
        return DB::transaction(function () use ($item, $data) {
            $item->update(Arr::only($data, [
                'custom_description', 'quantity', 'original_price', 'cost_price',
                'unit_price', 'discount_percentage', 'internal_note',
            ]));

            // recalculateTotal() é chamado automaticamente pelo evento saved do QuoteItem

            return $item->fresh(['product', 'service']);
        });
    }

    public function updateEquipment(QuoteEquipment $equipment, array $data): QuoteEquipment
    {
        return DB::transaction(function () use ($equipment, $data) {
            $equipment->update(Arr::only($data, ['description', 'sort_order']));
            return $equipment->fresh(['equipment']);
        });
    }

    public function convertToWorkOrder(Quote $quote, int $userId): WorkOrder
    {
        if ($quote->status !== QuoteStatus::APPROVED) {
            throw new \DomainException('Orçamento precisa estar aprovado para converter');
        }

        $existingWorkOrder = WorkOrder::query()
            ->where('tenant_id', $quote->tenant_id)
            ->where('quote_id', $quote->id)
            ->first();

        if ($existingWorkOrder) {
            throw new \App\Exceptions\QuoteAlreadyConvertedException($existingWorkOrder);
        }

        $existingCall = \App\Models\ServiceCall::query()
            ->where('tenant_id', $quote->tenant_id)
            ->where('quote_id', $quote->id)
            ->first();

        if ($existingCall) {
            throw new \DomainException("Orçamento já convertido no chamado #{$existingCall->call_number}. Não é possível criar OS.");
        }

        return DB::transaction(function () use ($quote, $userId) {
            $quote->load([
                'equipments.items.product:id,name',
                'equipments.items.service:id,name',
            ]);

            $wo = WorkOrder::create([
                'tenant_id' => $quote->tenant_id,
                'number' => WorkOrder::nextNumber($quote->tenant_id),
                'customer_id' => $quote->customer_id,
                'quote_id' => $quote->id,
                'origin_type' => WorkOrder::ORIGIN_QUOTE,
                'lead_source' => $quote->source, // Propagar origem comercial para comissão
                'seller_id' => $quote->seller_id,
                'created_by' => $userId,
                'status' => WorkOrder::STATUS_OPEN,
                'priority' => WorkOrder::PRIORITY_NORMAL,
                'description' => $quote->observations ?? "Gerada a partir do orçamento {$quote->quote_number}",
                'total' => $quote->total,
            ]);

            foreach ($quote->equipments as $eq) {
                foreach ($eq->items as $item) {
                    $preDiscountTotal = bcmul((string) $item->quantity, (string) $item->unit_price, 2);
                    $lineSubtotal = (string) $item->subtotal;
                    $discountAmount = bcsub($preDiscountTotal, $lineSubtotal, 2);
                    if (bccomp($discountAmount, '0', 2) < 0) {
                        $discountAmount = '0.00';
                    }

                    $wo->items()->create([
                        'tenant_id' => $quote->tenant_id,
                        'type' => $item->type,
                        'reference_id' => $item->type === WorkOrderItem::TYPE_PRODUCT ? $item->product_id : $item->service_id,
                        'description' => $item->custom_description
                            ?: ($item->product?->name ?? $item->service?->name ?? 'Item de orçamento'),
                        'quantity' => $item->quantity,
                        'unit_price' => $item->unit_price,
                        'discount' => $discountAmount,
                    ]);
                }

                if ($eq->equipment_id) {
                    $wo->equipmentsList()->syncWithoutDetaching([
                        $eq->equipment_id => ['observations' => $eq->description ?? ''],
                    ]);
                }
            }

            $quote->update(['status' => Quote::STATUS_INVOICED]);
            AuditLog::log('created', "OS criada a partir do orçamento {$quote->quote_number}", $wo);

            return $wo;
        });
    }


    public function convertToServiceCall(Quote $quote, int $userId): \App\Models\ServiceCall
    {
        if ($quote->status !== QuoteStatus::APPROVED) {
            throw new \DomainException('Orçamento precisa estar aprovado para converter em chamado');
        }

        $existingWo = WorkOrder::query()
            ->where('tenant_id', $quote->tenant_id)
            ->where('quote_id', $quote->id)
            ->first();

        if ($existingWo) {
            $woNumber = $existingWo->os_number ?? $existingWo->number;
            throw new \DomainException("Orçamento já convertido na OS #{$woNumber}. Não é possível criar chamado.");
        }

        $existingCall = \App\Models\ServiceCall::query()
            ->where('tenant_id', $quote->tenant_id)
            ->where('quote_id', $quote->id)
            ->first();

        if ($existingCall) {
            throw new \DomainException("Orçamento já convertido no chamado #{$existingCall->call_number}");
        }

        return DB::transaction(function () use ($quote, $userId) {
            $call = \App\Models\ServiceCall::create([
                'tenant_id' => $quote->tenant_id,
                'call_number' => \App\Models\ServiceCall::nextNumber($quote->tenant_id),
                'customer_id' => $quote->customer_id,
                'quote_id' => $quote->id,
                'status' => 'open',
                'priority' => 'normal',
                'observations' => $quote->observations ?? "Chamado gerado a partir do orçamento {$quote->quote_number}",
                'created_by' => $userId,
            ]);

            $quote->update(['status' => Quote::STATUS_INVOICED]);
            AuditLog::log('created', "Chamado {$call->call_number} criado a partir do orçamento {$quote->quote_number}", $call);

            return $call;
        });
    }

    private function resolveApprovalActor(Quote $quote): ?User
    {
        if ($quote->relationLoaded('seller') && $quote->seller) {
            return $quote->seller;
        }

        if ($quote->seller_id) {
            $seller = User::find($quote->seller_id);
            if ($seller) {
                return $seller;
            }
        }

        return User::where('tenant_id', $quote->tenant_id)->orderBy('id')->first();
    }

    // ── New methods for improvements ──

    public function sendEmail(Quote $quote, string $recipientEmail, ?string $recipientName, ?string $message, int $sentBy): QuoteEmail
    {
        $quote->load(['customer', 'equipments.items', 'seller']);

        $pdf = Pdf::loadView('pdf.quote', compact('quote'));
        $pdfContent = $pdf->output();

        $subject = "Orçamento #{$quote->quote_number}";

        Mail::send('emails.quote-ready', [
            'quote' => $quote,
            'customerName' => $recipientName ?? $quote->customer?->name ?? 'Cliente',
            'total' => number_format((float) $quote->total, 2, ',', '.'),
            'approvalUrl' => $quote->approval_url,
            'customMessage' => $message,
        ], function ($mail) use ($recipientEmail, $recipientName, $subject, $pdfContent, $quote) {
            $mail->to($recipientEmail, $recipientName)
                ->subject($subject)
                ->attachData($pdfContent, "Orcamento-{$quote->quote_number}.pdf", [
                    'mime' => 'application/pdf',
                ]);
        });

        $emailLog = QuoteEmail::create([
            'tenant_id' => $quote->tenant_id,
            'quote_id' => $quote->id,
            'sent_by' => $sentBy,
            'recipient_email' => $recipientEmail,
            'recipient_name' => $recipientName,
            'subject' => $subject,
            'status' => 'sent',
            'message_body' => $message,
            'pdf_attached' => true,
        ]);

        AuditLog::log('email_sent', "E-mail com orçamento {$quote->quote_number} enviado para {$recipientEmail}", $quote);

        return $emailLog;
    }

    public function createFromTemplate(QuoteTemplate $template, array $data, int $tenantId, int $userId): Quote
    {
        $data['template_id'] = $template->id;
        $data['payment_terms_detail'] = $data['payment_terms_detail'] ?? $template->payment_terms_text;
        return $this->createQuote($data, $tenantId, $userId);
    }

    public function advancedSummary(int $tenantId): array
    {
        $quotes = Quote::where('tenant_id', $tenantId);
        $total = $quotes->count();
        $approved = (clone $quotes)->where('status', QuoteStatus::APPROVED)->count() +
                    (clone $quotes)->where('status', QuoteStatus::INVOICED)->count();

        $avgTicket = (clone $quotes)->whereIn('status', [
            QuoteStatus::APPROVED, QuoteStatus::INVOICED,
        ])->avg('total') ?? 0;

        $avgConversionDays = (clone $quotes)
            ->whereNotNull('approved_at')
            ->whereNotNull('sent_at')
            ->selectRaw('AVG(DATEDIFF(approved_at, sent_at)) as avg_days')
            ->value('avg_days') ?? 0;

        $topSellers = Quote::where('tenant_id', $tenantId)
            ->whereIn('status', [QuoteStatus::APPROVED, QuoteStatus::INVOICED])
            ->selectRaw('seller_id, COUNT(*) as total_approved, SUM(total) as total_value')
            ->groupBy('seller_id')
            ->orderByDesc('total_value')
            ->limit(5)
            ->with('seller:id,name')
            ->get();

        $monthlyTrend = Quote::where('tenant_id', $tenantId)
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as total, SUM(CASE WHEN status IN ('approved', 'invoiced') THEN 1 ELSE 0 END) as approved")
            ->groupByRaw("DATE_FORMAT(created_at, '%Y-%m')")
            ->orderBy('month', 'desc')
            ->limit(12)
            ->get();

        return [
            'total_quotes' => $total,
            'total_approved' => $approved,
            'conversion_rate' => $total > 0 ? round(($approved / $total) * 100, 1) : 0,
            'avg_ticket' => round((float) $avgTicket, 2),
            'avg_conversion_days' => round((float) $avgConversionDays, 1),
            'top_sellers' => $topSellers,
            'monthly_trend' => $monthlyTrend,
        ];
    }

    public function trackClientView(Quote $quote): void
    {
        $quote->update([
            'client_viewed_at' => now(),
            'client_view_count' => $quote->client_view_count + 1,
        ]);
    }

    public function internalApproveLevel2(Quote $quote, int $approverId): Quote
    {
        if ($quote->status !== QuoteStatus::PENDING_INTERNAL_APPROVAL) {
            throw new \DomainException('Orçamento não está aguardando aprovação interna');
        }

        return DB::transaction(function () use ($quote, $approverId) {
            $quote->update([
                'level2_approved_by' => $approverId,
                'level2_approved_at' => now(),
                'status' => Quote::STATUS_INTERNALLY_APPROVED,
            ]);

            AuditLog::log('status_changed', "Orçamento {$quote->quote_number} aprovado internamente (nível 2)", $quote);
            return $quote;
        });
    }
}
