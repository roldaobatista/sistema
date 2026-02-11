<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Equipment;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EquipmentTest extends TestCase
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
        $this->customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        app()->instance('current_tenant_id', $this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    // ── New Feature Tests ──

    public function test_equipment_code_generation_with_sequence()
    {
        $tenant = Tenant::factory()->create();
        $user = User::factory()->create(['tenant_id' => $tenant->id]);

        $this->actingAs($user);

        // Primeiro equipamento
        $eq1 = Equipment::factory()->create(['tenant_id' => $tenant->id]);
        dump($eq1->code);
        $this->assertEquals('EQP-00001', $eq1->code);

        // Segundo deve ser sequencial
        $eq2 = Equipment::factory()->create(['tenant_id' => $tenant->id]);
        
        if ($eq2->code !== 'EQP-00002') {
             throw new \Exception("Code failure. Expected EQP-00002, got: " . $eq2->code);
        }
        $this->assertEquals('EQP-00002', $eq2->code);

        // Verifica se a sequence foi criada
        $this->assertDatabaseHas('numbering_sequences', [
            'tenant_id' => $tenant->id,
            'entity' => 'equipment',
            'next_number' => 3 // Já usou 1 e 2, próximo é 3
        ]);
    }

    public function test_can_add_calibration_to_equipment()
    {
        $equipment = Equipment::factory()->create(['tenant_id' => $this->tenant->id]);

        $data = [
            'calibration_date' => now()->toDateString(),
            'calibration_type' => 'externa',
            'result' => 'aprovado',
            'laboratory' => 'Lab Teste',
            'certificate_number' => 'CERT-123',
            'cost' => 150.50
        ];

        $response = $this->postJson("/api/v1/equipments/{$equipment->id}/calibrations", $data);

        $response->assertStatus(201);
        $this->assertDatabaseHas('equipment_calibrations', [
            'equipment_id' => $equipment->id,
            'certificate_number' => 'CERT-123',
            'cost' => 150.50
        ]);
    }

    public function test_can_add_maintenance_to_equipment()
    {
        $equipment = Equipment::factory()->create(['tenant_id' => $this->tenant->id]);

        $data = [
            'type' => 'corretiva',
            'description' => 'Troca de bateria',
            'cost' => 50.00,
            'downtime_hours' => 2.5
        ];

        $response = $this->postJson("/api/v1/equipments/{$equipment->id}/maintenances", $data);

        $response->assertStatus(201);
        $this->assertDatabaseHas('equipment_maintenances', [
            'equipment_id' => $equipment->id,
            'description' => 'Troca de bateria',
            'cost' => 50.00
        ]);
    }

    public function test_can_upload_equipment_document()
    {
        \Illuminate\Support\Facades\Storage::fake('local');

        $equipment = Equipment::factory()->create(['tenant_id' => $this->tenant->id]);
        $file = \Illuminate\Http\UploadedFile::fake()->create('manual.pdf', 100);

        $data = [
            'name' => 'Manual do Usuário',
            'type' => 'manual',
            'file' => $file
        ];

        $response = $this->postJson("/api/v1/equipments/{$equipment->id}/documents", $data);

        $response->assertStatus(201);
        
        $doc = \App\Models\EquipmentDocument::first();
        $this->assertEquals('Manual do Usuário', $doc->name);
        
        // Verifica se o arquivo foi salvo
        \Illuminate\Support\Facades\Storage::disk('local')->assertExists($doc->file_path);
    }

    // ── CRUD ──

    public function test_create_equipment(): void
    {
        $response = $this->postJson('/api/v1/equipments', [
            'customer_id' => $this->customer->id,
            'type' => 'Balança Rodoviária',
            'category' => 'balanca_rodoviaria',
            'brand' => 'Toledo',
            'model' => 'PRIX-3000',
            'serial_number' => 'SN-TEST-001',
            'status' => Equipment::STATUS_ACTIVE,
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('equipments', [
            'tenant_id' => $this->tenant->id,
            'serial_number' => 'SN-TEST-001',
            'category' => 'balanca_rodoviaria',
            'status' => Equipment::STATUS_ACTIVE,
        ]);
    }

    public function test_create_equipment_calculates_next_calibration(): void
    {
        $response = $this->postJson('/api/v1/equipments', [
            'customer_id' => $this->customer->id,
            'type' => 'Balança',
            'category' => 'balanca_plataforma',
            'serial_number' => 'SN-TEST-CALC',
            'last_calibration_at' => '2023-01-01',
            'calibration_interval_months' => 12,
        ]);

        $response->assertStatus(201);

        $equipment = Equipment::where('serial_number', 'SN-TEST-CALC')->first();
        $this->assertEquals('2023-01-01', $equipment->last_calibration_at->format('Y-m-d'));
        $this->assertEquals('2024-01-01', $equipment->next_calibration_at->format('Y-m-d'));
    }

    public function test_list_equipments(): void
    {
        Equipment::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->getJson('/api/v1/equipments');

        $response->assertOk()
            ->assertJsonPath('total', 3);
    }

    public function test_show_equipment(): void
    {
        $eq = Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->getJson("/api/v1/equipments/{$eq->id}");

        $response->assertOk();
    }

    public function test_update_equipment(): void
    {
        $eq = Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => Equipment::STATUS_ACTIVE,
        ]);

        $response = $this->putJson("/api/v1/equipments/{$eq->id}", [
            'brand' => 'Filizola',
            'status' => Equipment::STATUS_IN_MAINTENANCE,
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('equipments', [
            'id' => $eq->id,
            'brand' => 'Filizola',
            'status' => Equipment::STATUS_IN_MAINTENANCE,
        ]);
    }

    public function test_delete_equipment(): void
    {
        $eq = Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->deleteJson("/api/v1/equipments/{$eq->id}");

        $response->assertStatus(204);
        $this->assertSoftDeleted('equipments', ['id' => $eq->id]);
    }

    // ── Search & Filters ──

    public function test_search_equipment_by_serial(): void
    {
        Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'serial_number' => 'UNIQUE-SN-999',
        ]);

        Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'serial_number' => 'OTHER-SN-111',
        ]);

        $response = $this->getJson('/api/v1/equipments?search=UNIQUE');

        $response->assertOk()
            ->assertJsonPath('total', 1);
    }

    public function test_filter_by_status(): void
    {
        Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => Equipment::STATUS_ACTIVE,
        ]);

        Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => Equipment::STATUS_IN_MAINTENANCE,
        ]);

        $response = $this->getJson('/api/v1/equipments?status=' . Equipment::STATUS_IN_MAINTENANCE);

        $response->assertOk()
            ->assertJsonPath('total', 1);
    }

    // ── Constants ──

    public function test_constants_returns_categories_and_statuses(): void
    {
        $response = $this->getJson('/api/v1/equipments-constants');

        $response->assertOk()
            ->assertJsonStructure(['categories', 'statuses']);
    }

    // ── Tenant Isolation ──

    public function test_equipments_isolated_by_tenant(): void
    {
        $otherTenant = Tenant::factory()->create();

        Equipment::factory()->create([
            'tenant_id' => $otherTenant->id,
            'customer_id' => $this->customer->id,
            'serial_number' => 'EXTERNO-SN',
        ]);

        Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'serial_number' => 'INTERNO-SN',
        ]);

        $response = $this->getJson('/api/v1/equipments');

        $response->assertOk()
            ->assertDontSee('EXTERNO-SN');
    }
}
