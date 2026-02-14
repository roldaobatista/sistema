<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use App\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * CRM Messages (templates, send) + Recurring Commissions (CRUD, process monthly)
 * + Financial Export (OFX/CSV) + Payments (list, summary).
 */
class CrmMessageFinancialExportTest extends TestCase
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
        ]);
        $this->user->tenants()->attach($this->tenant->id, ['is_default' => true]);
        $this->customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
    }

    // ── CRM MESSAGES ──

    public function test_list_crm_messages(): void
    {
        $response = $this->getJson('/api/v1/crm/messages');
        $response->assertOk();
    }

    public function test_list_message_templates(): void
    {
        $response = $this->getJson('/api/v1/crm/message-templates');
        $response->assertOk();
    }

    public function test_create_message_template(): void
    {
        $response = $this->postJson('/api/v1/crm/message-templates', [
            'name' => 'Boas-vindas',
            'subject' => 'Bem-vindo à nossa empresa',
            'body' => 'Olá {{nome}}, agradecemos pela preferência.',
            'channel' => 'email',
        ]);
        $response->assertCreated();
    }

    public function test_send_message_requires_recipient(): void
    {
        $response = $this->postJson('/api/v1/crm/messages/send', [
            'channel' => 'email',
            'body' => 'Mensagem de teste',
        ]);
        $response->assertStatus(422);
    }

    // ── RECURRING COMMISSIONS ──

    public function test_list_recurring_commissions(): void
    {
        $response = $this->getJson('/api/v1/recurring-commissions');
        $response->assertOk();
    }

    public function test_create_recurring_commission(): void
    {
        $response = $this->postJson('/api/v1/recurring-commissions', [
            'user_id' => $this->user->id,
            'amount' => 500.00,
            'frequency' => 'monthly',
            'description' => 'Comissão fixa mensal',
        ]);
        $response->assertCreated();
    }

    public function test_process_monthly_recurring(): void
    {
        $response = $this->postJson('/api/v1/recurring-commissions/process-monthly');
        $response->assertOk();
    }

    // ── FINANCIAL EXPORT ──

    public function test_financial_export_csv(): void
    {
        $response = $this->getJson('/api/v1/financial/export/csv?type=receivable');
        $response->assertOk();
    }

    public function test_financial_export_ofx(): void
    {
        $response = $this->getJson('/api/v1/financial/export/ofx?type=receivable');
        $response->assertOk();
    }

    // ── PAYMENTS ──

    public function test_list_payments(): void
    {
        $response = $this->getJson('/api/v1/payments');
        $response->assertOk();
    }

    public function test_payments_summary(): void
    {
        $response = $this->getJson('/api/v1/payments-summary');
        $response->assertOk();
    }
}
