<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CentralItem;
use App\Models\CentralRule;
use App\Services\CentralAutomationService;
use App\Services\CentralService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class CentralController extends Controller
{
    public function __construct(
        protected CentralService $service,
        protected CentralAutomationService $automationService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $items = $this->service->listar(
            $request->all(),
            $request->get('per_page', 20)
        );

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        try {
            $tipos = array_map(fn ($c) => $c->value, \App\Enums\CentralItemType::cases());
            $prioridades = array_map(fn ($c) => $c->value, \App\Enums\CentralItemPriority::cases());
            $validated = $request->validate([
                'tipo' => ['required', 'string', Rule::in(array_merge($tipos, array_map('strtolower', $tipos)))],
                'titulo' => 'required|string|max:255',
                'descricao_curta' => 'nullable|string|max:255',
                'responsavel_user_id' => 'nullable|exists:users,id',
                'prioridade' => ['nullable', 'string', Rule::in(array_merge($prioridades, array_map('strtolower', $prioridades)))],
                'visibilidade' => ['nullable', 'string', Rule::in(['PRIVADO', 'EQUIPE', 'EMPRESA', 'privado', 'equipe', 'empresa'])],
                'due_at' => 'nullable|date',
                'remind_at' => 'nullable|date',
                'contexto' => 'nullable|array',
                'tags' => 'nullable|array',
            ]);

            $item = DB::transaction(fn () => $this->service->criar($validated));

            return response()->json($item, 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Dados invalidos', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('Central store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar item'], 500);
        }
    }

    public function show(CentralItem $centralItem): JsonResponse
    {
        if (!$this->service->usuarioPodeAcessarItem($centralItem)) {
            return response()->json(['message' => 'Acesso negado a este item.'], 403);
        }

        return response()->json($centralItem->load(['comments.user', 'history.user', 'source']));
    }

    public function update(Request $request, CentralItem $centralItem): JsonResponse
    {
        if (!$this->service->usuarioPodeAcessarItem($centralItem)) {
            return response()->json(['message' => 'Acesso negado a este item.'], 403);
        }

        $statuses = array_map(fn ($c) => $c->value, \App\Enums\CentralItemStatus::cases());
        $prioridades = array_map(fn ($c) => $c->value, \App\Enums\CentralItemPriority::cases());
        $validated = $request->validate([
            'titulo' => 'sometimes|string|max:255',
            'descricao_curta' => 'nullable|string|max:255',
            'status' => ['sometimes', 'string', Rule::in(array_merge($statuses, array_map('strtolower', $statuses)))],
            'prioridade' => ['sometimes', 'string', Rule::in(array_merge($prioridades, array_map('strtolower', $prioridades)))],
            'responsavel_user_id' => 'sometimes|exists:users,id',
            'due_at' => 'nullable|date',
            'remind_at' => 'nullable|date',
            'snooze_until' => 'nullable|date',
            'tags' => 'nullable|array',
        ]);

        try {
            $updated = $this->service->atualizar($centralItem, $validated);
            return response()->json($updated);
        } catch (\Throwable $e) {
            Log::error('Central update failed', ['id' => $centralItem->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar item'], 500);
        }
    }

    public function comment(Request $request, CentralItem $centralItem): JsonResponse
    {
        if (!$this->service->usuarioPodeAcessarItem($centralItem)) {
            return response()->json(['message' => 'Acesso negado a este item.'], 403);
        }

        $request->validate(['body' => 'required|string|max:2000']);
        
        $comment = $this->service->comentar($centralItem, $request->input('body'), auth()->id());
        
        return response()->json($comment->load('user'), 201);
    }

    public function assign(Request $request, CentralItem $centralItem): JsonResponse
    {
        if (!$this->service->usuarioPodeAcessarItem($centralItem)) {
            return response()->json(['message' => 'Acesso negado a este item.'], 403);
        }

        $tenantId = $this->currentTenantId($request);

        $validated = $request->validate([
            'user_id' => [
                'nullable',
                Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId)),
            ],
            'responsavel_user_id' => [
                'nullable',
                Rule::exists('users', 'id')->where(fn ($q) => $q->where('tenant_id', $tenantId)),
            ],
        ]);

        $assigneeId = $validated['user_id'] ?? $validated['responsavel_user_id'] ?? null;
        if (!$assigneeId) {
            return response()->json(['message' => 'user_id ou responsavel_user_id e obrigatorio'], 422);
        }

        $updated = $this->service->atualizar($centralItem, ['responsavel_user_id' => $assigneeId]);
        
        return response()->json($updated);
    }

    public function constants(): JsonResponse
    {
        return response()->json([
            'types' => array_column(\App\Enums\CentralItemType::cases(), 'value'),
            'statuses' => array_column(\App\Enums\CentralItemStatus::cases(), 'value'),
            'priorities' => array_column(\App\Enums\CentralItemPriority::cases(), 'value'),
            'origins' => array_column(\App\Enums\CentralItemOrigin::cases(), 'value'),
            'visibilities' => array_column(\App\Enums\CentralItemVisibility::cases(), 'value'),
        ]);
    }

    public function summary(): JsonResponse
    {
        return response()->json($this->service->resumo());
    }

    public function kpis(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->automationService->kpis($this->currentTenantId($request)),
        ]);
    }

    public function workload(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->automationService->workload($this->currentTenantId($request)),
        ]);
    }

    public function overdueByTeam(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->automationService->overdueByTeam($this->currentTenantId($request)),
        ]);
    }

    public function rules(Request $request): JsonResponse
    {
        $rules = CentralRule::query()
            ->with(['responsavel:id,name'])
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 50));

        return response()->json($rules);
    }

    public function storeRule(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate($this->ruleValidationRules($request));
            $validated = $this->normalizeRulePayload($validated);

            /** @var \App\Models\User $user */
            $user = $request->user();
            $validated['tenant_id'] = $this->currentTenantId($request);
            $validated['created_by'] = $user->id;

            $rule = DB::transaction(fn () => CentralRule::create($validated));

            return response()->json($rule->load('responsavel:id,name'), 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Dados invalidos', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('Central storeRule failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar regra'], 500);
        }
    }

    public function updateRule(Request $request, CentralRule $centralRule): JsonResponse
    {
        $validated = $request->validate($this->ruleValidationRules($request, true));
        $validated = $this->normalizeRulePayload($validated);

        $centralRule->update($validated);

        return response()->json($centralRule->fresh()->load('responsavel:id,name'));
    }

    public function destroyRule(CentralRule $centralRule): JsonResponse
    {
        $centralRule->delete();

        return response()->json(null, 204);
    }

    private function ruleValidationRules(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';
        $tenantId = $this->currentTenantId($request);

        return [
            'nome' => [$required, 'string', 'max:100'],
            'descricao' => ['nullable', 'string', 'max:500'],
            'ativo' => ['sometimes', 'boolean'],
            'evento_trigger' => ['nullable', 'string', 'max:120'],
            'tipo_item' => [
                'nullable',
                'string',
                Rule::in([
                    'CHAMADO', 'OS', 'FINANCEIRO', 'ORCAMENTO', 'TAREFA', 'LEMBRETE', 'CALIBRACAO', 'CONTRATO', 'OUTRO',
                    'chamado', 'os', 'financeiro', 'orcamento', 'tarefa', 'lembrete', 'calibracao', 'contrato', 'outro',
                ]),
            ],
            'status_trigger' => ['nullable', 'string', 'max:50'],
            'prioridade_minima' => [
                'nullable',
                'string',
                Rule::in(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE', 'baixa', 'media', 'alta', 'urgente']),
            ],
            'acao_tipo' => [$required, 'string', Rule::in(['auto_assign', 'set_priority', 'set_due', 'notify'])],
            'acao_config' => ['nullable', 'array'],
            'responsavel_user_id' => [
                'nullable',
                Rule::exists('users', 'id')->where(
                    fn ($q) => $q->where('tenant_id', $tenantId)
                ),
            ],
            'role_alvo' => ['nullable', 'string', 'max:100'],
        ];
    }

    private function normalizeRulePayload(array $payload): array
    {
        if (array_key_exists('tipo_item', $payload) && $payload['tipo_item'] !== null) {
            $payload['tipo_item'] = strtoupper((string) $payload['tipo_item']);
        }

        if (array_key_exists('prioridade_minima', $payload) && $payload['prioridade_minima'] !== null) {
            $payload['prioridade_minima'] = strtoupper((string) $payload['prioridade_minima']);
        }

        if (array_key_exists('responsavel_user_id', $payload) && $payload['responsavel_user_id'] === '') {
            $payload['responsavel_user_id'] = null;
        }

        return $payload;
    }

    private function currentTenantId(Request $request): int
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        return app()->bound('current_tenant_id')
            ? (int) app('current_tenant_id')
            : (int) ($user->current_tenant_id ?? $user->tenant_id);
    }
}
