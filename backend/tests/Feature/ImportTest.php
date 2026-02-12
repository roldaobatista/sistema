<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Import;
use App\Models\ImportTemplate;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ImportTest extends TestCase
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
        Sanctum::actingAs($this->user, ['*']);

        Storage::fake('local');
    }

    // ── Fields ──

    public function test_get_fields_for_valid_entity(): void
    {
        $response = $this->getJson('/api/v1/import/fields/customers');

        $response->assertOk()
            ->assertJsonStructure(['fields' => [['key', 'label', 'required']]]);
    }

    public function test_get_fields_for_invalid_entity(): void
    {
        $response = $this->getJson('/api/v1/import/fields/invalid_entity');

        $response->assertStatus(422);
    }

    // ── Upload ──

    public function test_upload_csv_file(): void
    {
        $csvContent = "Nome;CPF/CNPJ;Email\nJoão Silva;12345678901;joao@test.com\nMaria Santos;98765432100;maria@test.com";
        $file = UploadedFile::fake()->createWithContent('clientes.csv', $csvContent);

        $response = $this->postJson('/api/v1/import/upload', [
            'file' => $file,
            'entity_type' => Import::ENTITY_CUSTOMERS,
        ]);

        $response->assertOk()
            ->assertJsonStructure([
                'file_path', 'file_name', 'encoding', 'separator',
                'headers', 'total_rows', 'entity_type', 'available_fields',
            ])
            ->assertJsonPath('total_rows', 2)
            ->assertJsonPath('entity_type', Import::ENTITY_CUSTOMERS);
    }

    public function test_upload_rejects_invalid_entity(): void
    {
        $file = UploadedFile::fake()->createWithContent('test.csv', "header\nvalue");

        $response = $this->postJson('/api/v1/import/upload', [
            'file' => $file,
            'entity_type' => 'invalido',
        ]);

        $response->assertStatus(422);
    }

    public function test_upload_rejects_invalid_file_type(): void
    {
        $file = UploadedFile::fake()->create('test.pdf', 100, 'application/pdf');

        $response = $this->postJson('/api/v1/import/upload', [
            'file' => $file,
            'entity_type' => Import::ENTITY_CUSTOMERS,
        ]);

        $response->assertStatus(422);
    }

    // ── Preview ──

    public function test_preview_validates_path_traversal(): void
    {
        $response = $this->postJson('/api/v1/import/preview', [
            'file_path' => '../../../etc/passwd',
            'entity_type' => Import::ENTITY_CUSTOMERS,
            'mapping' => ['name' => 'Nome'],
        ]);

        $response->assertStatus(422);
    }

    public function test_preview_validates_required_path_prefix(): void
    {
        $response = $this->postJson('/api/v1/import/preview', [
            'file_path' => 'storage/not-imports/file.csv',
            'entity_type' => Import::ENTITY_CUSTOMERS,
            'mapping' => ['name' => 'Nome'],
        ]);

        $response->assertStatus(422);
    }

    // ── Execute ──

    public function test_execute_validates_path_traversal(): void
    {
        $response = $this->postJson('/api/v1/import/execute', [
            'file_path' => '../../secrets.csv',
            'entity_type' => Import::ENTITY_CUSTOMERS,
            'mapping' => ['name' => 'Nome', 'document' => 'CPF'],
        ]);

        $response->assertStatus(422);
    }

    // ── History ──

    public function test_history_returns_paginated_results(): void
    {
        Import::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
        ]);

        $response = $this->getJson('/api/v1/import/history');

        $response->assertOk()
            ->assertJsonStructure(['data', 'total']);
    }

    public function test_history_only_shows_own_tenant(): void
    {
        // Importações do tenant atual
        Import::factory()->count(2)->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
        ]);

        // Importações de outro tenant
        $otherTenant = Tenant::factory()->create();
        $otherUser = User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'current_tenant_id' => $otherTenant->id,
        ]);
        Import::factory()->count(3)->create([
            'tenant_id' => $otherTenant->id,
            'user_id' => $otherUser->id,
        ]);

        $response = $this->getJson('/api/v1/import/history');

        $response->assertOk()
            ->assertJsonPath('total', 2);
    }

    // ── Templates ──

    // ─── Templates ──

    public function test_save_template(): void
    {
        $response = $this->postJson('/api/v1/import/templates', [
            'entity_type' => Import::ENTITY_CUSTOMERS,
            'name' => 'Meu Template',
            'mapping' => ['name' => 'Nome', 'document' => 'CPF/CNPJ'],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('template.name', 'Meu Template');

        $this->assertDatabaseHas('import_templates', [
            'tenant_id' => $this->tenant->id,
            'name' => 'Meu Template',
        ]);
    }

    public function test_list_templates(): void
    {
        ImportTemplate::factory()->count(2)->create([
            'tenant_id' => $this->tenant->id,
            'entity_type' => Import::ENTITY_CUSTOMERS,
        ]);

        $response = $this->getJson('/api/v1/import/templates?entity_type=' . Import::ENTITY_CUSTOMERS);

        $response->assertOk()
            ->assertJsonCount(2, 'templates');
    }

    public function test_templates_only_shows_own_tenant(): void
    {
        ImportTemplate::factory()->count(2)->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $otherTenant = Tenant::factory()->create();
        ImportTemplate::factory()->count(3)->create([
            'tenant_id' => $otherTenant->id,
        ]);

        $response = $this->getJson('/api/v1/import/templates');

        $response->assertOk()
            ->assertJsonCount(2, 'templates');
    }

    public function test_save_template_rejects_invalid_entity(): void
    {
        $response = $this->postJson('/api/v1/import/templates', [
            'entity_type' => 'invalido',
            'name' => 'Template',
            'mapping' => ['name' => 'Nome'],
        ]);

        $response->assertStatus(422);
    }

    // ─── Execution Logic Tests ───

    public function test_execute_creates_customers(): void
    {
        // Mocking file existence to avoid real FS issues or needing the file to persist from upload
        // In a real integration test, we might want to actually behave like the controller.
        // For simplicity, we bypass the file check in the controller by mocking Storage or ensuring file exists.
        
        $fileName = 'customers_test.csv';
        $content = "Nome;CPF;Email\nJoão Teste;123.456.789-00;joao@teste.com";
        Storage::disk('local')->put("imports/$fileName", $content);

        // We need to pass the full path relative to storage root for the controller to find it?
        // The controller looks for "imports/..." and uses Storage::disk('local')->path()
        // Storage::fake replaces the disk, so checking file_exists(Storage::path(...)) works.

        $response = $this->postJson('/api/v1/import/execute', [
            'file_path' => "imports/$fileName",
            'entity_type' => Import::ENTITY_CUSTOMERS,
            'mapping' => [
                'name' => 'Nome',
                'document' => 'CPF',
                'email' => 'Email'
            ],
            'separator' => ';',
            'duplicate_strategy' => Import::STRATEGY_SKIP
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('customers', [
            'tenant_id' => $this->tenant->id,
            'name' => 'João Teste',
            'email' => 'joao@teste.com'
        ]);
    }

    public function test_execute_updates_existing_customer(): void
    {
        $customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'document' => '12345678900',
            'name' => 'Old Name',
        ]);

        $fileName = 'update_test.csv';
        $content = "Documento;Nome\n12345678900;New Name";
        Storage::disk('local')->put("imports/$fileName", $content);

        $response = $this->postJson('/api/v1/import/execute', [
            'file_path' => "imports/$fileName",
            'entity_type' => Import::ENTITY_CUSTOMERS,
            'mapping' => [
                'document' => 'Documento',
                'name' => 'Nome',
            ],
            'separator' => ';',
            'duplicate_strategy' => Import::STRATEGY_UPDATE
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('customers', [
            'id' => $customer->id,
            'name' => 'New Name',
        ]);
    }

    public function test_execute_skips_duplicate_customer(): void
    {
        $customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'document' => '12345678900',
            'name' => 'Original Name',
        ]);

        $fileName = 'skip_test.csv';
        $content = "Documento;Nome\n12345678900;New Name";
        Storage::disk('local')->put("imports/$fileName", $content);

        $response = $this->postJson('/api/v1/import/execute', [
            'file_path' => "imports/$fileName",
            'entity_type' => Import::ENTITY_CUSTOMERS,
            'mapping' => [
                'document' => 'Documento',
                'name' => 'Nome',
            ],
            'separator' => ';',
            'duplicate_strategy' => Import::STRATEGY_SKIP
        ]);

        $response->assertOk();
        $this->assertEquals(0, $response->json('inserted'));
        $this->assertEquals(0, $response->json('updated'));
        $this->assertEquals(1, $response->json('skipped'));

        $this->assertDatabaseHas('customers', [
            'id' => $customer->id,
            'name' => 'Original Name',
        ]);
    }

    // ─── Importação de Produtos ───

    public function test_execute_creates_products(): void
    {
        $fileName = 'products_test.csv';
        $content = "Codigo;Nome;Preco\nPROD-001;Parafuso Inox;15,50";
        Storage::disk('local')->put("imports/$fileName", $content);

        $response = $this->postJson('/api/v1/import/execute', [
            'file_path' => "imports/$fileName",
            'entity_type' => Import::ENTITY_PRODUCTS,
            'mapping' => [
                'code' => 'Codigo',
                'name' => 'Nome',
                'sell_price' => 'Preco',
            ],
            'separator' => ';',
            'duplicate_strategy' => Import::STRATEGY_SKIP,
        ]);

        $response->assertOk();
        $this->assertEquals(1, $response->json('inserted'));

        $this->assertDatabaseHas('products', [
            'tenant_id' => $this->tenant->id,
            'code' => 'PROD-001',
            'name' => 'Parafuso Inox',
        ]);
    }

    // ─── Preview — Arquivo Não Encontrado ───

    public function test_preview_returns_404_for_missing_file(): void
    {
        $response = $this->postJson('/api/v1/import/preview', [
            'file_path' => 'imports/nonexistent_file.csv',
            'entity_type' => Import::ENTITY_CUSTOMERS,
            'mapping' => ['name' => 'Nome'],
        ]);

        $response->assertStatus(404);
    }

    public function test_history_uses_current_tenant_when_user_switches_company(): void
    {
        $switchedTenant = Tenant::factory()->create();

        $this->user->update([
            'current_tenant_id' => $switchedTenant->id,
        ]);

        app()->instance('current_tenant_id', $switchedTenant->id);

        Import::factory()->count(2)->create([
            'tenant_id' => $switchedTenant->id,
            'user_id' => $this->user->id,
        ]);

        Import::factory()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
        ]);

        $response = $this->getJson('/api/v1/import/history');

        $response->assertOk()
            ->assertJsonPath('total', 2);
    }

    public function test_save_template_uses_current_tenant_when_user_switches_company(): void
    {
        $switchedTenant = Tenant::factory()->create();

        $this->user->update([
            'current_tenant_id' => $switchedTenant->id,
        ]);

        app()->instance('current_tenant_id', $switchedTenant->id);

        $response = $this->postJson('/api/v1/import/templates', [
            'entity_type' => Import::ENTITY_CUSTOMERS,
            'name' => 'Template Tenant Atual',
            'mapping' => ['name' => 'Nome'],
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('import_templates', [
            'tenant_id' => $switchedTenant->id,
            'name' => 'Template Tenant Atual',
        ]);
    }

    // ─── Show ───

    public function test_show_returns_import_details(): void
    {
        $import = Import::factory()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
        ]);

        $response = $this->getJson("/api/v1/import/{$import->id}");

        $response->assertOk()
            ->assertJsonPath('import.id', $import->id);
    }

    public function test_show_returns_404_for_other_tenant(): void
    {
        $otherTenant = Tenant::factory()->create();
        $otherUser = User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'current_tenant_id' => $otherTenant->id,
        ]);
        $import = Import::factory()->create([
            'tenant_id' => $otherTenant->id,
            'user_id' => $otherUser->id,
        ]);

        $response = $this->getJson("/api/v1/import/{$import->id}");

        $response->assertStatus(404);
    }

    // ─── Destroy ───

    public function test_destroy_allows_failed_import(): void
    {
        $import = Import::factory()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'status' => Import::STATUS_FAILED,
        ]);

        $response = $this->deleteJson("/api/v1/import/{$import->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('imports', ['id' => $import->id]);
    }

    public function test_destroy_rejects_done_import(): void
    {
        $import = Import::factory()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'status' => Import::STATUS_DONE,
        ]);

        $response = $this->deleteJson("/api/v1/import/{$import->id}");

        $response->assertStatus(422);
        $this->assertDatabaseHas('imports', ['id' => $import->id]);
    }

    // ─── Delete Template ───

    public function test_delete_template(): void
    {
        $template = ImportTemplate::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->deleteJson("/api/v1/import/templates/{$template->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('import_templates', ['id' => $template->id]);
    }

    public function test_delete_template_returns_404_for_other_tenant(): void
    {
        $otherTenant = Tenant::factory()->create();
        $template = ImportTemplate::factory()->create([
            'tenant_id' => $otherTenant->id,
        ]);

        $response = $this->deleteJson("/api/v1/import/templates/{$template->id}");

        $response->assertStatus(404);
    }

    // ─── Export Errors ───

    public function test_export_errors_csv(): void
    {
        $import = Import::factory()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'error_log' => [
                ['line' => 2, 'message' => 'Campo obrigatório', 'data' => ['name' => '']],
                ['line' => 5, 'message' => 'CPF inválido', 'data' => ['document' => '123']],
            ],
        ]);

        $response = $this->get("/api/v1/import/{$import->id}/errors");

        $response->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
    }

    public function test_export_errors_returns_404_for_no_errors(): void
    {
        $import = Import::factory()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'error_log' => [],
        ]);

        $response = $this->get("/api/v1/import/{$import->id}/errors");

        $response->assertStatus(404);
    }

    // ─── Rollback ───

    public function test_rollback_rejects_non_done_import(): void
    {
        $import = Import::factory()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'status' => Import::STATUS_FAILED,
        ]);

        $response = $this->postJson("/api/v1/import/{$import->id}/rollback");

        $response->assertStatus(422);
    }

    public function test_rollback_deletes_imported_records(): void
    {
        $customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $import = Import::factory()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'entity_type' => Import::ENTITY_CUSTOMERS,
            'status' => Import::STATUS_DONE,
            'imported_ids' => [$customer->id],
        ]);

        $response = $this->postJson("/api/v1/import/{$import->id}/rollback");

        $response->assertOk()
            ->assertJsonPath('deleted', 1);

        $this->assertSoftDeleted('customers', ['id' => $customer->id]);

        $import->refresh();
        $this->assertEquals(Import::STATUS_ROLLED_BACK, $import->status);
    }

    // ─── Stats ───

    public function test_stats_returns_aggregated_data(): void
    {
        Import::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'entity_type' => Import::ENTITY_CUSTOMERS,
            'status' => Import::STATUS_DONE,
            'inserted' => 10,
            'updated' => 5,
        ]);

        $response = $this->getJson('/api/v1/import-stats');

        $response->assertOk()
            ->assertJsonStructure(['stats' => ['customers' => ['total_imports', 'successful', 'success_rate', 'total_inserted', 'total_updated']]]);

        $this->assertEquals(3, $response->json('stats.customers.total_imports'));
        $this->assertEquals(30, $response->json('stats.customers.total_inserted'));
    }

    // ─── Entity Counts ───

    public function test_entity_counts_returns_data(): void
    {
        \App\Models\Customer::factory()->count(5)->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->getJson('/api/v1/import-entity-counts');

        $response->assertOk()
            ->assertJsonStructure(['counts' => ['customers', 'products', 'services', 'equipments', 'suppliers']]);

        $this->assertEquals(5, $response->json('counts.customers'));
    }

    // ─── Download Sample ───

    public function test_download_sample_returns_csv(): void
    {
        $response = $this->get('/api/v1/import/sample/customers');

        $response->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
    }

    public function test_download_sample_rejects_invalid_entity(): void
    {
        $response = $this->get('/api/v1/import/sample/invalid_entity');

        $response->assertStatus(422);
    }

    // ─── Export Data ───

    public function test_export_data_returns_csv(): void
    {
        \App\Models\Customer::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $response = $this->get('/api/v1/import/export/customers');

        $response->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
    }

    // ─── History Search ───

    public function test_history_search_by_filename(): void
    {
        Import::factory()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'original_name' => 'clientes_especiais.csv',
        ]);

        Import::factory()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'original_name' => 'produtos_geral.csv',
        ]);

        $response = $this->getJson('/api/v1/import/history?search=clientes');

        $response->assertOk()
            ->assertJsonPath('total', 1);
    }
}
