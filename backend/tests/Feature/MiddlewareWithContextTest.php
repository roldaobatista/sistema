<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Middleware Full Coverage Test — validates that ALL major endpoints
 * correctly enforce permission middleware in production conditions.
 *
 * Unlike most tests that use withoutMiddleware(), these run WITH real
 * middleware to guarantee security is actually enforced.
 */
class MiddlewareWithContextTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $userWithoutPerms;
    private User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();

        // User without any permissions — should be blocked everywhere
        $this->userWithoutPerms = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);
        $this->userWithoutPerms->tenants()->attach($this->tenant->id, ['is_default' => true]);

        // Super admin with all permissions
        $this->superAdmin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);
        $this->superAdmin->tenants()->attach($this->tenant->id, ['is_default' => true]);

        app()->instance('current_tenant_id', $this->tenant->id);
        setPermissionsTeamId($this->tenant->id);
    }

    /**
     * Helper: grant specific permissions to the user without permissions.
     */
    private function grant(string ...$permissionNames): void
    {
        foreach ($permissionNames as $name) {
            $perm = Permission::firstOrCreate(
                ['name' => $name, 'guard_name' => 'web']
            );
        }
        $this->userWithoutPerms->givePermissionTo($permissionNames);
        $this->userWithoutPerms->unsetRelation('permissions');
        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /**
     * Helper: act as the user without permissions.
     */
    private function actAsRestricted(): self
    {
        Sanctum::actingAs($this->userWithoutPerms, ['*']);
        return $this;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CUSTOMERS MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_customers_list_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/customers')->assertForbidden();

        $this->grant('cadastros.customer.view');
        $this->getJson('/api/v1/customers')->assertOk();
    }

    public function test_customers_create_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->postJson('/api/v1/customers', ['name' => 'Test'])->assertForbidden();

        $this->grant('cadastros.customer.create');
        $this->postJson('/api/v1/customers', [
            'name' => 'Test', 'type' => 'PF',
        ])->assertStatus(201);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  PRODUCTS MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_products_list_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/products')->assertForbidden();

        $this->grant('cadastros.product.view');
        $this->getJson('/api/v1/products')->assertOk();
    }

    public function test_products_create_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->postJson('/api/v1/products', ['name' => 'Test'])->assertForbidden();

        $this->grant('cadastros.product.create');
        // Will get 422 if validation fails but NOT 403
        $this->postJson('/api/v1/products', ['name' => 'Test Product'])
            ->assertStatus(fn ($s) => $s !== 403);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  SERVICES MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_services_list_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/services')->assertForbidden();

        $this->grant('cadastros.service.view');
        $this->getJson('/api/v1/services')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  SUPPLIERS MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_suppliers_list_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/suppliers')->assertForbidden();

        $this->grant('cadastros.supplier.view');
        $this->getJson('/api/v1/suppliers')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  EQUIPMENTS MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_equipments_list_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/equipments')->assertForbidden();

        $this->grant('equipments.equipment.view');
        $this->getJson('/api/v1/equipments')->assertOk();
    }

    public function test_equipments_create_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->postJson('/api/v1/equipments', ['name' => 'Balança'])->assertForbidden();

        $this->grant('equipments.equipment.create');
        $this->postJson('/api/v1/equipments', ['name' => 'Balança'])
            ->assertStatus(fn ($s) => $s !== 403);
    }

    public function test_equipments_dashboard_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/equipments-dashboard')->assertForbidden();

        $this->grant('equipments.equipment.view');
        $this->getJson('/api/v1/equipments-dashboard')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  STANDARD WEIGHTS MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_standard_weights_list_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/standard-weights')->assertForbidden();

        $this->grant('equipments.standard_weight.view');
        $this->getJson('/api/v1/standard-weights')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  WORK ORDERS MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_work_orders_list_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/work-orders')->assertForbidden();

        $this->grant('os.work_order.view');
        $this->getJson('/api/v1/work-orders')->assertOk();
    }

    public function test_work_orders_create_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->postJson('/api/v1/work-orders', ['description' => 'OS Teste'])->assertForbidden();

        $this->grant('os.work_order.create');
        $this->postJson('/api/v1/work-orders', ['description' => 'OS Teste'])
            ->assertStatus(fn ($s) => $s !== 403);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  QUOTES MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_quotes_list_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/quotes')->assertForbidden();

        $this->grant('quotes.quote.view');
        $this->getJson('/api/v1/quotes')->assertOk();
    }

    public function test_quotes_create_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->postJson('/api/v1/quotes', ['title' => 'Quote'])->assertForbidden();

        $this->grant('quotes.quote.create');
        $this->postJson('/api/v1/quotes', ['title' => 'Quote'])
            ->assertStatus(fn ($s) => $s !== 403);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  SERVICE CALLS MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_service_calls_list_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/service-calls')->assertForbidden();

        $this->grant('service_calls.service_call.view');
        $this->getJson('/api/v1/service-calls')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CRM MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_crm_deals_list_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/crm/deals')->assertForbidden();

        $this->grant('crm.deal.view');
        $this->getJson('/api/v1/crm/deals')->assertOk();
    }

    public function test_crm_pipelines_list_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/crm/pipelines')->assertForbidden();

        $this->grant('crm.pipeline.view');
        $this->getJson('/api/v1/crm/pipelines')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  INMETRO MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_inmetro_dashboard_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/inmetro/dashboard')->assertForbidden();

        $this->grant('inmetro.intelligence.view');
        $this->getJson('/api/v1/inmetro/dashboard')
            ->assertStatus(fn ($s) => $s !== 403);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  IMPORT MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_import_history_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/import/history')->assertForbidden();

        $this->grant('import.data.view');
        $this->getJson('/api/v1/import/history')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  STOCK MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_stock_movements_list_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/stock/movements')->assertForbidden();

        $this->grant('estoque.movement.view');
        $this->getJson('/api/v1/stock/movements')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  REPORTS MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_report_work_orders_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/reports/work-orders')->assertForbidden();

        $this->grant('reports.os_report.view');
        $this->getJson('/api/v1/reports/work-orders')->assertOk();
    }

    public function test_report_financial_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/reports/financial')->assertForbidden();

        $this->grant('reports.financial_report.view');
        $this->getJson('/api/v1/reports/financial')->assertOk();
    }

    public function test_report_productivity_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/reports/productivity')->assertForbidden();

        $this->grant('reports.productivity_report.view');
        $this->getJson('/api/v1/reports/productivity')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  SETTINGS MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_settings_view_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/settings')->assertForbidden();

        $this->grant('platform.settings.view');
        $this->getJson('/api/v1/settings')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  BRANCHES MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_branches_list_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/branches')->assertForbidden();

        $this->grant('platform.branch.view');
        $this->getJson('/api/v1/branches')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TENANTS MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_tenants_list_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/tenants')->assertForbidden();

        $this->grant('platform.tenant.view');
        $this->getJson('/api/v1/tenants')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  EXPENSES MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_expenses_list_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/expenses')->assertForbidden();

        $this->grant('expenses.expense.view');
        $this->getJson('/api/v1/expenses')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  COMMISSIONS MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_commission_rules_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/commission-rules')->assertForbidden();

        $this->grant('commissions.rule.view');
        $this->getJson('/api/v1/commission-rules')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CENTRAL MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_central_items_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/central/items')->assertForbidden();

        $this->grant('central.item.view');
        $this->getJson('/api/v1/central/items')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  FISCAL MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_fiscal_notas_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/fiscal/notas')->assertForbidden();

        $this->grant('fiscal.note.view');
        $this->getJson('/api/v1/fiscal/notas')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  NOTIFICATIONS MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_notifications_list_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/notifications')->assertForbidden();

        $this->grant('notifications.notification.view');
        $this->getJson('/api/v1/notifications')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  DASHBOARD MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_dashboard_stats_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/dashboard-stats')->assertForbidden();

        $this->grant('platform.dashboard.view');
        $this->getJson('/api/v1/dashboard-stats')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CASH FLOW / DRE MODULE
    // ═══════════════════════════════════════════════════════════════════

    public function test_cash_flow_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/cash-flow')->assertForbidden();

        $this->grant('finance.cashflow.view');
        $this->getJson('/api/v1/cash-flow')->assertOk();
    }

    public function test_dre_requires_permission(): void
    {
        $this->actAsRestricted();
        $this->getJson('/api/v1/dre')->assertForbidden();

        $this->grant('finance.dre.view');
        $this->getJson('/api/v1/dre')->assertOk();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CROSS-TENANT ISOLATION
    // ═══════════════════════════════════════════════════════════════════

    public function test_user_cannot_access_other_tenant_data(): void
    {
        $otherTenant = Tenant::factory()->create();
        $otherUser = User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'current_tenant_id' => $otherTenant->id,
            'is_active' => true,
        ]);
        $otherUser->tenants()->attach($otherTenant->id, ['is_default' => true]);

        setPermissionsTeamId($otherTenant->id);
        $perm = Permission::firstOrCreate(['name' => 'cadastros.customer.view', 'guard_name' => 'web']);
        $otherUser->givePermissionTo($perm);
        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();

        Sanctum::actingAs($otherUser, ['*']);
        app()->instance('current_tenant_id', $otherTenant->id);

        // Create customer in original tenant
        $customer = \App\Models\Customer::withoutGlobalScopes()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Secret Customer',
            'type' => 'PF',
        ]);

        // Other tenant user should NOT see it
        $response = $this->getJson('/api/v1/customers');
        $response->assertOk();
        $response->assertJsonMissing(['name' => 'Secret Customer']);
    }
}
