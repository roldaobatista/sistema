<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use App\Models\Customer;
use App\Models\CommissionRule;
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
            'slug' => 'boas-vindas',
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
        $rule = CommissionRule::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'name' => 'Recurring Rule',
            'type' => CommissionRule::TYPE_PERCENTAGE,
            'value' => 10,
            'applies_to' => CommissionRule::APPLIES_ALL,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'calculation_type' => CommissionRule::CALC_PERCENT_GROSS,
            'applies_when' => CommissionRule::WHEN_OS_COMPLETED,
            'active' => true,
        ]);

        $contractId = DB::table('recurring_contracts')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'created_by' => $this->user->id,
            'name' => 'Contrato Mensal Teste',
            'frequency' => 'monthly',
            'monthly_value' => 500,
            'start_date' => now()->subMonth()->toDateString(),
            'next_run_date' => now()->toDateString(),
            'is_active' => true,
            'generated_count' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->postJson('/api/v1/recurring-commissions', [
            'user_id' => $this->user->id,
            'commission_rule_id' => $rule->id,
            'recurring_contract_id' => $contractId,
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
        $from = now()->startOfMonth()->toDateString();
        $to = now()->endOfMonth()->toDateString();

        $response = $this->getJson("/api/v1/financial/export/csv?type=receivable&from={$from}&to={$to}");
        $response->assertOk();
    }

    public function test_financial_export_ofx(): void
    {
        $from = now()->startOfMonth()->toDateString();
        $to = now()->endOfMonth()->toDateString();

        $response = $this->getJson("/api/v1/financial/export/ofx?type=receivable&from={$from}&to={$to}");
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
