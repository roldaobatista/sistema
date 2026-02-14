<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Equipment;
use App\Models\EquipmentDocument;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Professional Equipment tests — verifies code generation, calibration lifecycle,
 * maintenance tracking, document upload, and exact CRUD behavior.
 */
class EquipmentProfessionalTest extends TestCase
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

    // ── CREATE ──

    public function test_create_equipment_persists_all_fields(): void
    {
        $response = $this->postJson('/api/v1/equipments', [
            'customer_id' => $this->customer->id,
            'type' => 'Balança Rodoviária',
            'category' => 'balanca_rodoviaria',
            'brand' => 'Toledo',
            'model' => 'PRIX-3000',
            'serial_number' => 'SN-PRO-001',
            'status' => Equipment::STATUS_ACTIVE,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('serial_number', 'SN-PRO-001')
            ->assertJsonPath('brand', 'Toledo');

        $this->assertDatabaseHas('equipments', [
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'serial_number' => 'SN-PRO-001',
            'category' => 'balanca_rodoviaria',
            'brand' => 'Toledo',
            'model' => 'PRIX-3000',
            'status' => Equipment::STATUS_ACTIVE,
        ]);
    }

    public function test_create_equipment_auto_calculates_next_calibration(): void
    {
        $response = $this->postJson('/api/v1/equipments', [
            'customer_id' => $this->customer->id,
            'type' => 'Balança',
            'category' => 'balanca_plataforma',
            'serial_number' => 'SN-CALC-001',
            'last_calibration_at' => '2025-06-01',
            'calibration_interval_months' => 12,
        ]);

        $response->assertStatus(201);

        $equipment = Equipment::where('serial_number', 'SN-CALC-001')->first();
        $this->assertEquals('2025-06-01', $equipment->last_calibration_at->format('Y-m-d'));
        $this->assertEquals('2026-06-01', $equipment->next_calibration_at->format('Y-m-d'));
    }

    // ── UPDATE ──

    public function test_update_equipment_changes_status_and_brand(): void
    {
        $eq = Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => Equipment::STATUS_ACTIVE,
            'brand' => 'Toledo',
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

    // ── DELETE ──

    public function test_delete_equipment_soft_deletes(): void
    {
        $eq = Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->deleteJson("/api/v1/equipments/{$eq->id}");

        $response->assertStatus(204);
        $this->assertSoftDeleted('equipments', ['id' => $eq->id]);
    }

    // ── SEARCH & FILTER ──

    public function test_search_by_serial_number_returns_exact_match(): void
    {
        Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'serial_number' => 'UNIQUE-ABC-999',
        ]);

        Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'serial_number' => 'OTHER-XYZ-111',
        ]);

        $response = $this->getJson('/api/v1/equipments?search=UNIQUE');

        $response->assertOk()
            ->assertJsonPath('total', 1);
    }

    public function test_filter_by_status_returns_only_matching(): void
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

    // ── CALIBRATION ──

    public function test_add_calibration_persists_all_data(): void
    {
        $equipment = Equipment::factory()->create(['tenant_id' => $this->tenant->id]);

        $response = $this->postJson("/api/v1/equipments/{$equipment->id}/calibrations", [
            'calibration_date' => '2026-02-01',
            'calibration_type' => 'externa',
            'result' => 'aprovado',
            'laboratory' => 'Lab Teste LTDA',
            'certificate_number' => 'CERT-PRO-001',
            'cost' => 350.50,
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('equipment_calibrations', [
            'equipment_id' => $equipment->id,
            'certificate_number' => 'CERT-PRO-001',
            'laboratory' => 'Lab Teste LTDA',
            'cost' => 350.50,
            'result' => 'aprovado',
        ]);
    }

    // ── MAINTENANCE ──

    public function test_add_maintenance_persists_with_downtime(): void
    {
        $equipment = Equipment::factory()->create(['tenant_id' => $this->tenant->id]);

        $response = $this->postJson("/api/v1/equipments/{$equipment->id}/maintenances", [
            'type' => 'corretiva',
            'description' => 'Troca de célula de carga',
            'cost' => 1200.00,
            'downtime_hours' => 8.5,
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('equipment_maintenances', [
            'equipment_id' => $equipment->id,
            'description' => 'Troca de célula de carga',
            'cost' => 1200.00,
            'downtime_hours' => 8.5,
        ]);
    }

    // ── DOCUMENT UPLOAD ──

    public function test_upload_document_stores_file_correctly(): void
    {
        Storage::fake('local');

        $equipment = Equipment::factory()->create(['tenant_id' => $this->tenant->id]);
        $file = UploadedFile::fake()->create('manual_tecnico.pdf', 200);

        $response = $this->postJson("/api/v1/equipments/{$equipment->id}/documents", [
            'name' => 'Manual Técnico',
            'type' => 'manual',
            'file' => $file,
        ]);

        $response->assertStatus(201);

        $doc = EquipmentDocument::first();
        $this->assertEquals('Manual Técnico', $doc->name);
        $this->assertEquals('manual', $doc->type);
        Storage::disk('local')->assertExists($doc->file_path);
    }

    // ── TENANT ISOLATION ──

    public function test_equipment_from_other_tenant_not_visible(): void
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
            ->assertJsonPath('total', 1)
            ->assertDontSee('EXTERNO-SN');
    }

    // ── CONSTANTS ──

    public function test_constants_returns_categories_and_statuses(): void
    {
        $response = $this->getJson('/api/v1/equipments-constants');

        $response->assertOk()
            ->assertJsonStructure(['categories', 'statuses']);
    }
}
