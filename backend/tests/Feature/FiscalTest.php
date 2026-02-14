<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\FiscalNote;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FiscalTest extends TestCase
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

        // NuvemFiscalProvider requires non-null config values
        config([
            'services.nuvemfiscal.url' => 'https://api.nuvemfiscal.com.br',
            'services.nuvemfiscal.client_id' => 'test-client-id',
            'services.nuvemfiscal.client_secret' => 'test-client-secret',
        ]);
    }

    // ─── List ──────────────────────────────────────────

    public function test_list_fiscal_notes_paginates(): void
    {
        FiscalNote::factory()->count(3)->create([
            'tenant_id'   => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->getJson('/api/v1/fiscal/notas');

        $response->assertOk()
            ->assertJsonPath('total', 3);
    }

    public function test_list_fiscal_notes_filters_by_type(): void
    {
        FiscalNote::factory()->create([
            'tenant_id'   => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'type'        => 'nfe',
        ]);
        FiscalNote::factory()->create([
            'tenant_id'   => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'type'        => 'nfse',
        ]);

        $response = $this->getJson('/api/v1/fiscal/notas?type=nfe');

        $response->assertOk()
            ->assertJsonPath('total', 1);
    }

    public function test_list_fiscal_notes_filters_by_status(): void
    {
        FiscalNote::factory()->create([
            'tenant_id'   => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status'      => 'authorized',
        ]);
        FiscalNote::factory()->create([
            'tenant_id'   => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status'      => 'cancelled',
        ]);

        $response = $this->getJson('/api/v1/fiscal/notas?status=authorized');

        $response->assertOk()
            ->assertJsonPath('total', 1);
    }

    // ─── Show ──────────────────────────────────────────

    public function test_show_fiscal_note(): void
    {
        $note = FiscalNote::factory()->create([
            'tenant_id'   => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'type'        => 'nfe',
            'status'      => 'authorized',
        ]);

        $response = $this->getJson("/api/v1/fiscal/notas/{$note->id}");

        $response->assertOk()
            ->assertJsonPath('data.id', $note->id)
            ->assertJsonPath('data.type', 'nfe');
    }

    public function test_show_fiscal_note_not_found(): void
    {
        $response = $this->getJson('/api/v1/fiscal/notas/999999');

        $response->assertStatus(404);
    }

    // ─── Tenant isolation ──────────────────────────────

    public function test_cannot_see_other_tenant_fiscal_notes(): void
    {
        $otherTenant = Tenant::factory()->create();
        $otherCustomer = Customer::factory()->create(['tenant_id' => $otherTenant->id]);

        FiscalNote::factory()->create([
            'tenant_id'   => $otherTenant->id,
            'customer_id' => $otherCustomer->id,
        ]);

        $response = $this->getJson('/api/v1/fiscal/notas');

        $response->assertOk()
            ->assertJsonPath('total', 0);
    }

    // ─── Emit validation ───────────────────────────────

    public function test_emit_nfe_requires_customer_id(): void
    {
        $response = $this->postJson('/api/v1/fiscal/nfe', [
            'items' => [['description' => 'Servico', 'quantity' => 1, 'unit_price' => 100]],
        ]);

        $response->assertStatus(422);
    }

    public function test_emit_nfse_requires_customer_id(): void
    {
        $response = $this->postJson('/api/v1/fiscal/nfse', [
            'items' => [['description' => 'Servico', 'quantity' => 1, 'unit_price' => 100]],
        ]);

        $response->assertStatus(422);
    }
}
