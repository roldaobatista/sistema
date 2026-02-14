<?php

namespace App\Http\Controllers\Api\V1\Email;

use App\Http\Controllers\Controller;
use App\Models\EmailSignature;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class EmailSignatureController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $signatures = EmailSignature::where('user_id', auth()->id())
            ->with('account')
            ->get();

        return response()->json($signatures);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email_account_id' => 'nullable|exists:email_accounts,id',
            'name' => 'required|string|max:255',
            'html_content' => 'required|string',
            'is_default' => 'boolean',
        ]);

        $signature = new EmailSignature($validated);
        $signature->user_id = auth()->id();
        $signature->save();

        if ($signature->is_default) {
            // Unset other defaults for this user/account
            EmailSignature::where('user_id', auth()->id())
                ->where('id', '!=', $signature->id)
                ->where('email_account_id', $signature->email_account_id)
                ->update(['is_default' => false]);
        }

        return response()->json($signature, 201);
    }

    public function update(Request $request, EmailSignature $emailSignature): JsonResponse
    {
        if ($emailSignature->user_id !== auth()->id()) {
            abort(403);
        }

        $validated = $request->validate([
            'email_account_id' => 'nullable|exists:email_accounts,id',
            'name' => 'sometimes|string|max:255',
            'html_content' => 'sometimes|string',
            'is_default' => 'boolean',
        ]);

        $emailSignature->update($validated);

        if ($emailSignature->is_default) {
            // Unset other defaults
            EmailSignature::where('user_id', auth()->id())
                ->where('id', '!=', $emailSignature->id)
                ->where('email_account_id', $emailSignature->email_account_id)
                ->update(['is_default' => false]);
        }

        return response()->json($emailSignature);
    }

    public function destroy(EmailSignature $emailSignature): JsonResponse
    {
        if ($emailSignature->user_id !== auth()->id()) {
            abort(403);
        }
        $emailSignature->delete();
        return response()->json(null, 204);
    }
}
