<?php

namespace App\Http\Controllers\Api\V1\Email;

use App\Http\Controllers\Controller;
use App\Models\Email;
use App\Models\CentralItem;
use App\Enums\CentralItemType;
use App\Services\Email\EmailSendService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Models\EmailActivity;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class EmailController extends Controller
{
    public function __construct(
        private EmailSendService $sendService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Email::with(['account:id,name,email', 'customer:id,name', 'attachments'])
            ->where('tenant_id', $request->user()->current_tenant_id);

        // Filters
        if ($request->filled('account_id')) {
            $query->where('email_account_id', $request->account_id);
        }
        if ($request->filled('folder')) {
            match ($request->folder) {
                'inbox' => $query->inbox(),
                'sent' => $query->sent(),
                'starred' => $query->starred(),
                'archived' => $query->where('is_archived', true),
                default => $query->inbox(),
            };
        } else {
            $query->inbox();
        }
        if ($request->filled('is_read')) {
            $request->boolean('is_read') ? $query->where('is_read', true) : $query->unread();
        }
        if ($request->filled('ai_category')) {
            $query->category($request->ai_category);
        }
        if ($request->filled('ai_priority')) {
            $query->priority($request->ai_priority);
        }
        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('subject', 'like', "%{$search}%")
                  ->orWhere('from_email', 'like', "%{$search}%")
                  ->orWhere('from_name', 'like', "%{$search}%")
                  ->orWhere('body_text', 'like', "%{$search}%");
            });
        }

        $emails = $query->orderByDesc('received_at')
            ->paginate($request->input('per_page', 25));

        return response()->json($emails);
    }

    public function show(Request $request, Email $email): JsonResponse
    {
        $this->authorizeTenant($request, $email);

        $email->load(['account:id,name,email', 'customer', 'attachments', 'linked', 'thread']);

        // Mark as read
        if (!$email->is_read) {
            $email->update(['is_read' => true]);
        }

        return response()->json(['data' => $email]);
    }

    public function toggleStar(Request $request, Email $email): JsonResponse
    {
        $this->authorizeTenant($request, $email);
        $email->update(['is_starred' => !$email->is_starred]);

        return response()->json(['data' => $email->fresh()]);
    }

    public function markRead(Request $request, Email $email): JsonResponse
    {
        $this->authorizeTenant($request, $email);
        $email->update(['is_read' => true]);

        return response()->json(['message' => 'Marcado como lido']);
    }

    public function markUnread(Request $request, Email $email): JsonResponse
    {
        $this->authorizeTenant($request, $email);
        $email->update(['is_read' => false]);

        return response()->json(['message' => 'Marcado como não lido']);
    }

    public function archive(Request $request, Email $email): JsonResponse
    {
        $this->authorizeTenant($request, $email);
        $email->update(['is_archived' => true]);

        return response()->json(['message' => 'Email arquivado']);
    }

    public function reply(Request $request, Email $email): JsonResponse
    {
        $this->authorizeTenant($request, $email);

        $request->validate([
            'body' => 'required|string',
            'cc' => 'nullable|string',
            'bcc' => 'nullable|string',
        ]);

        try {
            $sentEmail = $this->sendService->reply($email, [
                'body' => $request->body,
                'cc' => $request->cc,
                'bcc' => $request->bcc,
            ]);

            return response()->json([
                'message' => 'Resposta enviada com sucesso',
                'data' => $sentEmail,
            ]);
        } catch (\Exception $e) {
            Log::error('Email reply failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Falha ao enviar resposta'], 500);
        }
    }

    public function forward(Request $request, Email $email): JsonResponse
    {
        $this->authorizeTenant($request, $email);

        $request->validate([
            'to' => 'required|string',
            'body' => 'nullable|string',
        ]);

        try {
            $sentEmail = $this->sendService->forward($email, [
                'to' => $request->to,
                'body' => $request->body ?? '',
            ]);

            return response()->json([
                'message' => 'Email encaminhado com sucesso',
                'data' => $sentEmail,
            ]);
        } catch (\Exception $e) {
            Log::error('Email forward failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Falha ao encaminhar email'], 500);
        }
    }

    public function compose(Request $request): JsonResponse
    {
        $request->validate([
            'account_id' => 'required|exists:email_accounts,id',
            'to' => 'required|string',
            'subject' => 'required|string|max:500',
            'body' => 'required|string',
            'cc' => 'nullable|string',
            'bcc' => 'nullable|string',
        ]);

        try {
            $sentEmail = $this->sendService->compose(
                accountId: $request->account_id,
                tenantId: $request->user()->current_tenant_id,
                data: $request->only(['to', 'subject', 'body', 'cc', 'bcc'])
            );

            return response()->json([
                'message' => 'Email enviado com sucesso',
                'data' => $sentEmail,
            ], 201);
        } catch (\Exception $e) {
            Log::error('Email compose failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Falha ao enviar email'], 500);
        }
    }

    public function createTask(Request $request, Email $email): JsonResponse
    {
        $this->authorizeTenant($request, $email);

        $request->validate([
            'type' => 'required|in:tarefa,chamado,os',
            'title' => 'nullable|string|max:255',
            'responsible_id' => 'nullable|exists:users,id',
        ]);

        try {
            DB::beginTransaction();

            $type = match ($request->type) {
                'tarefa' => CentralItemType::TAREFA,
                'chamado' => CentralItemType::CHAMADO,
                'os' => CentralItemType::OS,
            };

            $item = CentralItem::criarDeOrigem(
                model: $email,
                tipo: $type,
                titulo: $request->title ?? $email->subject,
                responsavelId: $request->responsible_id,
                extras: [
                    'description' => $email->ai_summary ?? mb_substr($email->body_text ?? '', 0, 500),
                    'priority' => $email->ai_priority ?? 'media',
                    'context' => "Email de: {$email->from_name} <{$email->from_email}>",
                ]
            );

            // Link email to created item
            $email->update([
                'linked_type' => $item->getMorphClass(),
                'linked_id' => $item->id,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Item criado a partir do email',
                'data' => $item->load('responsible'),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Create task from email failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar item'], 500);
        }
    }

    public function linkEntity(Request $request, Email $email): JsonResponse
    {
        $this->authorizeTenant($request, $email);

        $request->validate([
            'linked_type' => 'required|string',
            'linked_id' => 'required|integer',
        ]);

        $email->update([
            'linked_type' => $request->linked_type,
            'linked_id' => $request->linked_id,
        ]);

        return response()->json([
            'message' => 'Email vinculado com sucesso',
            'data' => $email->fresh()->load('linked'),
        ]);
    }

    public function stats(Request $request): JsonResponse
    {
        $tenantId = $request->user()->current_tenant_id;

        $stats = [
            'total' => Email::where('tenant_id', $tenantId)->count(),
            'unread' => Email::where('tenant_id', $tenantId)->unread()->count(),
            'starred' => Email::where('tenant_id', $tenantId)->starred()->count(),
            'today' => Email::where('tenant_id', $tenantId)
                ->whereDate('received_at', today())
                ->count(),
            'by_category' => Email::where('tenant_id', $tenantId)
                ->whereNotNull('ai_category')
                ->selectRaw('ai_category, COUNT(*) as count')
                ->groupBy('ai_category')
                ->pluck('count', 'ai_category'),
            'by_priority' => Email::where('tenant_id', $tenantId)
                ->whereNotNull('ai_priority')
                ->selectRaw('ai_priority, COUNT(*) as count')
                ->groupBy('ai_priority')
                ->pluck('count', 'ai_priority'),
            'by_sentiment' => Email::where('tenant_id', $tenantId)
                ->whereNotNull('ai_sentiment')
                ->selectRaw('ai_sentiment, COUNT(*) as count')
                ->groupBy('ai_sentiment')
                ->pluck('count', 'ai_sentiment'),
        ];

        return response()->json(['data' => $stats]);
    }



    /**
     * Batch actions.
     */
    /**
     * Assign email to a user.
     */
    public function assign(Request $request, Email $email): JsonResponse
    {
        $this->authorize('manage', $email); // Assuming manage perm implies assignment

        $validated = $request->validate([
            'user_id' => 'nullable|exists:users,id',
        ]);

        $userId = $validated['user_id'];
        
        $email->update([
            'assigned_to_user_id' => $userId,
            'assigned_at' => $userId ? now() : null,
        ]);

        EmailActivity::create([
            'tenant_id' => $email->tenant_id,
            'email_id' => $email->id,
            'user_id' => auth()->id(),
            'type' => $userId ? 'assigned' : 'unassigned',
            'details' => ['assigned_to' => $userId],
        ]);

        return response()->json($email);
    }

    /**
     * Snooze email until a specific date.
     */
    public function snooze(Request $request, Email $email): JsonResponse
    {
        $this->authorize('manage', $email);

        $validated = $request->validate([
            'snoozed_until' => 'nullable|date|after:now',
        ]);

        $email->update([
            'snoozed_until' => $validated['snoozed_until'],
            // Optionally move to archive or keep in inbox but hide? 
            // Usually snoozed items are hidden until the date.
            // For now just setting the date.
        ]);

        return response()->json($email);
    }
    
    /**
     * Tracking pixel endpoint (public).
     */
    public function track($trackingId)
    {
        $email = Email::where('tracking_id', $trackingId)->first();

        if ($email) {
            $email->increment('read_count');
            $email->update(['last_read_at' => now()]);

            // Log activity only if it's the first few reads to avoid spam
            if ($email->read_count <= 5) {
                EmailActivity::create([
                    'tenant_id' => $email->tenant_id,
                    'email_id' => $email->id,
                    'user_id' => null, // External
                    'type' => 'read_tracked',
                    'details' => ['ip' => request()->ip(), 'user_agent' => request()->userAgent()],
                ]);
            }
        }

        // Return transparent 1x1 pixel
        $pixel = base64_decode('R0lGODlhAQABAJAAAP8AAAAAACH5BAUQAAAALAAAAAABAAEAAAICBAEAOw==');
        return response($pixel, 200)->header('Content-Type', 'image/gif');
    }

    /**
     * Batch actions.
     */
    public function batchAction(Request $request): JsonResponse
    {
        $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:emails,id',
            'action' => 'required|in:mark_read,mark_unread,archive,star,unstar',
        ]);

        $tenantId = $request->user()->current_tenant_id;
        $query = Email::where('tenant_id', $tenantId)->whereIn('id', $request->ids);

        match ($request->action) {
            'mark_read' => $query->update(['is_read' => true]),
            'mark_unread' => $query->update(['is_read' => false]),
            'archive' => $query->update(['is_archived' => true]),
            'star' => $query->update(['is_starred' => true]),
            'unstar' => $query->update(['is_starred' => false]),
        };

        return response()->json(['message' => 'Ação aplicada com sucesso']);
    }

    private function authorizeTenant(Request $request, Email $email): void
    {
        abort_if(
            $email->tenant_id !== $request->user()->current_tenant_id,
            403,
            'Acesso negado'
        );
    }
}
