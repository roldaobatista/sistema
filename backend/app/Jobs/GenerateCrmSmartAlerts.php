<?php

namespace App\Jobs;

use App\Models\Tenant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class GenerateCrmSmartAlerts implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        $controller = new \App\Http\Controllers\Api\V1\CrmFeaturesController();

        Tenant::where('is_active', true)->each(function ($tenant) use ($controller) {
            try {
                $request = new \Illuminate\Http\Request();
                $request->setUserResolver(fn() => (object) [
                    'current_tenant_id' => $tenant->id,
                    'tenant_id' => $tenant->id,
                ]);

                $controller->generateSmartAlerts($request);
            } catch (\Throwable $e) {
                Log::error('Smart alerts generation failed for tenant', [
                    'tenant_id' => $tenant->id,
                    'error' => $e->getMessage(),
                ]);
            }
        });
    }
}
