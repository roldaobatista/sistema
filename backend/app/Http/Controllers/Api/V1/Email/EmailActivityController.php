<?php

namespace App\Http\Controllers\Api\V1\Email;

use App\Http\Controllers\Controller;
use App\Models\Email;
use Illuminate\Http\JsonResponse;

class EmailActivityController extends Controller
{
    public function index(Email $email): JsonResponse
    {
        $this->authorize('view', $email);

        $activities = $email->activities()
            ->with('user')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($activities);
    }
}
