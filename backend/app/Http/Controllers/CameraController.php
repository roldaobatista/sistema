<?php

namespace App\Http\Controllers;

use App\Models\Camera;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CameraController extends Controller
{
    private function tenantId(): int
    {
        $user = auth()->user();
        return (int) ($user->current_tenant_id ?? $user->tenant_id);
    }

    public function index(Request $request): JsonResponse
    {
        $cameras = Camera::where('tenant_id', $this->tenantId())
            ->orderBy('position')
            ->get();

        return response()->json(['cameras' => $cameras]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:100',
            'stream_url' => 'required|string|max:500',
            'location' => 'nullable|string|max:200',
            'type' => 'nullable|string|max:50',
            'is_active' => 'boolean',
            'position' => 'nullable|integer|min:0',
        ]);

        $data['tenant_id'] = $this->tenantId();

        if (!isset($data['position'])) {
            $data['position'] = Camera::where('tenant_id', $data['tenant_id'])->max('position') + 1;
        }

        try {
            $camera = DB::transaction(fn () => Camera::create($data));
            return response()->json(['camera' => $camera], 201);
        } catch (\Throwable $e) {
            Log::error('Camera store failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao criar câmera'], 500);
        }
    }

    public function update(Request $request, Camera $camera): JsonResponse
    {
        if ($camera->tenant_id !== $this->tenantId()) {
            abort(403);
        }

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'stream_url' => 'sometimes|required|string|max:500',
            'location' => 'nullable|string|max:200',
            'type' => 'nullable|string|max:50',
            'is_active' => 'boolean',
            'position' => 'nullable|integer|min:0',
        ]);

        try {
            $camera->update($data);
            return response()->json(['camera' => $camera->fresh()]);
        } catch (\Throwable $e) {
            Log::error('Camera update failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao atualizar câmera'], 500);
        }
    }

    public function destroy(Camera $camera): JsonResponse
    {
        if ($camera->tenant_id !== $this->tenantId()) {
            abort(403);
        }

        try {
            $camera->delete();
            return response()->json(['message' => 'Câmera removida']);
        } catch (\Throwable $e) {
            Log::error('Camera destroy failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao remover câmera'], 500);
        }
    }

    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order' => 'required|array',
            'order.*' => 'integer|exists:cameras,id',
        ]);

        $tenantId = $this->tenantId();

        try {
            DB::transaction(function () use ($data, $tenantId) {
                foreach ($data['order'] as $position => $cameraId) {
                    Camera::where('id', $cameraId)
                        ->where('tenant_id', $tenantId)
                        ->update(['position' => $position]);
                }
            });

            return response()->json(['message' => 'Ordem atualizada']);
        } catch (\Throwable $e) {
            Log::error('Camera reorder failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao reordenar câmeras'], 500);
        }
    }

    public function testConnection(Request $request): JsonResponse
    {
        $data = $request->validate([
            'stream_url' => 'required|string|max:500',
        ]);

        $url = $data['stream_url'];
        $reachable = false;

        if (str_starts_with($url, 'rtsp://')) {
            $parsed = parse_url($url);
            $host = $parsed['host'] ?? '';
            $port = $parsed['port'] ?? 554;

            if ($host) {
                $connection = @fsockopen($host, $port, $errno, $errstr, 3);
                if ($connection) {
                    fclose($connection);
                    $reachable = true;
                }
            }
        } elseif (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 5,
                CURLOPT_CONNECTTIMEOUT => 3,
                CURLOPT_NOBODY => true,
            ]);
            curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            $reachable = $httpCode >= 200 && $httpCode < 400;
        }

        return response()->json([
            'reachable' => $reachable,
            'url' => $url,
        ]);
    }
}
