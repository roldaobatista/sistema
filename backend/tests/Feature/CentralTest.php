<?php

namespace Tests\Feature;

use App\Enums\CentralItemPriority;
use App\Enums\CentralItemStatus;
use App\Enums\CentralItemType;
use App\Models\CentralItem;
use App\Models\CentralRule;
use App\Models\User;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Laravel\Sanctum\Sanctum;

class CentralTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        // Disable middleware that causes issues in tests
        $this->withoutMiddleware([
            \App\Http\Middleware\EnsureTenantScope::class,
            \App\Http\Middleware\CheckPermission::class,
        ]);

        // Setup Tenant
        $this->tenant = Tenant::factory()->create();
        
        // Setup user
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        // Mock current tenant
        app()->instance('current_tenant_id', $this->tenant->id);

        // Authenticate via Sanctum (for API guard)
        Sanctum::actingAs($this->user, ['*']);

        // Also authenticate via web guard for auth() helper
        $this->actingAs($this->user, 'web');
    }

    public function test_can_list_central_items()
    {
        $response = $this->getJson('/api/v1/central/items');

        $response->assertStatus(200);
    }

    public function test_can_create_central_item()
    {
        $payload = [
            'tipo' => CentralItemType::TAREFA->value,
            'titulo' => 'Test Task',
            'descricao_curta' => 'Short description',
            'prioridade' => CentralItemPriority::ALTA->value,
        ];

        $response = $this->postJson('/api/v1/central/items', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('titulo', 'Test Task');
            
        $this->assertDatabaseHas('central_items', [
            'titulo' => 'Test Task',
            'tenant_id' => $this->tenant->id,
        ]);
    }

    public function test_create_item_for_another_user_sends_notification(): void
    {
        $assignee = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/central/items', [
            'tipo' => CentralItemType::TAREFA->value,
            'titulo' => 'Item para atribuicao',
            'responsavel_user_id' => $assignee->id,
        ]);

        $response->assertCreated();

        $itemId = (int) $response->json('id');

        $this->assertDatabaseHas('notifications', [
            'tenant_id' => $this->tenant->id,
            'user_id' => $assignee->id,
            'type' => 'central_item_assigned',
            'notifiable_type' => CentralItem::class,
            'notifiable_id' => $itemId,
        ]);
    }

    public function test_can_update_central_item()
    {
        $item = CentralItem::create([
            'tenant_id' => $this->tenant->id,
            'criado_por_user_id' => $this->user->id,
            'responsavel_user_id' => $this->user->id,
            'tipo' => CentralItemType::TAREFA,
            'titulo' => 'Old Title',
            'status' => CentralItemStatus::ABERTO,
            'prioridade' => CentralItemPriority::MEDIA,
        ]);

        $payload = ['titulo' => 'New Title', 'prioridade' => CentralItemPriority::URGENTE->value];

        $response = $this->patchJson("/api/v1/central/items/{$item->id}", $payload);

        $response->assertStatus(200)
            ->assertJsonPath('titulo', 'New Title');

        $this->assertDatabaseHas('central_items', ['id' => $item->id, 'prioridade' => CentralItemPriority::URGENTE]);
    }
    
    public function test_can_comment_on_item()
    {
        $item = CentralItem::create([
            'tenant_id' => $this->tenant->id,
            'criado_por_user_id' => $this->user->id,
            'responsavel_user_id' => $this->user->id,
            'tipo' => CentralItemType::TAREFA,
            'titulo' => 'Item for Comment',
            'status' => CentralItemStatus::ABERTO,
        ]);

        $response = $this->postJson("/api/v1/central/items/{$item->id}/comments", [
            'body' => 'This is a comment'
        ]);

        $response->assertStatus(201);
        
        $this->assertDatabaseHas('central_item_comments', [
            'central_item_id' => $item->id,
            'body' => 'This is a comment',
            'user_id' => $this->user->id,
        ]);
    }
    
    public function test_summary_endpoint()
    {
        CentralItem::create([
            'tenant_id' => $this->tenant->id,
            'criado_por_user_id' => $this->user->id,
            'responsavel_user_id' => $this->user->id,
            'tipo' => CentralItemType::TAREFA,
            'titulo' => 'Task 1',
            'status' => CentralItemStatus::ABERTO,
            'due_at' => now()->startOfDay(),
        ]);
        
        $response = $this->getJson('/api/v1/central/summary');

        $response->assertStatus(200)
             ->assertJsonStructure(['hoje', 'atrasadas', 'sem_prazo', 'total_aberto']);
    }

    public function test_dashboard_endpoints(): void
    {
        CentralItem::create([
            'tenant_id' => $this->tenant->id,
            'criado_por_user_id' => $this->user->id,
            'responsavel_user_id' => $this->user->id,
            'tipo' => CentralItemType::OS,
            'titulo' => 'OS atrasada',
            'status' => CentralItemStatus::ABERTO,
            'prioridade' => CentralItemPriority::ALTA,
            'due_at' => now()->subDay(),
        ]);

        $this->getJson('/api/v1/central/kpis')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'total',
                    'abertas',
                    'em_andamento',
                    'concluidas',
                    'atrasadas',
                    'taxa_conclusao',
                    'tempo_medio_horas',
                ],
            ]);

        $this->getJson('/api/v1/central/workload')
            ->assertOk()
            ->assertJsonStructure(['data']);

        $this->postJson('/api/v1/central/items', [
            'tipo' => CentralItemType::TAREFA->value,
            'titulo' => 'Urgente para workload',
            'prioridade' => CentralItemPriority::URGENTE->value,
            'responsavel_user_id' => $this->user->id,
        ])->assertCreated();

        $this->getJson('/api/v1/central/workload')
            ->assertOk()
            ->assertJsonFragment(['urgentes' => 1]);

        $this->getJson('/api/v1/central/overdue-by-team')
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_assign_endpoint_sends_notification_to_new_assignee(): void
    {
        $newAssignee = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $item = CentralItem::create([
            'tenant_id' => $this->tenant->id,
            'criado_por_user_id' => $this->user->id,
            'responsavel_user_id' => $this->user->id,
            'tipo' => CentralItemType::TAREFA,
            'titulo' => 'Item para reatribuicao',
            'status' => CentralItemStatus::ABERTO,
        ]);

        $this->postJson("/api/v1/central/items/{$item->id}/assign", [
            'user_id' => $newAssignee->id,
        ])->assertOk();

        $this->assertDatabaseHas('notifications', [
            'tenant_id' => $this->tenant->id,
            'user_id' => $newAssignee->id,
            'type' => 'central_item_assigned',
            'notifiable_type' => CentralItem::class,
            'notifiable_id' => $item->id,
        ]);

        $this->assertDatabaseHas('central_item_history', [
            'central_item_id' => $item->id,
            'action' => 'assigned',
            'to_value' => (string) $newAssignee->id,
        ]);
    }

    public function test_can_manage_central_rules(): void
    {
        $createResponse = $this->postJson('/api/v1/central/rules', [
            'nome' => 'Priorizar OS urgentes',
            'descricao' => 'Regra MVP',
            'ativo' => true,
            'tipo_item' => 'os',
            'prioridade_minima' => 'alta',
            'acao_tipo' => 'set_priority',
            'acao_config' => ['prioridade' => 'urgente'],
        ]);

        $createResponse->assertCreated()
            ->assertJsonPath('nome', 'Priorizar OS urgentes')
            ->assertJsonPath('tipo_item', 'OS')
            ->assertJsonPath('prioridade_minima', 'ALTA');

        $ruleId = (int) $createResponse->json('id');

        $this->assertDatabaseHas('central_rules', [
            'id' => $ruleId,
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'tipo_item' => 'OS',
            'prioridade_minima' => 'ALTA',
        ]);

        $this->getJson('/api/v1/central/rules')
            ->assertOk()
            ->assertJsonPath('data.0.id', $ruleId);

        $this->patchJson("/api/v1/central/rules/{$ruleId}", [
            'nome' => 'Priorizar OS críticas',
            'ativo' => false,
        ])->assertOk()
            ->assertJsonPath('nome', 'Priorizar OS críticas')
            ->assertJsonPath('ativo', false);

        $this->deleteJson("/api/v1/central/rules/{$ruleId}")
            ->assertNoContent();

        $this->assertDatabaseMissing('central_rules', ['id' => $ruleId]);
    }

    public function test_rule_is_applied_on_item_creation(): void
    {
        CentralRule::create([
            'tenant_id' => $this->tenant->id,
            'nome' => 'Elevar prioridade de tarefas',
            'ativo' => true,
            'tipo_item' => CentralItemType::TAREFA->value,
            'prioridade_minima' => CentralItemPriority::BAIXA->value,
            'acao_tipo' => 'set_priority',
            'acao_config' => ['prioridade' => 'URGENTE'],
            'created_by' => $this->user->id,
        ]);

        $response = $this->postJson('/api/v1/central/items', [
            'tipo' => CentralItemType::TAREFA->value,
            'titulo' => 'Item com automação',
            'prioridade' => CentralItemPriority::BAIXA->value,
        ]);

        $response->assertCreated()
            ->assertJsonPath('prioridade', CentralItemPriority::URGENTE->value);
    }
}
