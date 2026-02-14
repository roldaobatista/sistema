<?php

namespace App\Http\Controllers\Api\V1\Os;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use App\Models\WorkOrderChat;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class WorkOrderChatController extends Controller
{
    public function index(WorkOrder $workOrder): JsonResponse
    {
        try {
            $this->authorize('view', $workOrder);

            $messages = $workOrder->chats()
                ->with('user:id,name,avatar_url')
                ->orderBy('created_at', 'asc')
                ->get();

            return response()->json($messages);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json(['message' => 'Sem permissão'], 403);
        } catch (\Exception $e) {
            Log::error('WorkOrderChat index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao carregar chat'], 500);
        }
    }

    public function store(Request $request, WorkOrder $workOrder): JsonResponse
    {
        try {
            DB::beginTransaction();

            $this->authorize('update', $workOrder);

            $validated = $request->validate([
                'message' => 'required|string',
                'type' => 'sometimes|string|in:text,file',
                'file' => 'sometimes|file|max:10240',
            ]);

            $data = [
                'tenant_id' => $workOrder->tenant_id,
                'work_order_id' => $workOrder->id,
                'user_id' => $request->user()->id,
                'message' => $validated['message'],
                'type' => $validated['type'] ?? 'text',
            ];

            if ($request->hasFile('file')) {
                $path = $request->file('file')->store("work-orders/{$workOrder->id}/chat", 'public');
                $data['file_path'] = $path;
                $data['type'] = 'file';
            }

            $chat = WorkOrderChat::create($data);

            DB::commit();
            return response()->json($chat->load('user:id,name,avatar_url'), 201);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Sem permissão'], 403);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('WorkOrderChat store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao enviar mensagem'], 500);
        }
    }

    public function markAsRead(WorkOrder $workOrder): JsonResponse
    {
        try {
            $workOrder->chats()
                ->where('user_id', '!=', auth()->id())
                ->whereNull('read_at')
                ->update(['read_at' => now()]);

            return response()->json(['message' => 'Mensagens marcadas como lidas']);
        } catch (\Exception $e) {
            Log::error('WorkOrderChat markAsRead failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao marcar como lido'], 500);
        }
    }
}
