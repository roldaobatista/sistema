<?php

namespace App\Services\Fiscal;

use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Manages sequential fiscal numbering per tenant/series.
 * Uses atomic DB updates to prevent duplicates in concurrent scenarios.
 */
class FiscalNumberingService
{
    /**
     * Get the next NF-e number for a tenant, atomically incrementing the counter.
     */
    public function nextNFeNumber(Tenant $tenant, ?int $series = null): array
    {
        $series = $series ?? ($tenant->fiscal_nfe_series ?? 1);

        return DB::transaction(function () use ($tenant, $series) {
            // Lock the row for update
            $locked = DB::table('tenants')
                ->where('id', $tenant->id)
                ->lockForUpdate()
                ->first(['fiscal_nfe_next_number', 'fiscal_nfe_series']);

            $number = $locked->fiscal_nfe_next_number ?? 1;

            DB::table('tenants')
                ->where('id', $tenant->id)
                ->update(['fiscal_nfe_next_number' => $number + 1]);

            Log::info('FiscalNumbering: NF-e number allocated', [
                'tenant_id' => $tenant->id,
                'series' => $series,
                'number' => $number,
            ]);

            return [
                'number' => $number,
                'series' => $series,
            ];
        });
    }

    /**
     * Get the next RPS number for NFS-e, atomically incrementing the counter.
     */
    public function nextNFSeRpsNumber(Tenant $tenant, ?string $series = null): array
    {
        $series = $series ?? ($tenant->fiscal_nfse_rps_series ?? 'RPS');

        return DB::transaction(function () use ($tenant, $series) {
            $locked = DB::table('tenants')
                ->where('id', $tenant->id)
                ->lockForUpdate()
                ->first(['fiscal_nfse_rps_next_number', 'fiscal_nfse_rps_series']);

            $number = $locked->fiscal_nfse_rps_next_number ?? 1;

            DB::table('tenants')
                ->where('id', $tenant->id)
                ->update(['fiscal_nfse_rps_next_number' => $number + 1]);

            Log::info('FiscalNumbering: NFS-e RPS number allocated', [
                'tenant_id' => $tenant->id,
                'series' => $series,
                'number' => $number,
            ]);

            return [
                'number' => $number,
                'series' => $series,
            ];
        });
    }

    /**
     * Check if numbering gap exists (useful for inutilização).
     */
    public function hasGap(Tenant $tenant, int $expectedNumber): bool
    {
        $currentNext = $tenant->fiscal_nfe_next_number ?? 1;
        return $expectedNumber > $currentNext;
    }

    /**
     * Set the next number manually (e.g., after migration or inutilização).
     */
    public function setNFeNextNumber(Tenant $tenant, int $number, ?int $series = null): void
    {
        $update = ['fiscal_nfe_next_number' => $number];

        if ($series !== null) {
            $update['fiscal_nfe_series'] = $series;
        }

        $tenant->update($update);
    }

    /**
     * Set the next RPS number manually.
     */
    public function setNFSeNextNumber(Tenant $tenant, int $number, ?string $series = null): void
    {
        $update = ['fiscal_nfse_rps_next_number' => $number];

        if ($series !== null) {
            $update['fiscal_nfse_rps_series'] = $series;
        }

        $tenant->update($update);
    }
}
