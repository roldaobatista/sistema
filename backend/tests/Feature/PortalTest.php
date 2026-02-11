<?php

namespace Tests\Feature;

use App\Events\QuoteApproved;
use App\Models\ClientPortalUser;
use App\Models\Customer;
use App\Models\Equipment;
use App\Models\Quote;
use App\Models\ServiceCall;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PortalTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private Customer $customer;
    private ClientPortalUser $portalUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();
        $this->customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        $this->portalUser = ClientPortalUser::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'name' => 'Portal Cliente',
            'email' => 'portal@example.com',
            'password' => 'senha12345',
            'is_active' => true,
        ]);

        Sanctum::actingAs($this->portalUser, ['portal:access']);
    }

    public function test_portal_reject_quote_uses_supported_columns(): void
    {
        $seller = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);

        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'seller_id' => $seller->id,
            'status' => 'sent',
        ]);

        $response = $this->putJson("/api/v1/portal/quotes/{$quote->id}/status", [
            'action' => 'reject',
            'comments' => 'Cliente optou por adiar.',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'rejected')
            ->assertJsonPath('data.rejection_reason', 'Cliente optou por adiar.');

        $this->assertDatabaseHas('quotes', [
            'id' => $quote->id,
            'status' => 'rejected',
            'rejection_reason' => 'Cliente optou por adiar.',
        ]);
    }

    public function test_portal_approve_quote_dispatches_quote_approved_event(): void
    {
        Event::fake([QuoteApproved::class]);

        $seller = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);

        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'seller_id' => $seller->id,
            'status' => 'sent',
        ]);

        $this->putJson("/api/v1/portal/quotes/{$quote->id}/status", [
            'action' => 'approve',
        ])->assertOk()->assertJsonPath('data.status', 'approved');

        Event::assertDispatched(QuoteApproved::class);
    }

    public function test_portal_new_service_call_uses_valid_schema_and_links_equipment(): void
    {
        $equipment = Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->postJson('/api/v1/portal/service-calls', [
            'equipment_id' => $equipment->id,
            'description' => 'Chamado aberto pelo cliente no portal para verificacao tecnica.',
            'priority' => 'high',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('priority', 'high')
            ->assertJsonPath('status', 'open');

        $serviceCallId = $response->json('id');

        $this->assertDatabaseHas('service_calls', [
            'id' => $serviceCallId,
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'priority' => 'high',
            'status' => 'open',
            'observations' => 'Chamado aberto pelo cliente no portal para verificacao tecnica.',
        ]);

        $this->assertDatabaseHas('service_call_equipments', [
            'service_call_id' => $serviceCallId,
            'equipment_id' => $equipment->id,
        ]);

        $this->assertStringStartsWith('CT-', ServiceCall::findOrFail($serviceCallId)->call_number);
    }
    public function test_cannot_approve_expired_quote_via_portal(): void
    {
        $seller = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);

        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'seller_id' => $seller->id,
            'status' => 'sent',
            'valid_until' => now()->subDay(),
        ]);

        $this->putJson("/api/v1/portal/quotes/{$quote->id}/status", [
            'action' => 'approve',
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Este orcamento esta expirado.');
    }
}
