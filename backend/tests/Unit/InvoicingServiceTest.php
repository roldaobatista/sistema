<?php

namespace Tests\Unit;

use App\Models\AccountReceivable;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\InvoicingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Unit tests for InvoicingService — validates invoice generation from
 * work orders, auto-numbering, and linked account receivable creation.
 */
class InvoicingServiceTest extends TestCase
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
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);

        $this->customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        app()->instance('current_tenant_id', $this->tenant->id);
        $this->actingAs($this->user);
    }

    private function createCompletedWO(float $total = 1500.00): WorkOrder
    {
        return WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'total' => $total,
            'status' => WorkOrder::STATUS_COMPLETED,
        ]);
    }

    // ── INVOICE GENERATION ──

    public function test_generate_creates_invoice_and_receivable(): void
    {
        $wo = $this->createCompletedWO(2500.00);
        $result = $this->service->generateFromWorkOrder($wo, $this->user->id);

        $this->assertArrayHasKey('invoice', $result);
        $this->assertArrayHasKey('ar', $result);
        $this->assertInstanceOf(Invoice::class, $result['invoice']);
        $this->assertInstanceOf(AccountReceivable::class, $result['ar']);
    }

    public function test_invoice_has_correct_total_from_work_order(): void
    {
        $wo = $this->createCompletedWO(3750.50);
        $result = $this->service->generateFromWorkOrder($wo, $this->user->id);

        $this->assertEquals(3750.50, $result['invoice']->total);
    }

    public function test_invoice_links_to_correct_customer(): void
    {
        $wo = $this->createCompletedWO();
        $result = $this->service->generateFromWorkOrder($wo, $this->user->id);

        $this->assertEquals($this->customer->id, $result['invoice']->customer_id);
        $this->assertEquals($this->customer->id, $result['ar']->customer_id);
    }

    public function test_invoice_has_issued_status(): void
    {
        $wo = $this->createCompletedWO();
        $result = $this->service->generateFromWorkOrder($wo, $this->user->id);

        $this->assertEquals(Invoice::STATUS_ISSUED, $result['invoice']->status);
    }

    public function test_receivable_has_pending_status_and_zero_paid(): void
    {
        $wo = $this->createCompletedWO(1000.00);
        $result = $this->service->generateFromWorkOrder($wo, $this->user->id);

        $this->assertEquals(AccountReceivable::STATUS_PENDING, $result['ar']->status);
        $this->assertEquals(0, $result['ar']->amount_paid);
        $this->assertEquals(1000.00, $result['ar']->amount);
    }

    public function test_invoice_has_due_date_30_days_from_now(): void
    {
        $wo = $this->createCompletedWO();
        $result = $this->service->generateFromWorkOrder($wo, $this->user->id);

        $expected = now()->addDays(30)->format('Y-m-d');
        $this->assertEquals($expected, $result['invoice']->due_date->format('Y-m-d'));
    }

    public function test_invoice_has_sequential_number(): void
    {
        $wo1 = $this->createCompletedWO();
        $wo2 = $this->createCompletedWO();

        $result1 = $this->service->generateFromWorkOrder($wo1, $this->user->id);
        $result2 = $this->service->generateFromWorkOrder($wo2, $this->user->id);

        $this->assertNotEquals(
            $result1['invoice']->invoice_number,
            $result2['invoice']->invoice_number
        );
    }

    public function test_invoice_records_correct_tenant(): void
    {
        $wo = $this->createCompletedWO();
        $result = $this->service->generateFromWorkOrder($wo, $this->user->id);

        $this->assertEquals($this->tenant->id, $result['invoice']->tenant_id);
        $this->assertEquals($this->tenant->id, $result['ar']->tenant_id);
    }
}
