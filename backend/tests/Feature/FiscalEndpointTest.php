<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\FiscalNote;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Integration tests for Fiscal API endpoints:
 * stats, contingency status, email, events, and config.
 */
class FiscalEndpointTest extends TestCase
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

        $this->tenant = Tenant::factory()->create([
            'fiscal_nfe_next_number' => 1,
            'fiscal_nfe_series' => 1,
        ]);
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

        config([
            'services.nuvemfiscal.url' => 'https://api.nuvemfiscal.com.br',
            'services.nuvemfiscal.client_id' => 'test-id',
            'services.nuvemfiscal.client_secret' => 'test-secret',
        ]);
    }

    // ─── Stats ───────────────────────────────────────

    public function test_stats_endpoint_returns_summary(): void
    {
        FiscalNote::factory()->count(5)->authorized()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);
        FiscalNote::factory()->count(2)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => 'rejected',
        ]);

        $response = $this->getJson('/api/v1/fiscal/stats');

        $response->assertOk()
            ->assertJsonStructure(['data']);
    }

    // ─── Contingency Status ──────────────────────────

    public function test_contingency_status_endpoint(): void
    {
        FiscalNote::factory()->count(2)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'contingency_mode' => true,
            'status' => FiscalNote::STATUS_PENDING,
        ]);

        $response = $this->getJson('/api/v1/fiscal/contingency/status');

        $response->assertOk()
            ->assertJsonStructure(['pending_count', 'sefaz_available']);
    }

    // ─── Events ──────────────────────────────────────

    public function test_events_endpoint_for_note(): void
    {
        $note = FiscalNote::factory()->authorized()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->getJson("/api/v1/fiscal/notas/{$note->id}/events");

        $response->assertOk();
    }

    public function test_events_endpoint_404_for_missing_note(): void
    {
        $response = $this->getJson('/api/v1/fiscal/notas/99999/events');

        $response->assertStatus(404);
    }

    // ─── Email ───────────────────────────────────────

    public function test_send_email_for_missing_note_returns_404(): void
    {
        $response = $this->postJson('/api/v1/fiscal/notas/99999/email', [
            'recipient_email' => 'test@test.com',
        ]);

        $response->assertStatus(404);
    }

    // ─── Carta de Correção ───────────────────────────

    public function test_carta_correcao_for_missing_note_returns_404(): void
    {
        $response = $this->postJson('/api/v1/fiscal/notas/99999/carta-correcao', [
            'correcao' => 'Correção de teste',
        ]);

        $response->assertStatus(404);
    }

    // ─── Config Endpoints ────────────────────────────

    public function test_fiscal_config_show(): void
    {
        $response = $this->getJson('/api/v1/fiscal/config');

        $response->assertOk();
    }

    public function test_fiscal_config_cfop_options(): void
    {
        $response = $this->getJson('/api/v1/fiscal/config/cfop-options');

        $response->assertOk();
    }

    public function test_fiscal_config_csosn_options(): void
    {
        $response = $this->getJson('/api/v1/fiscal/config/csosn-options');

        $response->assertOk();
    }

    public function test_fiscal_config_iss_exigibilidade_options(): void
    {
        $response = $this->getJson('/api/v1/fiscal/config/iss-exigibilidade-options');

        $response->assertOk();
    }

    public function test_fiscal_config_lc116_options(): void
    {
        $response = $this->getJson('/api/v1/fiscal/config/lc116-options');

        $response->assertOk();
    }

    public function test_fiscal_config_certificate_status(): void
    {
        $response = $this->getJson('/api/v1/fiscal/config/certificate/status');

        $response->assertOk();
    }

    // ─── Emit Validation ─────────────────────────────

    public function test_emit_nfe_requires_items(): void
    {
        $response = $this->postJson('/api/v1/fiscal/nfe', [
            'customer_id' => $this->customer->id,
        ]);

        $response->assertStatus(422);
    }

    public function test_emit_nfse_requires_items(): void
    {
        $response = $this->postJson('/api/v1/fiscal/nfse', [
            'customer_id' => $this->customer->id,
        ]);

        $response->assertStatus(422);
    }

    // ─── Inutilizar Validation ───────────────────────

    public function test_inutilizar_requires_range(): void
    {
        $response = $this->postJson('/api/v1/fiscal/inutilizar', []);

        $response->assertStatus(422);
    }
}
