<?php

namespace Tests\Unit;

use App\Models\AccountReceivable;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderItem;
use App\Services\InvoicingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PROFESSIONAL Unit Tests — InvoicingService
 *
 * Tests invoice + receivable generation from work orders with
 * exact values, database verification, and transaction safety.
 */
class InvoicingServiceProfessionalTest extends TestCase
{
    use RefreshDatabase;

    private InvoicingService $service;
    private Tenant $tenant;
    private User $user;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new InvoicingService();
        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        $this->customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        $this->actingAs($this->user);
        app()->instance('current_tenant_id', $this->tenant->id);
    }

    private function createWorkOrderWithItems(float $total, array $items = []): WorkOrder
    {
        $wo = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'total' => $total,
            'status' => WorkOrder::STATUS_COMPLETED,
            'business_number' => 'OS-2025-100',
        ]);

        if (empty($items)) {
            $items = [
                ['type' => 'service', 'description' => 'Calibração balança', 'quantity' => 1, 'unit_price' => $total, 'total' => $total],
            ];
        }

        foreach ($items as $item) {
            WorkOrderItem::create(array_merge([
                'work_order_id' => $wo->id,
                'tenant_id' => $this->tenant->id,
                'cost_price' => 0,
            ], $item));
        }

        return $wo;
    }

    // ═══════════════════════════════════════════════════════════
    // 1. GERA INVOICE COM TOTAL CORRETO
    // ═══════════════════════════════════════════════════════════

    public function test_generates_invoice_with_correct_total(): void
    {
        $wo = $this->createWorkOrderWithItems(7500.00);

        $result = $this->service->generateFromWorkOrder($wo, $this->user->id);

        $this->assertArrayHasKey('invoice', $result);
        $this->assertInstanceOf(Invoice::class, $result['invoice']);
        $this->assertEquals(7500.00, $result['invoice']->total);
        $this->assertEquals(Invoice::STATUS_ISSUED, $result['invoice']->status);
        $this->assertDatabaseHas('invoices', [
            'work_order_id' => $wo->id,
            'customer_id' => $this->customer->id,
            'total' => 7500.00,
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 2. GERA CONTA A RECEBER
    // ═══════════════════════════════════════════════════════════

    public function test_generates_account_receivable_with_correct_amount(): void
    {
        $wo = $this->createWorkOrderWithItems(3200.00);

        $result = $this->service->generateFromWorkOrder($wo, $this->user->id);

        $this->assertArrayHasKey('ar', $result);
        $this->assertInstanceOf(AccountReceivable::class, $result['ar']);
        $this->assertEquals(3200.00, $result['ar']->amount);
        $this->assertEquals(0, $result['ar']->amount_paid);
        $this->assertEquals(AccountReceivable::STATUS_PENDING, $result['ar']->status);
        $this->assertDatabaseHas('account_receivables', [
            'work_order_id' => $wo->id,
            'amount' => 3200.00,
            'amount_paid' => 0,
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 3. NÚMERO DE FATURA SEQUENCIAL
    // ═══════════════════════════════════════════════════════════

    public function test_invoice_number_is_generated(): void
    {
        $wo = $this->createWorkOrderWithItems(1000.00);

        $result = $this->service->generateFromWorkOrder($wo, $this->user->id);

        $this->assertNotNull($result['invoice']->invoice_number);
        $this->assertNotEmpty($result['invoice']->invoice_number);
    }

    // ═══════════════════════════════════════════════════════════
    // 4. ITENS SÃO COPIADOS DA OS
    // ═══════════════════════════════════════════════════════════

    public function test_invoice_copies_items_from_work_order(): void
    {
        $wo = $this->createWorkOrderWithItems(8000.00, [
            ['type' => 'service', 'description' => 'Calibração', 'quantity' => 2, 'unit_price' => 2500, 'total' => 5000],
            ['type' => 'product', 'description' => 'Peça X', 'quantity' => 3, 'unit_price' => 1000, 'total' => 3000],
        ]);

        $result = $this->service->generateFromWorkOrder($wo, $this->user->id);
        $invoiceItems = $result['invoice']->items;

        $this->assertCount(2, $invoiceItems);
        $this->assertEquals('Calibração', $invoiceItems[0]['description']);
        $this->assertEquals(2, $invoiceItems[0]['quantity']);
        $this->assertEquals(2500, $invoiceItems[0]['unit_price']);
    }

    // ═══════════════════════════════════════════════════════════
    // 5. DUE DATE É 30 DIAS A PARTIR DE HOJE
    // ═══════════════════════════════════════════════════════════

    public function test_ar_due_date_is_30_days_from_now(): void
    {
        $wo = $this->createWorkOrderWithItems(5000.00);

        $result = $this->service->generateFromWorkOrder($wo, $this->user->id);

        $expectedDue = now()->addDays(30)->format('Y-m-d');
        $this->assertEquals($expectedDue, $result['ar']->due_date->format('Y-m-d'));
    }

    // ═══════════════════════════════════════════════════════════
    // 6. CREATED_BY CORRETO
    // ═══════════════════════════════════════════════════════════

    public function test_created_by_uses_provided_user_id(): void
    {
        $wo = $this->createWorkOrderWithItems(5000.00);
        $anotherUser = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);

        $result = $this->service->generateFromWorkOrder($wo, $anotherUser->id);

        $this->assertEquals($anotherUser->id, $result['invoice']->created_by);
        $this->assertEquals($anotherUser->id, $result['ar']->created_by);
    }

    // ═══════════════════════════════════════════════════════════
    // 7. AR DESCRIPTION CONTÉM NÚMERO DA OS E FATURA
    // ═══════════════════════════════════════════════════════════

    public function test_ar_description_includes_wo_and_invoice_numbers(): void
    {
        $wo = $this->createWorkOrderWithItems(5000.00);

        $result = $this->service->generateFromWorkOrder($wo, $this->user->id);

        $this->assertStringContainsString('OS-2025-100', $result['ar']->description);
        $this->assertStringContainsString($result['invoice']->invoice_number, $result['ar']->description);
    }

    // ═══════════════════════════════════════════════════════════
    // 8. ISSUED_AT É AGORA
    // ═══════════════════════════════════════════════════════════

    public function test_invoice_issued_at_is_set_to_now(): void
    {
        $wo = $this->createWorkOrderWithItems(5000.00);

        $result = $this->service->generateFromWorkOrder($wo, $this->user->id);

        $this->assertEquals(now()->format('Y-m-d'), $result['invoice']->issued_at->format('Y-m-d'));
    }
}
