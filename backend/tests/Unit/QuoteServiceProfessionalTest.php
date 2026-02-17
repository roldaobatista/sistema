<?php

namespace Tests\Unit;

use App\Enums\QuoteStatus;
use App\Events\QuoteApproved;
use App\Models\Customer;
use App\Models\Equipment;
use App\Models\Quote;
use App\Models\QuoteEquipment;
use App\Models\QuoteItem;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\QuoteService;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * PROFESSIONAL Unit Tests — QuoteService
 *
 * Tests the full lifecycle: draft → send → approve/reject → convert to WO.
 * Each test validates state transitions, guard clauses, and DB persistence.
 */
class QuoteServiceProfessionalTest extends TestCase
{
    private QuoteService $service;
    private Tenant $tenant;
    private User $user;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();
        Event::fake();

        $this->service = new QuoteService();
        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        $this->customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        $this->actingAs($this->user);
        app()->instance('current_tenant_id', $this->tenant->id);
    }

    private function createDraftQuote(): Quote
    {
        return $this->service->createQuote([
            'customer_id' => $this->customer->id,
            'valid_until' => now()->addDays(30),
            'observations' => 'Teste de calibracao balanca',
            'equipments' => [],
        ], $this->tenant->id, $this->user->id);
    }

    private function addEquipmentWithItem(Quote $quote): QuoteEquipment
    {
        $equipment = Equipment::factory()->create(['tenant_id' => $this->tenant->id]);
        $service = \App\Models\Service::factory()->create(['tenant_id' => $this->tenant->id]);

        $quoteEquipment = QuoteEquipment::create([
            'quote_id' => $quote->id,
            'tenant_id' => $this->tenant->id,
            'equipment_id' => $equipment->id,
            'description' => 'Balança modelo X',
        ]);

        QuoteItem::create([
            'quote_equipment_id' => $quoteEquipment->id,
            'tenant_id' => $this->tenant->id,
            'type' => 'service',
            'service_id' => $service->id,
            'custom_description' => 'Calibração padrão',
            'quantity' => 1,
            'original_price' => 2500.00,
            'unit_price' => 2500.00,
            'discount_percentage' => 0,
            'subtotal' => 2500.00,
        ]);

        return $quoteEquipment;
    }

    // ═══════════════════════════════════════════════════════════
    // 1. CRIAÇÃO COM quote_number
    // ═══════════════════════════════════════════════════════════

    public function test_create_quote_generates_number_and_draft_status(): void
    {
        $quote = $this->createDraftQuote();

        $this->assertNotNull($quote->id);
        $this->assertNotNull($quote->quote_number);
        $this->assertEquals(QuoteStatus::DRAFT, $quote->status);
        $this->assertEquals($this->customer->id, $quote->customer_id);
        $this->assertDatabaseHas('quotes', [
            'id' => $quote->id,
            'status' => Quote::STATUS_DRAFT,
            'customer_id' => $this->customer->id,
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 2. ENVIO (DRAFT → SENT)
    // ═══════════════════════════════════════════════════════════

    public function test_send_changes_status_to_sent_and_sets_sent_at(): void
    {
        $quote = $this->createDraftQuote();
        $this->addEquipmentWithItem($quote);

        $quote->update(['status' => Quote::STATUS_INTERNALLY_APPROVED]);
        $result = $this->service->sendQuote($quote);

        $this->assertEquals(QuoteStatus::SENT, $result->status);
        $this->assertNotNull($result->sent_at);
        $this->assertDatabaseHas('quotes', [
            'id' => $quote->id,
            'status' => Quote::STATUS_SENT,
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 3. ENVIO SEM ITENS FALHA
    // ═══════════════════════════════════════════════════════════

    public function test_send_without_items_throws_domain_exception(): void
    {
        $quote = $this->createDraftQuote();

        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('pelo menos um equipamento com itens');
        $quote->update(['status' => Quote::STATUS_INTERNALLY_APPROVED]);
        $this->service->sendQuote($quote);
    }

    // ═══════════════════════════════════════════════════════════
    // 4. APROVAÇÃO (SENT → APPROVED)
    // ═══════════════════════════════════════════════════════════

    public function test_approve_changes_status_to_approved(): void
    {
        $quote = $this->createDraftQuote();
        $this->addEquipmentWithItem($quote);
        $quote->update(['status' => Quote::STATUS_INTERNALLY_APPROVED]);
        $this->service->sendQuote($quote);

        $result = $this->service->approveQuote($quote, $this->user);

        $this->assertEquals(QuoteStatus::APPROVED, $result->status);
        $this->assertNotNull($result->approved_at);
        Event::assertDispatched(QuoteApproved::class);
    }

    // ═══════════════════════════════════════════════════════════
    // 5. APROVAÇÃO DE DRAFT FALHA
    // ═══════════════════════════════════════════════════════════

    public function test_cannot_approve_draft_quote(): void
    {
        $quote = $this->createDraftQuote();

        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('enviado para aprovar');
        $this->service->approveQuote($quote, $this->user);
    }

    // ═══════════════════════════════════════════════════════════
    // 6. REJEIÇÃO SALVA MOTIVO
    // ═══════════════════════════════════════════════════════════

    public function test_reject_saves_reason_and_sets_rejected_at(): void
    {
        $quote = $this->createDraftQuote();
        $this->addEquipmentWithItem($quote);
        $quote->update(['status' => Quote::STATUS_INTERNALLY_APPROVED]);
        $this->service->sendQuote($quote);

        $result = $this->service->rejectQuote($quote, 'Preço muito alto');

        $this->assertEquals(QuoteStatus::REJECTED, $result->status);
        $this->assertNotNull($result->rejected_at);
        $this->assertEquals('Preço muito alto', $result->rejection_reason);
        $this->assertDatabaseHas('quotes', [
            'id' => $quote->id,
            'rejection_reason' => 'Preço muito alto',
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 7. REJEIÇÃO DE DRAFT FALHA
    // ═══════════════════════════════════════════════════════════

    public function test_cannot_reject_draft_quote(): void
    {
        $quote = $this->createDraftQuote();

        $this->expectException(\DomainException::class);
        $this->service->rejectQuote($quote, 'Motivo qualquer');
    }

    // ═══════════════════════════════════════════════════════════
    // 8. CONVERSÃO EM OS (APPROVED → INVOICED + WO CRIADA)
    // ═══════════════════════════════════════════════════════════

    public function test_convert_creates_work_order_with_items(): void
    {
        $quote = $this->createDraftQuote();
        $this->addEquipmentWithItem($quote);
        $quote->update(['status' => Quote::STATUS_INTERNALLY_APPROVED]);
        $this->service->sendQuote($quote);
        $this->service->approveQuote($quote, $this->user);

        $wo = $this->service->convertToWorkOrder($quote, $this->user->id);

        $this->assertInstanceOf(WorkOrder::class, $wo);
        $this->assertEquals($this->customer->id, $wo->customer_id);
        $this->assertEquals(WorkOrder::STATUS_OPEN, $wo->status);
        $this->assertEquals($quote->id, $wo->quote_id);

        $this->assertDatabaseHas('work_orders', [
            'quote_id' => $quote->id,
            'customer_id' => $this->customer->id,
        ]);

        // WO items created from quote items
        $this->assertGreaterThan(0, $wo->items()->count());
    }

    // ═══════════════════════════════════════════════════════════
    // 9. CONVERSÃO MARCA QUOTE COMO FATURADA
    // ═══════════════════════════════════════════════════════════

    public function test_convert_marks_quote_as_invoiced(): void
    {
        $quote = $this->createDraftQuote();
        $this->addEquipmentWithItem($quote);
        $quote->update(['status' => Quote::STATUS_INTERNALLY_APPROVED]);
        $this->service->sendQuote($quote);
        $this->service->approveQuote($quote, $this->user);
        $this->service->convertToWorkOrder($quote, $this->user->id);

        $this->assertDatabaseHas('quotes', [
            'id' => $quote->id,
            'status' => Quote::STATUS_INVOICED,
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 10. CONVERSÃO DUPLICADA FALHA
    // ═══════════════════════════════════════════════════════════

    public function test_cannot_convert_same_quote_twice(): void
    {
        $quote = $this->createDraftQuote();
        $this->addEquipmentWithItem($quote);
        $quote->update(['status' => Quote::STATUS_INTERNALLY_APPROVED]);
        $this->service->sendQuote($quote);
        $this->service->approveQuote($quote, $this->user);
        $this->service->convertToWorkOrder($quote, $this->user->id);

        // Force status back to approved to test guard
        $quote->update(['status' => Quote::STATUS_APPROVED]);

        $this->expectException(\App\Exceptions\QuoteAlreadyConvertedException::class);
        $this->service->convertToWorkOrder($quote, $this->user->id);
    }

    // ═══════════════════════════════════════════════════════════
    // 11. NÃO PODE CONVERTER DRAFT
    // ═══════════════════════════════════════════════════════════

    public function test_cannot_convert_unapproved_quote(): void
    {
        $quote = $this->createDraftQuote();

        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('aprovado para converter');
        $this->service->convertToWorkOrder($quote, $this->user->id);
    }

    // ═══════════════════════════════════════════════════════════
    // 12. DUPLICAÇÃO PRESERVA CUSTOMER E RESETA STATUS
    // ═══════════════════════════════════════════════════════════

    public function test_duplicate_preserves_customer_resets_to_draft(): void
    {
        $quote = $this->createDraftQuote();
        $this->addEquipmentWithItem($quote);
        $quote->update(['status' => Quote::STATUS_INTERNALLY_APPROVED]);
        $this->service->sendQuote($quote);

        $duplicate = $this->service->duplicateQuote($quote);

        $this->assertNotEquals($quote->id, $duplicate->id);
        $this->assertEquals(QuoteStatus::DRAFT, $duplicate->status);
        $this->assertEquals($this->customer->id, $duplicate->customer_id);
        $this->assertNull($duplicate->sent_at);
        $this->assertNull($duplicate->approved_at);
    }
}
