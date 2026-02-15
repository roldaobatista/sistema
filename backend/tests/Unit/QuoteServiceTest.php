<?php

namespace Tests\Unit;

use App\Models\Customer;
use App\Models\Quote;
use App\Models\Tenant;
use App\Models\User;
use App\Services\QuoteService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Unit tests for QuoteService — validates quote lifecycle:
 * create, send, approve, reject, reopen, duplicate, and convert to OS.
 */
class QuoteServiceTest extends TestCase
{
    use RefreshDatabase;

    private QuoteService $service;
    private Tenant $tenant;
    private User $user;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new QuoteService();
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

    // ── CREATE ──

    public function test_create_quote_returns_quote_instance(): void
    {
        $quote = $this->service->createQuote([
            'customer_id' => $this->customer->id,
            'valid_until' => now()->addDays(30)->format('Y-m-d'),
            'equipments' => [
                [
                    'equipment_id' => \App\Models\Equipment::factory()->create(['tenant_id' => $this->tenant->id])->id,
                    'items' => [
                        ['type' => 'service', 'service_id' => \App\Models\Service::factory()->create(['tenant_id' => $this->tenant->id])->id, 'quantity' => 1, 'original_price' => 100, 'unit_price' => 100, 'discount_percentage' => 0],
                    ],
                ],
            ],
        ], $this->tenant->id, $this->user->id);

        $this->assertInstanceOf(Quote::class, $quote);
        $this->assertEquals($this->tenant->id, $quote->tenant_id);
        $this->assertEquals($this->customer->id, $quote->customer_id);
        $this->assertEquals(Quote::STATUS_DRAFT, $quote->status);
    }

    // ── SEND ──

    public function test_send_changes_status_to_sent(): void
    {
        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => Quote::STATUS_INTERNALLY_APPROVED,
            'valid_until' => now()->addDays(30),
        ]);

        // Precisa ter ao menos 1 equipamento com item
        $eq = $quote->equipments()->create([
            'tenant_id' => $this->tenant->id,
            'equipment_id' => \App\Models\Equipment::factory()->create(['tenant_id' => $this->tenant->id])->id,
            'sort_order' => 0,
        ]);
        $eq->items()->create([
            'tenant_id' => $this->tenant->id,
            'type' => 'service',
            'service_id' => \App\Models\Service::factory()->create(['tenant_id' => $this->tenant->id])->id,
            'quantity' => 1,
            'original_price' => 100,
            'unit_price' => 100,
            'discount_percentage' => 0,
            'sort_order' => 0,
        ]);

        $result = $this->service->sendQuote($quote);

        $this->assertEquals(Quote::STATUS_SENT, $result->status);
        $this->assertNotNull($result->sent_at);
    }

    // ── APPROVE ──

    public function test_approve_changes_status_and_records_timestamp(): void
    {
        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => Quote::STATUS_SENT,
            'valid_until' => now()->addDays(30),
        ]);

        $result = $this->service->approveQuote($quote, $this->user);

        $this->assertEquals(Quote::STATUS_APPROVED, $result->status);
        $this->assertNotNull($result->approved_at);
    }

    // ── REJECT ──

    public function test_reject_stores_reason(): void
    {
        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => Quote::STATUS_SENT,
            'valid_until' => now()->addDays(30),
        ]);

        $result = $this->service->rejectQuote($quote, 'Preço muito alto');

        $this->assertEquals(Quote::STATUS_REJECTED, $result->status);
        $this->assertEquals('Preço muito alto', $result->rejection_reason);
        $this->assertNotNull($result->rejected_at);
    }

    // ── REOPEN ──

    public function test_reopen_returns_to_draft(): void
    {
        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => Quote::STATUS_REJECTED,
            'valid_until' => now()->addDays(30),
        ]);

        $result = $this->service->reopenQuote($quote);

        $this->assertEquals(Quote::STATUS_DRAFT, $result->status);
    }

    // ── DUPLICATE ──

    public function test_duplicate_creates_new_draft_copy(): void
    {
        $original = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => Quote::STATUS_APPROVED,
            'valid_until' => now()->addDays(30),
        ]);

        $copy = $this->service->duplicateQuote($original);

        $this->assertNotEquals($original->id, $copy->id);
        $this->assertEquals(Quote::STATUS_DRAFT, $copy->status);
        $this->assertEquals($original->customer_id, $copy->customer_id);
        $this->assertEquals($original->tenant_id, $copy->tenant_id);
    }

    // ── CONVERT TO WORK ORDER ──

    public function test_convert_to_work_order_creates_os(): void
    {
        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => Quote::STATUS_APPROVED,
            'valid_until' => now()->addDays(30),
        ]);

        $wo = $this->service->convertToWorkOrder($quote, $this->user->id);

        $this->assertNotNull($wo);
        $this->assertEquals($this->customer->id, $wo->customer_id);
        $this->assertEquals($this->tenant->id, $wo->tenant_id);

        // Quote should be marked as invoiced after conversion
        $quote->refresh();
        $this->assertEquals(Quote::STATUS_INVOICED, $quote->status);
    }
}
