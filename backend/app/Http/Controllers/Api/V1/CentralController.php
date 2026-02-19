<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CentralAttachment;
use App\Models\CentralItem;
use App\Models\CentralRule;
use App\Models\CentralSubtask;
use App\Models\CentralTimeEntry;
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

        return response()->json($centralItem->load(['comments.user', 'history.user', 'source', 'subtasks', 'attachments.uploader:id,name', 'timeEntries.user:id,name', 'dependsOn:id,titulo,status']));
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
        try {
            $centralRule->delete();
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('Central destroyRule failed', ['rule_id' => $centralRule->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao excluir regra'], 500);
        }
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

    public function bulkUpdate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1|max:100',
            'ids.*' => 'integer',
            'action' => 'required|string|in:complete,cancel,set_status,set_priority,assign',
            'value' => 'nullable|string',
        ]);

        $tenantId = $this->currentTenantId($request);
        $ids = $validated['ids'];
        $action = $validated['action'];
        $value = $validated['value'] ?? null;

        try {
            $updated = DB::transaction(function () use ($ids, $action, $value, $tenantId) {
                $items = CentralItem::whereIn('id', $ids)
                    ->where('tenant_id', $tenantId)
                    ->get();

                /** @var int|null $userId */
                $userId = auth()->user()?->getAuthIdentifier();

                /** @var CentralItem $item */
                foreach ($items as $item) {
                    $changes = match ($action) {
                        'complete' => ['status' => 'concluido', 'completed_at' => now(), 'closed_by' => $userId],
                        'cancel' => ['status' => 'cancelado', 'closed_by' => $userId],
                        'set_status' => ['status' => $value],
                        'set_priority' => ['prioridade' => $value],
                        'assign' => ['responsavel_user_id' => $value ? (int) $value : null],
                        default => [],
                    };

                    if (!empty($changes)) {
                        $this->service->atualizar($item, $changes);
                    }
                }

                return $items->count();
            });

            return response()->json(['message' => "{$updated} itens atualizados"]);
        } catch (\Throwable $e) {
            Log::error('Central bulkUpdate failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar itens em massa'], 500);
        }
    }

    public function export(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $items = $this->service->listar($request->all(), 500);
        $data = $items instanceof \Illuminate\Pagination\LengthAwarePaginator ? $items->items() : $items;

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename=central_items_' . date('Y-m-d') . '.csv',
        ];

        return response()->stream(function () use ($data) {
            $handle = fopen('php://output', 'w');
            fprintf($handle, chr(0xEF) . chr(0xBB) . chr(0xBF));
            fputcsv($handle, ['ID', 'Tipo', 'Título', 'Status', 'Prioridade', 'Responsável', 'Prazo', 'Criado em', 'Tags'], ';');

            foreach ($data as $item) {
                fputcsv($handle, [
                    $item->id ?? $item['id'] ?? '',
                    $item->tipo ?? $item['tipo'] ?? '',
                    $item->titulo ?? $item['titulo'] ?? '',
                    $item->status ?? $item['status'] ?? '',
                    $item->prioridade ?? $item['prioridade'] ?? '',
                    is_array($item) ? ($item['responsavel']['name'] ?? '') : ($item->responsavel?->name ?? ''),
                    $item->due_at ?? $item['due_at'] ?? '',
                    $item->created_at ?? $item['created_at'] ?? '',
                    is_array($item) ? implode(', ', $item['tags'] ?? []) : implode(', ', $item->tags ?? []),
                ], ';');
            }

            fclose($handle);
        }, 200, $headers);
    }

    private function currentTenantId(Request $request): int
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        return app()->bound('current_tenant_id')
            ? (int) app('current_tenant_id')
            : (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    // ── Subtasks CRUD ──

    public function subtasks(CentralItem $centralItem): JsonResponse
    {
        return response()->json($centralItem->subtasks);
    }

    public function storeSubtask(Request $request, CentralItem $centralItem): JsonResponse
    {
        $validated = $request->validate([
            'titulo' => 'required|string|max:255',
            'ordem' => 'nullable|integer|min:0',
        ]);

        $maxOrdem = $centralItem->subtasks()->max('ordem') ?? -1;

        $subtask = $centralItem->subtasks()->create([
            'tenant_id' => $this->currentTenantId($request),
            'titulo' => $validated['titulo'],
            'ordem' => $validated['ordem'] ?? ($maxOrdem + 1),
        ]);

        return response()->json($subtask, 201);
    }

    public function updateSubtask(Request $request, CentralItem $centralItem, CentralSubtask $subtask): JsonResponse
    {
        $validated = $request->validate([
            'titulo' => 'sometimes|string|max:255',
            'concluido' => 'sometimes|boolean',
            'ordem' => 'sometimes|integer|min:0',
        ]);

        if (isset($validated['concluido']) && $validated['concluido'] && !$subtask->concluido) {
            $validated['completed_by'] = $request->user()?->getAuthIdentifier();
            $validated['completed_at'] = now();
        } elseif (isset($validated['concluido']) && !$validated['concluido']) {
            $validated['completed_by'] = null;
            $validated['completed_at'] = null;
        }

        $subtask->update($validated);

        return response()->json($subtask->fresh());
    }

    public function destroySubtask(CentralItem $centralItem, CentralSubtask $subtask): JsonResponse
    {
        $subtask->delete();
        return response()->json(null, 204);
    }

    // ── Attachments CRUD ──

    public function attachments(CentralItem $centralItem): JsonResponse
    {
        return response()->json($centralItem->attachments()->with('uploader:id,name')->get());
    }

    public function storeAttachment(Request $request, CentralItem $centralItem): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|max:10240',
        ]);

        $file = $request->file('file');
        $path = $file->store('central-attachments/' . $centralItem->id, 'public');

        $attachment = $centralItem->attachments()->create([
            'tenant_id' => $this->currentTenantId($request),
            'nome' => $file->getClientOriginalName(),
            'path' => $path,
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'uploaded_by' => $request->user()?->getAuthIdentifier(),
        ]);

        return response()->json($attachment->load('uploader:id,name'), 201);
    }

    public function destroyAttachment(CentralItem $centralItem, CentralAttachment $attachment): JsonResponse
    {
        \Illuminate\Support\Facades\Storage::disk('public')->delete($attachment->path);
        $attachment->delete();
        return response()->json(null, 204);
    }

    // ── Timer / Time Entries ──

    public function timeEntries(CentralItem $centralItem): JsonResponse
    {
        return response()->json(
            $centralItem->timeEntries()->with('user:id,name')->orderByDesc('started_at')->get()
        );
    }

    public function startTimer(Request $request, CentralItem $centralItem): JsonResponse
    {
        /** @var int $userId */
        $userId = $request->user()?->getAuthIdentifier();

        // Stop any running timer for this user on this item
        $running = $centralItem->timeEntries()
            ->where('user_id', $userId)
            ->whereNull('stopped_at')
            ->first();

        if ($running) {
            return response()->json(['message' => 'Já existe um timer ativo neste item.'], 409);
        }

        $entry = $centralItem->timeEntries()->create([
            'tenant_id' => $this->currentTenantId($request),
            'user_id' => $userId,
            'started_at' => now(),
        ]);

        return response()->json($entry->load('user:id,name'), 201);
    }

    public function stopTimer(Request $request, CentralItem $centralItem): JsonResponse
    {
        /** @var int $userId */
        $userId = $request->user()?->getAuthIdentifier();

        $entry = $centralItem->timeEntries()
            ->where('user_id', $userId)
            ->whereNull('stopped_at')
            ->first();

        if (!$entry) {
            return response()->json(['message' => 'Nenhum timer ativo encontrado.'], 404);
        }

        $entry->update([
            'stopped_at' => now(),
            'duration_seconds' => now()->diffInSeconds($entry->started_at),
            'descricao' => $request->input('descricao'),
        ]);

        return response()->json($entry->fresh()->load('user:id,name'));
    }

    // ── Dependencies ──

    public function addDependency(Request $request, CentralItem $centralItem): JsonResponse
    {
        $request->validate(['depends_on_id' => 'required|exists:central_items,id']);
        $centralItem->dependsOn()->syncWithoutDetaching([$request->input('depends_on_id')]);
        return response()->json($centralItem->dependsOn()->select('central_items.id', 'titulo', 'status')->get());
    }

    public function removeDependency(CentralItem $centralItem, int $dependsOnId): JsonResponse
    {
        $centralItem->dependsOn()->detach($dependsOnId);
        return response()->json(null, 204);
    }

    // ── iCal Feed ──

    public function icalFeed(Request $request): \Illuminate\Http\Response
    {
        $tenantId = $this->currentTenantId($request);
        /** @var int $userId */
        $userId = $request->user()?->getAuthIdentifier();

        $items = CentralItem::where('tenant_id', $tenantId)
            ->where('responsavel_user_id', $userId)
            ->whereNotIn('status', ['concluido', 'cancelado'])
            ->whereNotNull('due_at')
            ->get();

        $lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kalibrium//Central//PT"];
        foreach ($items as $item) {
            $uid = "central-{$item->id}@kalibrium";
            $dtStart = $item->due_at->format('Ymd\THis\Z');
            $lines[] = "BEGIN:VEVENT";
            $lines[] = "UID:{$uid}";
            $lines[] = "DTSTART:{$dtStart}";
            $lines[] = "SUMMARY:" . str_replace(["\r", "\n"], ' ', $item->titulo);
            $lines[] = "DESCRIPTION:" . str_replace(["\r", "\n"], ' ', $item->descricao_curta ?? '');
            $lines[] = "END:VEVENT";
        }
        $lines[] = "END:VCALENDAR";

        return response(implode("\r\n", $lines), 200, [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="central.ics"',
        ]);
    }
}
