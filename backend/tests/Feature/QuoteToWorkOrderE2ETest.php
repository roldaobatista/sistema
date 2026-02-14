<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Equipment;
use App\Models\Quote;
use App\Models\QuoteEquipment;
use App\Models\QuoteItem;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * PROFESSIONAL E2E Test — Quote to Work Order Flow
 *
 * Tests the complete business flow:
 * Create Quote → Add items → Send → Approve → Convert to OS → Verify WO
 */
class QuoteToWorkOrderE2ETest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private Customer $customer;
    private Equipment $equipment;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        $this->customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
        $this->equipment = Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        Sanctum::actingAs($this->user);
        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);

        $role = \Spatie\Permission\Models\Role::firstOrCreate(
            ['name' => 'admin', 'guard_name' => 'api', 'team_id' => $this->tenant->id]
        );
        $this->user->assignRole($role);
    }

    private function createQuoteWithItems(): Quote
    {
        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'user_id' => $this->user->id,
            'status' => Quote::STATUS_DRAFT,
            'total' => 5000.00,
        ]);

        $qe = QuoteEquipment::create([
            'quote_id' => $quote->id,
            'tenant_id' => $this->tenant->id,
            'equipment_id' => $this->equipment->id,
            'description' => 'Balança modelo X',
        ]);

        QuoteItem::create([
            'quote_equipment_id' => $qe->id,
            'tenant_id' => $this->tenant->id,
            'type' => 'service',
            'custom_description' => 'Calibração padrão',
            'quantity' => 2,
            'unit_price' => 2500.00,
            'subtotal' => 5000.00,
        ]);

        return $quote;
    }

    // ═══════════════════════════════════════════════════════════
    // 1. CRIAR ORÇAMENTO VIA API
    // ═══════════════════════════════════════════════════════════

    public function test_create_quote_returns_draft(): void
    {
        $response = $this->postJson('/api/v1/quotes', [
            'customer_id' => $this->customer->id,
            'valid_until' => now()->addDays(30)->format('Y-m-d'),
            'observations' => 'Calibração de 2 balanças',
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('quotes', [
            'customer_id' => $this->customer->id,
            'status' => Quote::STATUS_DRAFT,
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 2. ENVIAR ORÇAMENTO (DRAFT → SENT)
    // ═══════════════════════════════════════════════════════════

    public function test_send_quote_changes_status(): void
    {
        $quote = $this->createQuoteWithItems();

        $response = $this->postJson("/api/v1/quotes/{$quote->id}/send");

        $response->assertOk();
        $this->assertDatabaseHas('quotes', [
            'id' => $quote->id,
            'status' => Quote::STATUS_SENT,
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 3. APROVAR ORÇAMENTO (SENT → APPROVED)
    // ═══════════════════════════════════════════════════════════

    public function test_approve_quote_changes_status(): void
    {
        $quote = $this->createQuoteWithItems();
        $quote->update(['status' => Quote::STATUS_SENT, 'sent_at' => now()]);

        $response = $this->postJson("/api/v1/quotes/{$quote->id}/approve");

        $response->assertOk();
        $this->assertDatabaseHas('quotes', [
            'id' => $quote->id,
            'status' => Quote::STATUS_APPROVED,
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 4. CONVERTER EM OS (APPROVED → INVOICED + WO ABERTA)
    // ═══════════════════════════════════════════════════════════

    public function test_convert_creates_work_order(): void
    {
        $quote = $this->createQuoteWithItems();
        $quote->update([
            'status' => Quote::STATUS_APPROVED,
            'sent_at' => now()->subDay(),
            'approved_at' => now(),
        ]);

        $response = $this->postJson("/api/v1/quotes/{$quote->id}/convert");

        $response->assertStatus(201);

        // Quote should be marked as invoiced
        $this->assertDatabaseHas('quotes', [
            'id' => $quote->id,
            'status' => Quote::STATUS_INVOICED,
        ]);

        // Work order should exist linked to quote
        $this->assertDatabaseHas('work_orders', [
            'quote_id' => $quote->id,
            'customer_id' => $this->customer->id,
            'status' => WorkOrder::STATUS_OPEN,
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 5. WO HERDA CUSTOMER DA QUOTE
    // ═══════════════════════════════════════════════════════════

    public function test_work_order_inherits_quote_customer(): void
    {
        $quote = $this->createQuoteWithItems();
        $quote->update([
            'status' => Quote::STATUS_APPROVED,
            'sent_at' => now()->subDay(),
            'approved_at' => now(),
        ]);

        $this->postJson("/api/v1/quotes/{$quote->id}/convert");

        $wo = WorkOrder::where('quote_id', $quote->id)->first();
        $this->assertNotNull($wo);
        $this->assertEquals($this->customer->id, $wo->customer_id);
    }

    // ═══════════════════════════════════════════════════════════
    // 6. FLUXO COMPLETO: draft → send → approve → convert → verify items
    // ═══════════════════════════════════════════════════════════

    public function test_full_quote_to_work_order_flow(): void
    {
        $quote = $this->createQuoteWithItems();

        // Send
        $this->postJson("/api/v1/quotes/{$quote->id}/send")
            ->assertOk();

        // Approve
        $quote->refresh();
        $this->postJson("/api/v1/quotes/{$quote->id}/approve")
            ->assertOk();

        // Convert
        $quote->refresh();
        $response = $this->postJson("/api/v1/quotes/{$quote->id}/convert");

        $response->assertStatus(201);

        // Final state
        $this->assertDatabaseHas('quotes', [
            'id' => $quote->id,
            'status' => Quote::STATUS_INVOICED,
        ]);

        $wo = WorkOrder::where('quote_id', $quote->id)->first();
        $this->assertNotNull($wo);
        $this->assertEquals(WorkOrder::STATUS_OPEN, $wo->status);
        $this->assertGreaterThan(0, $wo->items()->count());
    }
}
