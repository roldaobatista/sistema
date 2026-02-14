<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Quote;
use App\Models\ServiceCall;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ConvertToServiceCallTest extends TestCase
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

    public function test_approved_quote_converts_to_service_call(): void
    {
        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'seller_id' => $this->user->id,
            'status' => Quote::STATUS_APPROVED,
            'quote_number' => 'ORC-SC-001',
        ]);

        $response = $this->postJson("/api/v1/quotes/{$quote->id}/convert-to-chamado");

        $response->assertStatus(201);

        $callId = $response->json('id');
        $this->assertNotNull($callId);

        $call = ServiceCall::find($callId);
        $this->assertNotNull($call);
        $this->assertEquals($this->customer->id, $call->customer_id);
        $this->assertEquals($quote->id, $call->quote_id);
        $this->assertEquals('open', $call->status);
        $this->assertStringStartsWith('CT-', $call->call_number);

        // Quote should be marked as invoiced
        $this->assertEquals(Quote::STATUS_INVOICED, $quote->fresh()->status);

        // Audit log should exist
        $this->assertDatabaseHas('audit_logs', [
            'auditable_type' => ServiceCall::class,
            'auditable_id' => $callId,
            'action' => 'created',
        ]);
    }

    public function test_non_approved_quote_cannot_convert_to_service_call(): void
    {
        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'seller_id' => $this->user->id,
            'status' => Quote::STATUS_DRAFT,
        ]);

        $response = $this->postJson("/api/v1/quotes/{$quote->id}/convert-to-chamado");

        $response->assertStatus(422);
        $this->assertDatabaseMissing('service_calls', ['quote_id' => $quote->id]);
    }

    public function test_duplicate_conversion_blocked(): void
    {
        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'seller_id' => $this->user->id,
            'status' => Quote::STATUS_APPROVED,
        ]);

        // First conversion succeeds
        $this->postJson("/api/v1/quotes/{$quote->id}/convert-to-chamado")
            ->assertStatus(201);

        // Reset status for second attempt
        $quote->update(['status' => Quote::STATUS_APPROVED]);

        // Second conversion should be blocked
        $this->postJson("/api/v1/quotes/{$quote->id}/convert-to-chamado")
            ->assertStatus(422);

        // Only one ServiceCall should exist
        $this->assertEquals(1, ServiceCall::where('quote_id', $quote->id)->count());
    }
}
