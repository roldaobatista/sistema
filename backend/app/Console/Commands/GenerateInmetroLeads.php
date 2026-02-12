<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\InmetroLeadService;
use Illuminate\Console\Command;

class GenerateInmetroLeads extends Command
{
    protected $signature = 'inmetro:generate-leads 
                            {--tenant= : Specific tenant ID}
                            {--urgent=30 : Days threshold for Urgent priority}
                            {--high=60 : Days threshold for High priority}
                            {--pipeline=90 : Days threshold for Pipeline priority}';
    protected $description = 'Daily recalculation of INMETRO lead priorities and expiration alert generation';

    public function handle(InmetroLeadService $leadService): int
    {
        $tenantId = $this->option('tenant');
        $urgent = (int) $this->option('urgent');
        $high = (int) $this->option('high');
        $pipeline = (int) $this->option('pipeline');

        $tenants = $tenantId
            ? Tenant::where('id', $tenantId)->get()
            : Tenant::where('status', 'active')->get();

        foreach ($tenants as $tenant) {
            $this->info("Processing leads for tenant: {$tenant->name}");

            $priorityStats = $leadService->recalculatePriorities($tenant->id, $urgent, $high, $pipeline);
            $this->info("  Priorities: urgent={$priorityStats['urgent']}, high={$priorityStats['high']}, normal={$priorityStats['normal']}, low={$priorityStats['low']}");

            $alertCount = $leadService->generateExpirationAlerts($tenant->id, $urgent, $high, $pipeline);
            $this->info("  Expiration alerts generated: {$alertCount}");
        }

        $this->info('Lead generation completed.');
        return self::SUCCESS;
    }
}
