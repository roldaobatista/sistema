<?php

namespace Tests\Feature;

use App\Models\CentralItem;
use App\Models\CrmDeal;
use App\Models\CrmPipeline;
use App\Models\CrmPipelineStage;
use App\Models\Customer;
use App\Models\TechnicianCashTransaction;
use App\Models\TechnicianCashFund;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class IamDependencyTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $admin;
    private User $targetUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([
            \App\Http\Middleware\EnsureTenantScope::class,
            \App\Http\Middleware\CheckPermission::class,
        ]);

        $this->tenant = Tenant::factory()->create();
        $this->admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        $this->admin->tenants()->attach($this->tenant->id, ['is_default' => true]);

        $this->targetUser = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
        ]);
        $this->targetUser->tenants()->attach($this->tenant->id, ['is_default' => true]);

        app()->instance('current_tenant_id', $this->tenant->id);
        Sanctum::actingAs($this->admin, ['*']);
    }

    public function test_cannot_delete_user_with_work_orders(): void
    {
        WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => Customer::factory()->create(['tenant_id' => $this->tenant->id])->id,
            'assigned_to' => $this->targetUser->id,
        ]);

        $response = $this->deleteJson("/api/v1/users/{$this->targetUser->id}");

        $response->assertStatus(422)
            ->assertJsonFragment(['message' => "Este usuário possui registros vinculados em 'work orders'. Desative-o ao invés de excluir."]);
    }

    public function test_cannot_delete_user_with_central_items(): void
    {
        // Mock CentralItem creation manually if factory is complex
        CentralItem::create([
            'tenant_id' => $this->tenant->id,
            'titulo' => 'Tarefa Teste',
            'responsavel_user_id' => $this->targetUser->id,
            'criado_por_user_id' => $this->admin->id,
            'tipo' => \App\Enums\CentralItemType::TAREFA,
            'origem' => \App\Enums\CentralItemOrigin::MANUAL,
            'status' => \App\Enums\CentralItemStatus::ABERTO,
            'prioridade' => \App\Enums\CentralItemPriority::MEDIA,
            'visibilidade' => \App\Enums\CentralItemVisibility::PRIVADO,
            'ref_tipo' => 'App\Models\User', // Dummy ref
            'ref_id' => $this->admin->id,
        ]);

        $response = $this->deleteJson("/api/v1/users/{$this->targetUser->id}");

        $response->assertStatus(422)
            ->assertJsonFragment(['message' => "Este usuário possui registros vinculados em 'central items'. Desative-o ao invés de excluir."]);
    }

    public function test_cannot_delete_user_with_crm_deals(): void
    {
        $pipeline = CrmPipeline::factory()->create(['tenant_id' => $this->tenant->id]);
        $stage = CrmPipelineStage::factory()->create(['pipeline_id' => $pipeline->id, 'tenant_id' => $this->tenant->id]);
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        CrmDeal::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'pipeline_id' => $pipeline->id,
            'stage_id' => $stage->id,
            'title' => 'Negócio Teste',
            'assigned_to' => $this->targetUser->id,
            'status' => 'open',
        ]);

        $response = $this->deleteJson("/api/v1/users/{$this->targetUser->id}");

        $response->assertStatus(422)
            ->assertJsonFragment(['message' => "Este usuário possui registros vinculados em 'crm deals'. Desative-o ao invés de excluir."]);
    }

    public function test_cannot_delete_user_with_cash_transactions(): void
    {
        $fund = TechnicianCashFund::create([
            'tenant_id' => $this->tenant->id,
             'user_id' => $this->targetUser->id,
             'balance' => 0,
             'status' => 'active'
        ]);

        TechnicianCashTransaction::create([
            'tenant_id' => $this->tenant->id,
            'fund_id' => $fund->id,
            'type' => 'credit',
            'amount' => 100,
            'balance_after' => 100,
            'created_by' => $this->targetUser->id,
            'transaction_date' => now(),
            'description' => 'Teste'
        ]);

        $response = $this->deleteJson("/api/v1/users/{$this->targetUser->id}");

        $response->assertStatus(422)
            ->assertJsonFragment(['message' => "Este usuário possui registros vinculados em 'technician cash transactions'. Desative-o ao invés de excluir."]);
    }

    public function test_can_delete_user_without_dependencies(): void
    {
        $response = $this->deleteJson("/api/v1/users/{$this->targetUser->id}");

        $response->assertStatus(204);
        $this->assertDatabaseMissing('users', ['id' => $this->targetUser->id]);
    }
}
