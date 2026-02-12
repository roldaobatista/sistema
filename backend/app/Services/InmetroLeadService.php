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
     * Recalculate priorities for all owners based on instrument expiration.
     */
    public function recalculatePriorities(int $tenantId, int $urgent = 30, int $high = 60, int $normal = 90): array
    {
        $stats = ['urgent' => 0, 'high' => 0, 'normal' => 0, 'low' => 0];

        $owners = InmetroOwner::where('tenant_id', $tenantId)
            ->whereNull('converted_to_customer_id')
            ->with(['instruments'])
            ->get();

        foreach ($owners as $owner) {
            $minDays = $owner->instruments
                ->filter(fn($i) => $i->next_verification_at !== null)
                ->map(fn($i) => (int) now()->startOfDay()->diffInDays($i->next_verification_at, false))
                ->min();

            $priority = match (true) {
                $minDays === null => 'low',
                $minDays <= 0 => 'urgent',     // Overdue
                $minDays <= $urgent => 'urgent',
                $minDays <= $high => 'high',
                $minDays <= $normal => 'normal',
                default => 'low',
            };

            if ($owner->priority !== $priority) {
                $owner->update(['priority' => $priority]);
            }

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
}
