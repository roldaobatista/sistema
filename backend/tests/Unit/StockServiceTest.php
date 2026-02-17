<?php

namespace Tests\Unit;

use App\Enums\StockMovementType;
use App\Models\Customer;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WorkOrder;
use App\Services\StockService;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * Unit tests for StockService — validates stock movements
 * (entry, exit, reserve, return, adjustment) and product quantity updates.
 */
class StockServiceTest extends TestCase
{
    private StockService $service;
    private Tenant $tenant;
    private User $user;
    private Product $product;
    private Customer $customer;
    private WorkOrder $workOrder;
    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();
        Event::fake();

        $this->service = new StockService();
        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);

        $this->customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $this->product = Product::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Peso Padrão 10kg',
            'stock_qty' => 50,
        ]);
        $this->warehouse = Warehouse::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Estoque Central',
            'code' => 'CENTRAL-TST',
            'type' => Warehouse::TYPE_FIXED,
            'is_active' => true,
        ]);

        $this->workOrder = WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        app()->instance('current_tenant_id', $this->tenant->id);
        $this->actingAs($this->user);
    }

    // ── MANUAL ENTRY ──

    public function test_manual_entry_creates_stock_movement(): void
    {
        $movement = $this->service->manualEntry(
            product: $this->product,
            qty: 10,
            warehouseId: $this->warehouse->id,
            unitCost: 25.50,
            notes: 'Compra fornecedor X',
            user: $this->user,
        );

        $this->assertInstanceOf(StockMovement::class, $movement);
        $this->assertEquals(StockMovementType::Entry, $movement->type);
        $this->assertEquals(10, $movement->quantity);
        $this->assertEquals(25.50, $movement->unit_cost);
        $this->assertEquals($this->product->id, $movement->product_id);
        $this->assertEquals($this->tenant->id, $movement->tenant_id);
    }

    // ── RESERVE ──

    public function test_reserve_creates_reservation_movement(): void
    {
        $movement = $this->service->reserve(
            product: $this->product,
            qty: 5,
            workOrder: $this->workOrder,
        );

        $this->assertEquals(StockMovementType::Reserve, $movement->type);
        $this->assertEquals(5, $movement->quantity);
        $this->assertEquals($this->workOrder->id, $movement->work_order_id);
        $this->assertStringContainsString('OS-', $movement->reference);
    }

    // ── DEDUCT ──

    public function test_deduct_creates_exit_movement(): void
    {
        $movement = $this->service->deduct(
            product: $this->product,
            qty: 3,
            workOrder: $this->workOrder,
        );

        $this->assertEquals(StockMovementType::Exit, $movement->type);
        $this->assertEquals(3, $movement->quantity);
        $this->assertStringContainsString('faturamento', $movement->reference);
    }

    // ── RETURN ──

    public function test_return_stock_creates_return_movement(): void
    {
        $movement = $this->service->returnStock(
            product: $this->product,
            qty: 2,
            workOrder: $this->workOrder,
        );

        $this->assertEquals(StockMovementType::Return, $movement->type);
        $this->assertEquals(2, $movement->quantity);
        $this->assertStringContainsString('cancelamento', $movement->reference);
    }

    // ── MANUAL ADJUSTMENT ──

    public function test_manual_adjustment_creates_adjustment_movement(): void
    {
        $movement = $this->service->manualAdjustment(
            product: $this->product,
            qty: -3,
            warehouseId: $this->warehouse->id,
            notes: 'Ajuste de inventário físico',
            user: $this->user,
        );

        $this->assertEquals(StockMovementType::Adjustment, $movement->type);
        $this->assertEquals(-3, $movement->quantity);
        $this->assertEquals('Ajuste de inventário', $movement->reference);
    }

    // ── EDGE CASES ──

    public function test_movement_always_stores_absolute_quantity(): void
    {
        $movement = $this->service->manualEntry(
            product: $this->product,
            qty: -10,
            warehouseId: $this->warehouse->id, // negative input
            unitCost: 5.00,
            notes: null,
            user: $this->user,
        );

        $this->assertEquals(10, $movement->quantity); // stored as abs
    }

    public function test_movement_records_correct_tenant_id(): void
    {
        $movement = $this->service->manualEntry(
            product: $this->product,
            qty: 1,
            warehouseId: $this->warehouse->id,
            unitCost: 1.00,
            notes: null,
            user: $this->user,
        );

        $this->assertEquals($this->tenant->id, $movement->tenant_id);
    }
}
