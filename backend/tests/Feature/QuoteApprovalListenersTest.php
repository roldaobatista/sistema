<?php

namespace Tests\Feature;

use App\Events\QuoteApproved;
use App\Listeners\CreateCentralItemOnQuote;
use App\Listeners\HandleQuoteApproval;
use App\Models\CentralItem;
use App\Models\Customer;
use App\Models\Quote;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuoteApprovalListenersTest extends TestCase
{
    use RefreshDatabase;

    public function test_handle_quote_approval_listener_uses_quote_number_and_seller_as_recipient(): void
    {
        $tenant = Tenant::factory()->create();
        app()->instance('current_tenant_id', $tenant->id);

        $seller = User::factory()->create([
            'tenant_id' => $tenant->id,
            'current_tenant_id' => $tenant->id,
        ]);

        $approver = User::factory()->create([
            'tenant_id' => $tenant->id,
            'current_tenant_id' => $tenant->id,
        ]);

        $customer = Customer::factory()->create(['tenant_id' => $tenant->id]);

        $quote = Quote::factory()->create([
            'tenant_id' => $tenant->id,
            'customer_id' => $customer->id,
            'seller_id' => $seller->id,
            'quote_number' => 'ORC-09001',
            'total' => 1250.50,
            'status' => Quote::STATUS_APPROVED,
        ]);

        $listener = app(HandleQuoteApproval::class);
        $listener->handle(new QuoteApproved($quote, $approver));

        $this->assertDatabaseHas('crm_activities', [
            'tenant_id' => $tenant->id,
            'customer_id' => $customer->id,
            'user_id' => $approver->id,
            'type' => Quote::ACTIVITY_TYPE_APPROVED,
            'title' => 'Orcamento #ORC-09001 aprovado',
        ]);

        $this->assertDatabaseHas('notifications', [
            'tenant_id' => $tenant->id,
            'user_id' => $seller->id,
            'type' => Quote::ACTIVITY_TYPE_APPROVED,
            'title' => 'Orcamento Aprovado',
            'message' => 'O orcamento #ORC-09001 foi aprovado.',
        ]);
    }

    public function test_create_central_item_on_quote_listener_uses_quote_number_context_and_seller(): void
    {
        $tenant = Tenant::factory()->create();
        app()->instance('current_tenant_id', $tenant->id);

        $seller = User::factory()->create([
            'tenant_id' => $tenant->id,
            'current_tenant_id' => $tenant->id,
        ]);

        $approver = User::factory()->create([
            'tenant_id' => $tenant->id,
            'current_tenant_id' => $tenant->id,
        ]);

        $customer = Customer::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Cliente Alpha',
        ]);

        $quote = Quote::factory()->create([
            'tenant_id' => $tenant->id,
            'customer_id' => $customer->id,
            'seller_id' => $seller->id,
            'quote_number' => 'ORC-05555',
            'total' => 980,
            'status' => Quote::STATUS_APPROVED,
        ]);

        $listener = app(CreateCentralItemOnQuote::class);
        $listener->handle(new QuoteApproved($quote, $approver));

        $item = CentralItem::query()
            ->where('tenant_id', $tenant->id)
            ->where('ref_id', $quote->id)
            ->first();

        $this->assertNotNull($item);
        $this->assertSame($seller->id, $item->responsavel_user_id);
        $this->assertStringContainsString('ORC-05555', $item->titulo);
        $this->assertSame('ORC-05555', data_get($item->contexto, 'numero'));
    }
}
