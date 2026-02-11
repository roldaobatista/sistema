<?php

namespace Tests\Feature;

use App\Mail\QuoteReadyMail;
use App\Models\Customer;
use App\Models\Quote;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuoteReadyMailTest extends TestCase
{
    use RefreshDatabase;

    public function test_quote_ready_mail_uses_quote_number(): void
    {
        $tenant = Tenant::factory()->create();
        $customer = Customer::factory()->create(['tenant_id' => $tenant->id]);
        $seller = User::factory()->create([
            'tenant_id' => $tenant->id,
            'current_tenant_id' => $tenant->id,
        ]);

        $quote = Quote::factory()->create([
            'tenant_id' => $tenant->id,
            'customer_id' => $customer->id,
            'seller_id' => $seller->id,
            'quote_number' => 'ORC-09991',
        ]);

        $mail = new QuoteReadyMail($quote);

        $this->assertStringContainsString('ORC-09991', $mail->envelope()->subject);

        $html = $mail->render();
        $this->assertStringContainsString('ORC-09991', $html);
    }
}
