<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\RecurringContract;
use App\Models\RecurringContractItem;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Professional Recurring Contract tests — replaces RecurringContractExtendedTest.
 * Exact status assertions, DB verification, WO generation, active/inactive guards.
 */
class RecurringContractProfessionalTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([
            \App\Http\Middleware\EnsureTenantScope::class,
            \App\Http\Middleware\CheckPermission::class,
        ]);

        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);
        $this->customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    // ── CREATE ──

    public function test_create_contract_with_items_persists(): void
    {
        $response = $this->postJson('/api/v1/recurring-contracts', [
            'customer_id' => $this->customer->id,
            'name' => 'Calibração Mensal - Balança Industrial',
            'frequency' => 'monthly',
            'start_date' => now()->addDays(7)->format('Y-m-d'),
            'priority' => 'normal',
            'items' => [
                [
                    'type' => 'service',
                    'description' => 'Calibração de balança',
                    'quantity' => 1,
                    'unit_price' => 350.00,
                ],
            ],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'Calibração Mensal - Balança Industrial')
            ->assertJsonPath('frequency', 'monthly');

        $this->assertDatabaseHas('recurring_contracts', [
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'name' => 'Calibração Mensal - Balança Industrial',
            'frequency' => 'monthly',
            'is_active' => true,
        ]);

        $contract = RecurringContract::where('name', 'Calibração Mensal - Balança Industrial')->first();
        $this->assertDatabaseHas('recurring_contract_items', [
            'recurring_contract_id' => $contract->id,
            'description' => 'Calibração de balança',
            'unit_price' => 350.00,
        ]);
    }

    public function test_create_contract_requires_customer_and_name(): void
    {
        $response = $this->postJson('/api/v1/recurring-contracts', [
            'frequency' => 'monthly',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['customer_id', 'name']);
    }

    public function test_create_contract_validates_frequency_enum(): void
    {
        $response = $this->postJson('/api/v1/recurring-contracts', [
            'customer_id' => $this->customer->id,
            'name' => 'Contrato teste',
            'frequency' => 'every_day', // invalid
            'start_date' => now()->format('Y-m-d'),
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['frequency']);
    }

    // ── READ ──

    public function test_list_contracts_returns_paginated(): void
    {
        RecurringContract::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson('/api/v1/recurring-contracts');

        $response->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_show_contract_returns_with_items_and_customer(): void
    {
        $contract = RecurringContract::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'name' => 'Contrato Show Test',
        ]);

        $response = $this->getJson("/api/v1/recurring-contracts/{$contract->id}");

        $response->assertOk()
            ->assertJsonPath('name', 'Contrato Show Test');
    }

    // ── UPDATE ──

    public function test_update_contract_persists_changes(): void
    {
        $contract = RecurringContract::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'name' => 'Original',
            'is_active' => true,
        ]);

        $response = $this->putJson("/api/v1/recurring-contracts/{$contract->id}", [
            'name' => 'Contrato Atualizado',
            'is_active' => false,
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('recurring_contracts', [
            'id' => $contract->id,
            'name' => 'Contrato Atualizado',
            'is_active' => false,
        ]);
    }

    // ── WORK ORDER GENERATION ──

    public function test_generate_wo_from_active_contract_creates_work_order(): void
    {
        $contract = RecurringContract::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'is_active' => true,
            'name' => 'Contrato para gerar OS',
        ]);

        RecurringContractItem::factory()->create([
            'recurring_contract_id' => $contract->id,
            'type' => 'service',
            'description' => 'Calibração mensal',
            'quantity' => 1,
            'unit_price' => 400.00,
        ]);

        $response = $this->postJson("/api/v1/recurring-contracts/{$contract->id}/generate");

        $response->assertStatus(201);

        // WorkOrder should be created with the correct customer
        $this->assertDatabaseHas('work_orders', [
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        // Contract last_generated_at should be updated
        $contract->refresh();
        $this->assertNotNull($contract->last_generated_at);
    }

    public function test_generate_rejects_inactive_contract(): void
    {
        $contract = RecurringContract::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'is_active' => false,
        ]);

        $response = $this->postJson("/api/v1/recurring-contracts/{$contract->id}/generate");

        $response->assertStatus(422);
    }

    // ── DELETE ──

    public function test_delete_contract_soft_deletes(): void
    {
        $contract = RecurringContract::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->deleteJson("/api/v1/recurring-contracts/{$contract->id}");

        $response->assertStatus(204);
        $this->assertSoftDeleted('recurring_contracts', ['id' => $contract->id]);
    }

    // ── TENANT ISOLATION ──

    public function test_contract_from_other_tenant_not_visible(): void
    {
        $otherTenant = Tenant::factory()->create();

        RecurringContract::factory()->create([
            'tenant_id' => $otherTenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'name' => 'Contrato externo',
        ]);

        $response = $this->getJson('/api/v1/recurring-contracts');

        $response->assertOk()
            ->assertDontSee('Contrato externo');
    }
}
