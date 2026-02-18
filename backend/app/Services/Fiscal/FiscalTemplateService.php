<?php

namespace App\Services\Fiscal;

use App\Models\FiscalNote;
use App\Models\FiscalTemplate;
use App\Models\Tenant;

/**
 * UX features: templates (#26), duplicate (#27), access key search (#28).
 */
class FiscalTemplateService
{
    /**
     * #26 — Save a fiscal note as a reusable template.
     */
    public function saveTemplate(string $name, string $type, array $templateData, int $tenantId, ?int $userId = null): FiscalTemplate
    {
        return FiscalTemplate::create([
            'tenant_id' => $tenantId,
            'name' => $name,
            'type' => $type,
            'template_data' => $templateData,
            'created_by' => $userId,
        ]);
    }

    /**
     * #26 — Save template from an existing fiscal note.
     */
    public function saveFromNote(FiscalNote $note, string $templateName): FiscalTemplate
    {
        return $this->saveTemplate($templateName, $note->type, [
            'customer_id' => $note->customer_id,
            'nature_of_operation' => $note->nature_of_operation,
            'cfop' => $note->cfop,
            'items' => $note->items_data,
            'payment_data' => $note->payment_data,
        ], $note->tenant_id, auth()->id());
    }

    public function listTemplates(int $tenantId): \Illuminate\Database\Eloquent\Collection
    {
        return FiscalTemplate::where('tenant_id', $tenantId)
            ->orderByDesc('usage_count')
            ->get();
    }

    public function applyTemplate(int $templateId, int $tenantId): ?array
    {
        $template = FiscalTemplate::where('id', $templateId)
            ->where('tenant_id', $tenantId)
            ->first();

        if (! $template) return null;

        $template->incrementUsage();

        return $template->template_data;
    }

    public function deleteTemplate(int $templateId, int $tenantId): bool
    {
        return FiscalTemplate::where('id', $templateId)
            ->where('tenant_id', $tenantId)
            ->delete() > 0;
    }

    /**
     * #27 — Duplicate a fiscal note (creates a new draft with same data).
     */
    public function duplicateNote(FiscalNote $note): array
    {
        return [
            'type' => $note->type,
            'customer_id' => $note->customer_id,
            'nature_of_operation' => $note->nature_of_operation,
            'cfop' => $note->cfop,
            'items' => $note->items_data,
            'total_amount' => $note->total_amount,
            'payment_data' => $note->payment_data,
            'source' => "duplicated_from_{$note->id}",
        ];
    }

    /**
     * #28 — Search by access key (44 digits).
     */
    public function searchByAccessKey(string $key, int $tenantId): ?FiscalNote
    {
        $clean = preg_replace('/\D/', '', $key);
        if (strlen($clean) !== 44) return null;

        return FiscalNote::where('access_key', $clean)
            ->where('tenant_id', $tenantId)
            ->first();
    }
}
