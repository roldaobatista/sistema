<?php

namespace Tests\Feature\Console;

use App\Models\Quote;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckExpiredQuotesTest extends TestCase
{
    use RefreshDatabase;

    public function test_check_expired_quotes_command_updates_status_and_logs_audit(): void
    {
        $tenant = Tenant::factory()->create();
        $customer = Customer::factory()->create(['tenant_id' => $tenant->id]);
        $seller = User::factory()->create(['tenant_id' => $tenant->id]);

        // Quote that should expire
        $expiredQuote = Quote::factory()->create([
            'tenant_id' => $tenant->id,
            'customer_id' => $customer->id,
            'seller_id' => $seller->id,
            'status' => Quote::STATUS_SENT,
            'valid_until' => now()->subDay(),
            'quote_number' => 'ORC-EXP-001',
        ]);

        // Quote that should NOT expire (valid future date)
        $validQuote = Quote::factory()->create([
            'tenant_id' => $tenant->id,
            'customer_id' => $customer->id,
            'seller_id' => $seller->id,
            'status' => Quote::STATUS_SENT,
            'valid_until' => now()->addDay(),
            'quote_number' => 'ORC-VAL-001',
        ]);

        // Quote that should NOT expire (already approved)
        $approvedQuote = Quote::factory()->create([
            'tenant_id' => $tenant->id,
            'customer_id' => $customer->id,
            'seller_id' => $seller->id,
            'status' => Quote::STATUS_APPROVED,
            'valid_until' => now()->subDay(),
            'quote_number' => 'ORC-APP-001',
        ]);

        $this->artisan('quotes:check-expired')
            ->expectsOutput('Marked 1 quote(s) as expired.')
            ->assertExitCode(0);

        $this->assertEquals(Quote::STATUS_EXPIRED, $expiredQuote->fresh()->status);
        $this->assertEquals(Quote::STATUS_SENT, $validQuote->fresh()->status);
        $this->assertEquals(Quote::STATUS_APPROVED, $approvedQuote->fresh()->status);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'auditable_type' => Quote::class,
            'auditable_id' => $expiredQuote->id,
            'action' => 'status_changed',
            'description' => 'Orçamento ORC-EXP-001 expirado automaticamente',
        ]);
    }
}
