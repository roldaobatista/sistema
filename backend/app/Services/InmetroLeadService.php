<?php

namespace App\Services;

use App\Models\InmetroOwner;
use App\Models\InmetroInstrument;
use App\Models\Customer;
use App\Models\Notification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class InmetroLeadService
{
    /**
     * Recalculate priorities for all owners based on instrument status and expiration.
     * critical = any rejected instrument (INMETRO reprovação — contato imediato)
     * urgent = overdue or expiring within 30 days
     * high = expiring within 60 days
     * normal = expiring within 90 days
     * low = everything else
     */
    public function recalculatePriorities(int $tenantId, int $urgent = 30, int $high = 60, int $normal = 90): array
    {
        $stats = ['critical' => 0, 'urgent' => 0, 'high' => 0, 'normal' => 0, 'low' => 0];

        // Average revenue per calibration by instrument type (R$)
        $revenuePerCalibration = [
            'Balança' => 350.00,
            'Balança Rodoferroviária' => 1200.00,
            'Balança Comercial' => 300.00,
            'Medidor de Combustível' => 450.00,
            'Taxímetro' => 250.00,
            'Cronotacógrafo' => 200.00,
        ];
        $defaultRevenue = 350.00;

        $owners = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNull('converted_to_customer_id')
            ->with(['instruments'])
            ->get();

        foreach ($owners as $owner) {
            $instruments = $owner->instruments;
            $hasRejected = $instruments->contains('current_status', 'rejected');
            $totalInstruments = $instruments->count();

            // Calculate estimated revenue
            $estimatedRevenue = $instruments->sum(function ($i) use ($revenuePerCalibration, $defaultRevenue) {
                return $revenuePerCalibration[$i->instrument_type] ?? $defaultRevenue;
            });

            $minDays = $instruments
                ->filter(fn($i) => $i->next_verification_at !== null)
                ->map(fn($i) => (int) now()->startOfDay()->diffInDays($i->next_verification_at, false))
                ->min();

            // Rejected instruments = ALWAYS critical priority
            $priority = match (true) {
                $hasRejected => 'critical',
                $minDays === null => 'low',
                $minDays <= 0 => 'urgent',
                $minDays <= $urgent => 'urgent',
                $minDays <= $high => 'high',
                $minDays <= $normal => 'normal',
                default => 'low',
            };

            $owner->update([
                'priority' => $priority,
                'estimated_revenue' => $estimatedRevenue,
                'total_instruments' => $totalInstruments,
            ]);

            $stats[$priority]++;
        }

        return $stats;
    }

    /**
     * Get lead summary dashboard data.
     */
    public function getDashboard(int $tenantId): array
    {
        $owners = InmetroOwner::where('tenant_id', $tenantId);
        $instruments = InmetroInstrument::whereHas('location.owner', fn($q) => $q->where('tenant_id', $tenantId));

        $totalOwners = (clone $owners)->count();
        $totalInstruments = (clone $instruments)->count();

        $overdue = (clone $instruments)->overdue()->count();
        $expiring30 = (clone $instruments)->expiringSoon(30)->count();
        $expiring60 = (clone $instruments)->expiringSoon(60)->count();
        $expiring90 = (clone $instruments)->expiringSoon(90)->count();

        $leadsNew = (clone $owners)->where('lead_status', 'new')->count();
        $leadsContacted = (clone $owners)->where('lead_status', 'contacted')->count();
        $leadsNegotiating = (clone $owners)->where('lead_status', 'negotiating')->count();
        $leadsConverted = (clone $owners)->where('lead_status', 'converted')->count();
        $leadsLost = (clone $owners)->where('lead_status', 'lost')->count();

        $byCity = InmetroInstrument::query()
            ->join('inmetro_locations', 'inmetro_instruments.location_id', '=', 'inmetro_locations.id')
            ->join('inmetro_owners', 'inmetro_locations.owner_id', '=', 'inmetro_owners.id')
            ->where('inmetro_owners.tenant_id', $tenantId)
            ->selectRaw('inmetro_locations.address_city as city, COUNT(*) as total')
            ->groupBy('inmetro_locations.address_city')
            ->orderByDesc('total')
            ->limit(20)
            ->get();

        $byStatus = InmetroInstrument::query()
            ->join('inmetro_locations', 'inmetro_instruments.location_id', '=', 'inmetro_locations.id')
            ->join('inmetro_owners', 'inmetro_locations.owner_id', '=', 'inmetro_owners.id')
            ->where('inmetro_owners.tenant_id', $tenantId)
            ->selectRaw('current_status, COUNT(*) as total')
            ->groupBy('current_status')
            ->get();

        $byBrand = InmetroInstrument::query()
            ->join('inmetro_locations', 'inmetro_instruments.location_id', '=', 'inmetro_locations.id')
            ->join('inmetro_owners', 'inmetro_locations.owner_id', '=', 'inmetro_owners.id')
            ->where('inmetro_owners.tenant_id', $tenantId)
            ->whereNotNull('inmetro_instruments.brand')
            ->where('inmetro_instruments.brand', '!=', '')
            ->selectRaw('brand, COUNT(*) as total')
            ->groupBy('brand')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        $byType = InmetroInstrument::query()
            ->join('inmetro_locations', 'inmetro_instruments.location_id', '=', 'inmetro_locations.id')
            ->join('inmetro_owners', 'inmetro_locations.owner_id', '=', 'inmetro_owners.id')
            ->where('inmetro_owners.tenant_id', $tenantId)
            ->whereNotNull('inmetro_instruments.instrument_type')
            ->where('inmetro_instruments.instrument_type', '!=', '')
            ->selectRaw('instrument_type, COUNT(*) as total')
            ->groupBy('instrument_type')
            ->orderByDesc('total')
            ->get();

        return [
            'totals' => [
                'owners' => $totalOwners,
                'instruments' => $totalInstruments,
                'overdue' => $overdue,
                'expiring_30d' => $expiring30,
                'expiring_60d' => $expiring60,
                'expiring_90d' => $expiring90,
            ],
            'leads' => [
                'new' => $leadsNew,
                'contacted' => $leadsContacted,
                'negotiating' => $leadsNegotiating,
                'converted' => $leadsConverted,
                'lost' => $leadsLost,
            ],
            'by_city' => $byCity,
            'by_status' => $byStatus,
            'by_brand' => $byBrand,
            'by_type' => $byType,
        ];
    }

    /**
     * Convert an INMETRO prospect into a CRM customer.
     */
    public function convertToCustomer(InmetroOwner $owner): array
    {
        if ($owner->converted_to_customer_id) {
            return ['success' => false, 'error' => 'Already converted'];
        }

        DB::beginTransaction();
        try {
            $customer = Customer::create([
                'tenant_id' => $owner->tenant_id,
                'name' => $owner->name,
                'trade_name' => $owner->trade_name,
                'document' => $owner->document,
                'document_type' => $owner->type === 'PF' ? 'cpf' : 'cnpj',
                'phone' => $owner->phone,
                'email' => $owner->email,
                'type' => $owner->type === 'PF' ? 'individual' : 'company',
                'segment' => 'inmetro_lead',
                'source' => 'inmetro_intelligence',
                'is_active' => true,
            ]);

            $locations = $owner->locations;
            $primaryLocation = $locations->first();
            $secondaryLocations = $locations->slice(1);

            if ($primaryLocation) {
                $customer->update([
                    'address_street' => $primaryLocation->address_street,
                    'address_number' => $primaryLocation->address_number,
                    'address_complement' => $primaryLocation->address_complement,
                    'address_neighborhood' => $primaryLocation->address_neighborhood,
                    'address_city' => $primaryLocation->address_city,
                    'address_state' => $primaryLocation->address_state,
                    'address_zip' => $primaryLocation->address_zip,
                ]);
            }

            // Append secondary locations to notes
            if ($secondaryLocations->isNotEmpty()) {
                $notes = $customer->notes ? $customer->notes . "\n\n" : "";
                $notes .= "--- Locais Secundários (Importado INMETRO) ---\n";
                
                foreach ($secondaryLocations as $loc) {
                    $notes .= "📍 {$loc->address_city}/{$loc->address_state}";
                    if ($loc->farm_name) $notes .= " ({$loc->farm_name})";
                    $notes .= "\n   {$loc->address_street}, {$loc->address_number} - {$loc->address_neighborhood}\n";
                    if ($loc->state_registration) $notes .= "   IE: {$loc->state_registration}\n";
                    $notes .= "\n";
                }
                
                $customer->update(['notes' => $notes]);
            }

            $owner->update([
                'converted_to_customer_id' => $customer->id,
                'lead_status' => 'converted',
            ]);

            DB::commit();
            return ['success' => true, 'customer_id' => $customer->id];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('INMETRO convert to customer failed', ['owner_id' => $owner->id, 'error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Generate notifications for instruments expiring soon.
     */
    public function generateExpirationAlerts(int $tenantId, int $urgent = 30, int $high = 60, int $normal = 90): int
    {
        $count = 0;

        // Get instruments expiring in the next pipeline threshold days or overdue
        $expiringInstruments = InmetroInstrument::query()
            ->join('inmetro_locations', 'inmetro_instruments.location_id', '=', 'inmetro_locations.id')
            ->join('inmetro_owners', 'inmetro_locations.owner_id', '=', 'inmetro_owners.id')
            ->where('inmetro_owners.tenant_id', $tenantId)
            ->whereNull('inmetro_owners.converted_to_customer_id')
            ->where('inmetro_instruments.next_verification_at', '<=', now()->addDays($normal + 1))
            ->where('inmetro_instruments.next_verification_at', '>', now()->subDays(365))
            ->select('inmetro_instruments.*', 'inmetro_owners.name as owner_name', 'inmetro_locations.address_city')
            ->get();

        foreach ($expiringInstruments as $instrument) {
            $daysLeft = (int) now()->startOfDay()->diffInDays($instrument->next_verification_at, false);
            
            // Determine triggering threshold
            $targetThreshold = null;
            if ($daysLeft <= 0) $targetThreshold = 0;
            elseif ($daysLeft <= $urgent && $daysLeft > ($urgent - 5)) $targetThreshold = $urgent;
            elseif ($daysLeft <= $high && $daysLeft > ($high - 5)) $targetThreshold = $high; 
            elseif ($daysLeft <= $normal && $daysLeft > ($normal - 5)) $targetThreshold = $normal;
            
            // If strictly inside a window but not near the trigger edge, we might skip to avoid daily spam
            // But let's keep the logic simple: verify priority and recent notification
            
            // Define message and priority
            if ($daysLeft <= 0) {
                $title = "⚠️ Verificação VENCIDA: {$instrument->owner_name}";
                $action = "Contatar urgente para evitar multas.";
                $priority = 'urgent';
            } elseif ($daysLeft <= $urgent) {
                $title = "🚨 Urgente ({$urgent} dias): {$instrument->owner_name}";
                $action = "Agendar visita imediata.";
                $priority = 'urgent';
            } elseif ($daysLeft <= $high) {
                $title = "🔔 Prioridade ({$high} dias): {$instrument->owner_name}";
                $action = "Iniciar contato e agendar.";
                $priority = 'high';
            } else {
                $title = "📋 Pipeline ({$normal} dias): {$instrument->owner_name}";
                $action = "Preparar proposta.";
                $priority = 'normal';
            }

            // Check if we notified about this instrument recently (last 20 days)
            $existing = Notification::where('tenant_id', $tenantId)
                ->where('type', 'inmetro_expiration')
                ->where('notifiable_type', 'inmetro_instrument')
                ->where('notifiable_id', $instrument->id)
                ->where('created_at', '>=', now()->subDays(20))
                ->exists();

            if (!$existing) {
                // Determine icon and color based on priority
                $icon = match($priority) {
                    'urgent' => 'alert-triangle',
                    'high' => 'alert-circle',
                    'normal' => 'clipboard',
                    default => 'bell',
                };
                $color = match($priority) {
                    'urgent' => 'red',
                    'high' => 'orange',
                    'normal' => 'blue',
                    default => 'gray',
                };

                // Notify all users of this tenant
                $users = \App\Models\User::where('tenant_id', $tenantId)->get();

                foreach ($users as $user) {
                    Notification::create([
                        'tenant_id' => $tenantId,
                        'user_id' => $user->id,
                        'type' => 'inmetro_expiration',
                        'title' => $title,
                        'message' => "Balança ({$instrument->inmetro_number})\nCidade: {$instrument->address_city}\nVence em {$daysLeft} dias.\n{$action}",
                        'icon' => $icon,
                        'color' => $color,
                        'notifiable_type' => 'inmetro_instrument',
                        'notifiable_id' => $instrument->id,
                        'data' => ['priority' => $priority, 'days_left' => $daysLeft],
                    ]);
                }
                
                if ($users->isNotEmpty()) {
                    $count++;
                }
            }
        }
    
        return $count;
    }

    /**
     * Cross-reference INMETRO owners with CRM customers by document (CNPJ/CPF).
     * Auto-links owners to existing customers without converting (preserves lead data).
     */
    public function crossReferenceWithCRM(int $tenantId): array
    {
        $stats = ['matched' => 0, 'already_linked' => 0, 'unmatched' => 0];

        $owners = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNull('converted_to_customer_id')
            ->whereNotNull('document')
            ->where('document', '!=', '')
            ->get();

        foreach ($owners as $owner) {
            $cleanDoc = preg_replace('/[^0-9]/', '', $owner->document);
            if (empty($cleanDoc)) {
                $stats['unmatched']++;
                continue;
            }

            // Try to match by cleaned document
            $customer = Customer::where('tenant_id', $tenantId)
                ->whereRaw("REPLACE(REPLACE(REPLACE(document, '.', ''), '-', ''), '/', '') = ?", [$cleanDoc])
                ->first();

            if ($customer) {
                $owner->update([
                    'converted_to_customer_id' => $customer->id,
                    'lead_status' => 'converted',
                ]);
                $stats['matched']++;
            } else {
                $stats['unmatched']++;
            }
        }

        // Also check already-linked owners
        $stats['already_linked'] = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNotNull('converted_to_customer_id')
            ->count();

        return $stats;
    }

    /**
     * Get INMETRO intelligence profile for a specific CRM customer.
     */
    public function getCustomerInmetroProfile(int $tenantId, int $customerId): ?array
    {
        $customer = Customer::where('tenant_id', $tenantId)->findOrFail($customerId);

        // Find linked owner(s) by converted_to_customer_id
        $owners = InmetroOwner::where('tenant_id', $tenantId)
            ->where('converted_to_customer_id', $customerId)
            ->with(['locations', 'instruments'])
            ->get();

        // Also try matching by document if no link exists
        if ($owners->isEmpty() && $customer->document) {
            $cleanDoc = preg_replace('/[^0-9]/', '', $customer->document);
            if (!empty($cleanDoc)) {
                $owners = InmetroOwner::where('tenant_id', $tenantId)
                    ->whereRaw("REPLACE(REPLACE(REPLACE(document, '.', ''), '-', ''), '/', '') = ?", [$cleanDoc])
                    ->with(['locations', 'instruments'])
                    ->get();
            }
        }

        if ($owners->isEmpty()) {
            return null;
        }

        $instruments = $owners->flatMap(fn($o) => $o->instruments);
        $locations = $owners->flatMap(fn($o) => $o->locations);

        $overdue = $instruments->filter(fn($i) =>
            $i->next_verification_at && $i->next_verification_at->isPast()
        )->count();

        $expiring30 = $instruments->filter(fn($i) =>
            $i->next_verification_at &&
            $i->next_verification_at->isFuture() &&
            $i->next_verification_at->diffInDays(now()) <= 30
        )->count();

        $expiring90 = $instruments->filter(fn($i) =>
            $i->next_verification_at &&
            $i->next_verification_at->isFuture() &&
            $i->next_verification_at->diffInDays(now()) <= 90
        )->count();

        $byType = $instruments->groupBy('instrument_type')->map(fn($group) => $group->count());

        return [
            'linked' => true,
            'owner_ids' => $owners->pluck('id')->toArray(),
            'owner_names' => $owners->pluck('name')->toArray(),
            'total_instruments' => $instruments->count(),
            'total_locations' => $locations->count(),
            'overdue' => $overdue,
            'expiring_30d' => $expiring30,
            'expiring_90d' => $expiring90,
            'by_type' => $byType,
            'instruments' => $instruments->map(fn($i) => [
                'id' => $i->id,
                'inmetro_number' => $i->inmetro_number,
                'instrument_type' => $i->instrument_type,
                'brand' => $i->brand,
                'model' => $i->model,
                'current_status' => $i->current_status,
                'last_verification_at' => $i->last_verification_at?->toDateString(),
                'next_verification_at' => $i->next_verification_at?->toDateString(),
            ])->values()->toArray(),
            'locations' => $locations->map(fn($l) => [
                'id' => $l->id,
                'address_city' => $l->address_city,
                'address_state' => $l->address_state,
                'farm_name' => $l->farm_name,
            ])->values()->toArray(),
        ];
    }

    /**
     * Get cross-reference summary stats.
     */
    public function getCrossReferenceStats(int $tenantId): array
    {
        $totalOwners = InmetroOwner::where('tenant_id', $tenantId)->count();
        $linked = InmetroOwner::where('tenant_id', $tenantId)->whereNotNull('converted_to_customer_id')->count();
        $unlinked = $totalOwners - $linked;

        $withDocument = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNull('converted_to_customer_id')
            ->whereNotNull('document')
            ->where('document', '!=', '')
            ->count();

        return [
            'total_owners' => $totalOwners,
            'linked' => $linked,
            'unlinked' => $unlinked,
            'with_document' => $withDocument,
            'link_percentage' => $totalOwners > 0 ? round(($linked / $totalOwners) * 100, 1) : 0,
        ];
    }
}
