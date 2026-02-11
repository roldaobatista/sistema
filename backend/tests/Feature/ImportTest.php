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
}
