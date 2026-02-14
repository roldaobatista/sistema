<?php

namespace Tests\Unit;

use App\Enums\StockMovementType;
use App\Models\Customer;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PROFESSIONAL Unit Tests — StockService
 *
 * Tests stock movements with exact quantities, types, references,
 * and database verification after each operation.
 */
class StockServiceProfessionalTest extends TestCase
{
    use RefreshDatabase;

    private StockService $service;
    private Tenant $tenant;
    private User $user;
    private Product $product;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new StockService();
        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        $this->customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
        $this->product = Product::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Sensor de Temperatura',
            'stock_qty' => 100,
        ]);

        $this->actingAs($this->user);
        app()->instance('current_tenant_id', $this->tenant->id);
    }

    private function createWorkOrder(): WorkOrder
    {
        return WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'business_number' => 'OS-2025-001',
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 1. RESERVA
    // ═══════════════════════════════════════════════════════════

    public function test_reserve_creates_reserve_movement(): void
    {
        $wo = $this->createWorkOrder();

        $movement = $this->service->reserve($this->product, 5, $wo);

        $this->assertInstanceOf(StockMovement::class, $movement);
        $this->assertEquals(StockMovementType::Reserve, $movement->type);
        $this->assertEquals(5, $movement->quantity);
        $this->assertStringContainsString('OS-2025-001', $movement->reference);
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $this->product->id,
            'type' => StockMovementType::Reserve->value,
            'quantity' => 5,
            'work_order_id' => $wo->id,
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 2. SAÍDA (FATURAMENTO)
    // ═══════════════════════════════════════════════════════════

    public function test_deduct_creates_exit_movement_with_invoice_reference(): void
    {
        $wo = $this->createWorkOrder();

        $movement = $this->service->deduct($this->product, 3, $wo);

        $this->assertEquals(StockMovementType::Exit, $movement->type);
        $this->assertEquals(3, $movement->quantity);
        $this->assertStringContainsString('faturamento', $movement->reference);
    }

    // ═══════════════════════════════════════════════════════════
    // 3. DEVOLUÇÃO (CANCELAMENTO)
    // ═══════════════════════════════════════════════════════════

    public function test_return_stock_creates_return_movement(): void
    {
        $wo = $this->createWorkOrder();

        $movement = $this->service->returnStock($this->product, 2, $wo);

        $this->assertEquals(StockMovementType::Return, $movement->type);
        $this->assertEquals(2, $movement->quantity);
        $this->assertStringContainsString('cancelamento', $movement->reference);
    }

    // ═══════════════════════════════════════════════════════════
    // 4. ENTRADA MANUAL COM CUSTO UNITÁRIO
    // ═══════════════════════════════════════════════════════════

    public function test_manual_entry_records_unit_cost(): void
    {
        $movement = $this->service->manualEntry(
            $this->product,
            qty: 20,
            unitCost: 45.50,
            notes: 'Compra fornecedor ABC',
            user: $this->user
        );

        $this->assertEquals(StockMovementType::Entry, $movement->type);
        $this->assertEquals(20, $movement->quantity);
        $this->assertEquals(45.50, $movement->unit_cost);
        $this->assertEquals('Entrada manual', $movement->reference);
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $this->product->id,
            'unit_cost' => 45.50,
            'notes' => 'Compra fornecedor ABC',
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 5. AJUSTE DE INVENTÁRIO
    // ═══════════════════════════════════════════════════════════

    public function test_manual_adjustment_uses_adjustment_type(): void
    {
        $movement = $this->service->manualAdjustment(
            $this->product,
            qty: -5,
            notes: 'Diferença inventário',
            user: $this->user
        );

        $this->assertEquals(StockMovementType::Adjustment, $movement->type);
        $this->assertEquals('Ajuste de inventário', $movement->reference);
    }

    // ═══════════════════════════════════════════════════════════
    // 6. QUANTIDADE SEMPRE É ABS()
    // ═══════════════════════════════════════════════════════════

    public function test_negative_quantity_is_stored_as_absolute(): void
    {
        $movement = $this->service->manualAdjustment(
            $this->product,
            qty: -10,
            notes: null,
            user: $this->user
        );

        $this->assertEquals(10, $movement->quantity);
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $this->product->id,
            'quantity' => 10,
        ]);
    }

    // ═══════════════════════════════════════════════════════════
    // 7. TENANT_ID HERDA DO PRODUTO
    // ═══════════════════════════════════════════════════════════

    public function test_movement_inherits_tenant_from_product(): void
    {
        $wo = $this->createWorkOrder();
        $movement = $this->service->reserve($this->product, 1, $wo);

        $this->assertEquals($this->product->tenant_id, $movement->tenant_id);
    }

    // ═══════════════════════════════════════════════════════════
    // 8. WORK ORDER REFERENCIADA QUANDO FORNECIDA
    // ═══════════════════════════════════════════════════════════

    public function test_movement_references_work_order(): void
    {
        $wo = $this->createWorkOrder();
        $movement = $this->service->deduct($this->product, 1, $wo);

        $this->assertEquals($wo->id, $movement->work_order_id);
    }

    // ═══════════════════════════════════════════════════════════
    // 9. SEM WORK ORDER, CAMPO É NULL
    // ═══════════════════════════════════════════════════════════

    public function test_manual_entry_has_null_work_order(): void
    {
        $movement = $this->service->manualEntry(
            $this->product,
            qty: 10,
            unitCost: 30.00,
            notes: 'Reposição',
            user: $this->user
        );

        $this->assertNull($movement->work_order_id);
    }

    // ═══════════════════════════════════════════════════════════
    // 10. CREATED_BY REGISTRA O USUÁRIO
    // ═══════════════════════════════════════════════════════════

    public function test_movement_records_created_by_user(): void
    {
        $movement = $this->service->manualEntry(
            $this->product,
            qty: 5,
            unitCost: 10.00,
            notes: null,
            user: $this->user
        );

        $this->assertEquals($this->user->id, $movement->created_by);
    }
}
