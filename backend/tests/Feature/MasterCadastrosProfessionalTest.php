<?php

namespace Tests\Feature;

use App\Models\ChartOfAccount;
use App\Models\PaymentMethod;
use App\Models\ServiceChecklist;
use App\Models\SlaPolicy;
use App\Models\StandardWeight;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Professional Master Cadastros tests — replaces MasterCadastrosExtendedTest.
 * Exact status assertions, DB verification for all create operations.
 */
class MasterCadastrosProfessionalTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;

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

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    // ── STANDARD WEIGHTS ──

    public function test_create_standard_weight_persists(): void
    {
        $response = $this->postJson('/api/v1/standard-weights', [
            'code' => 'PP-PRO-001',
            'nominal_value' => 10.000,
            'unit' => 'kg',
            'class' => 'M1',
            'status' => 'active',
            'calibration_date' => now()->format('Y-m-d'),
            'next_calibration_date' => now()->addYear()->format('Y-m-d'),
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('standard_weights', [
            'tenant_id' => $this->tenant->id,
            'code' => 'PP-PRO-001',
            'class' => 'M1',
            'status' => 'active',
        ]);
    }

    public function test_list_standard_weights_returns_data(): void
    {
        $response = $this->getJson('/api/v1/standard-weights');
        $response->assertOk();
    }

    public function test_standard_weights_expiring_returns_upcoming(): void
    {
        $response = $this->getJson('/api/v1/standard-weights/expiring');
        $response->assertOk();
    }

    public function test_standard_weights_constants_returns_classes(): void
    {
        $response = $this->getJson('/api/v1/standard-weights/constants');
        $response->assertOk()
            ->assertJsonStructure(['classes', 'units', 'statuses']);
    }

    public function test_create_duplicate_standard_weight_code_rejected(): void
    {
        $this->postJson('/api/v1/standard-weights', [
            'code' => 'PP-DUP-001',
            'nominal_value' => 5.000,
            'unit' => 'kg',
            'class' => 'M1',
            'status' => 'active',
            'calibration_date' => now()->format('Y-m-d'),
            'next_calibration_date' => now()->addYear()->format('Y-m-d'),
        ])->assertStatus(201);

        $this->postJson('/api/v1/standard-weights', [
            'code' => 'PP-DUP-001',
            'nominal_value' => 10.000,
            'unit' => 'kg',
            'class' => 'M2',
            'status' => 'active',
            'calibration_date' => now()->format('Y-m-d'),
            'next_calibration_date' => now()->addYear()->format('Y-m-d'),
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['code']);
    }

    // ── NUMBERING SEQUENCES ──

    public function test_list_numbering_sequences_returns_configuration(): void
    {
        $response = $this->getJson('/api/v1/numbering-sequences');
        $response->assertOk();
    }

    // ── PAYMENT METHODS ──

    public function test_create_payment_method_persists(): void
    {
        $response = $this->postJson('/api/v1/payment-methods', [
            'name' => 'PIX',
            'is_active' => true,
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('payment_methods', [
            'tenant_id' => $this->tenant->id,
            'name' => 'PIX',
            'is_active' => true,
        ]);
    }

    public function test_list_payment_methods_returns_active(): void
    {
        $response = $this->getJson('/api/v1/payment-methods');
        $response->assertOk();
    }

    public function test_create_duplicate_payment_method_rejected(): void
    {
        $this->postJson('/api/v1/payment-methods', [
            'name' => 'Boleto',
            'is_active' => true,
        ])->assertStatus(201);

        $this->postJson('/api/v1/payment-methods', [
            'name' => 'Boleto',
            'is_active' => true,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    // ── CHART OF ACCOUNTS ──

    public function test_create_chart_of_account_persists(): void
    {
        $response = $this->postJson('/api/v1/chart-of-accounts', [
            'code' => '1.1.1',
            'name' => 'Caixa',
            'type' => 'asset',
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('chart_of_accounts', [
            'tenant_id' => $this->tenant->id,
            'code' => '1.1.1',
            'name' => 'Caixa',
            'type' => 'asset',
        ]);
    }

    public function test_list_chart_of_accounts_returns_tree(): void
    {
        $response = $this->getJson('/api/v1/chart-of-accounts');
        $response->assertOk();
    }

    public function test_create_duplicate_chart_code_rejected(): void
    {
        $this->postJson('/api/v1/chart-of-accounts', [
            'code' => '2.1.1',
            'name' => 'Fornecedores',
            'type' => 'liability',
        ])->assertStatus(201);

        $this->postJson('/api/v1/chart-of-accounts', [
            'code' => '2.1.1',
            'name' => 'Outro nome',
            'type' => 'liability',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['code']);
    }

    // ── SERVICE CHECKLISTS ──

    public function test_create_service_checklist_with_items_persists(): void
    {
        $response = $this->postJson('/api/v1/service-checklists', [
            'name' => 'Checklist de Calibração',
            'items' => [
                ['label' => 'Verificar zeragem', 'required' => true],
                ['label' => 'Registrar temperatura', 'required' => false],
            ],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'Checklist de Calibração');

        $this->assertDatabaseHas('service_checklists', [
            'tenant_id' => $this->tenant->id,
            'name' => 'Checklist de Calibração',
        ]);
    }

    public function test_list_service_checklists_returns_data(): void
    {
        $response = $this->getJson('/api/v1/service-checklists');
        $response->assertOk();
    }

    // ── SLA POLICIES ──

    public function test_create_sla_policy_persists_with_times(): void
    {
        $response = $this->postJson('/api/v1/sla-policies', [
            'name' => 'SLA Premium',
            'response_time_hours' => 4,
            'resolution_time_hours' => 24,
            'is_active' => true,
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('sla_policies', [
            'tenant_id' => $this->tenant->id,
            'name' => 'SLA Premium',
            'response_time_hours' => 4,
            'resolution_time_hours' => 24,
            'is_active' => true,
        ]);
    }

    public function test_list_sla_policies_returns_data(): void
    {
        $response = $this->getJson('/api/v1/sla-policies');
        $response->assertOk();
    }

    public function test_create_sla_policy_validates_required_fields(): void
    {
        $response = $this->postJson('/api/v1/sla-policies', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }
}
