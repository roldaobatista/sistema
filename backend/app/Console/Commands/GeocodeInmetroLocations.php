<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\InmetroGeocodingService;
use Illuminate\Console\Command;

class GeocodeInmetroLocations extends Command
{
    protected $signature = 'inmetro:geocode
        {--tenant= : Specific tenant ID}
        {--limit=100 : Max locations to geocode per tenant}
        {--distances : Also calculate distances from base}
        {--base-lat= : Base latitude for distance calculation}
        {--base-lng= : Base longitude for distance calculation}';

    protected $description = 'Geocode INMETRO locations without coordinates using Nominatim (free, no API key)';

    public function handle(InmetroGeocodingService $geocodingService): int
    {
        $tenantId = $this->option('tenant');
        $limit = (int) $this->option('limit');
        $calculateDistances = $this->option('distances');

        $tenants = $tenantId
            ? Tenant::where('id', $tenantId)->get()
            : Tenant::where('status', 'active')->get();

        if ($tenants->isEmpty()) {
            $this->warn('No tenants found.');
            return self::FAILURE;
        }

        foreach ($tenants as $tenant) {
            $this->info("═══ Geocoding tenant: {$tenant->name} ═══");

            $stats = $geocodingService->geocodeAll($tenant->id, $limit);

            $this->table(
                ['Processed', 'Geocoded', 'Failed', 'Skipped'],
                [[$stats['processed'], $stats['geocoded'], $stats['failed'], $stats['skipped']]]
            );

            if ($calculateDistances) {
                $baseLat = (float) ($this->option('base-lat') ?? -15.601);
                $baseLng = (float) ($this->option('base-lng') ?? -56.097);

                $this->info("  Calculating distances from base ({$baseLat}, {$baseLng})...");
                $updated = $geocodingService->calculateDistances($tenant->id, $baseLat, $baseLng);
                $this->info("  ✅ Distances calculated for {$updated} locations.");
            }

            $this->newLine();
        }

        $this->info('✅ Geocoding completed.');
        return self::SUCCESS;
    }
}
