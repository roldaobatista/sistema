<?php

namespace App\Services;

use App\Models\InmetroOwner;
use App\Models\InmetroInstrument;
use App\Models\InmetroCompetitor;
use App\Models\Notification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class InmetroNotificationService
{
    /**
     * Check for recently rejected instruments and create urgent notifications.
     * This should run daily after sync to catch new rejections.
     */
    public function checkAndNotifyRejections(int $tenantId): int
    {
        $count = 0;

        $rejectedInstruments = InmetroInstrument::query()
            ->join('inmetro_locations', 'inmetro_instruments.location_id', '=', 'inmetro_locations.id')
            ->join('inmetro_owners', 'inmetro_locations.owner_id', '=', 'inmetro_owners.id')
            ->where('inmetro_owners.tenant_id', $tenantId)
            ->where('inmetro_instruments.current_status', 'rejected')
            ->select(
                'inmetro_instruments.*',
                'inmetro_owners.name as owner_name',
                'inmetro_owners.id as owner_id',
                'inmetro_owners.phone as owner_phone',
                'inmetro_locations.address_city'
            )
            ->get();

        foreach ($rejectedInstruments as $instrument) {
            // Check if we already notified about this rejection recently (last 3 days)
            $alreadyNotified = Notification::where('tenant_id', $tenantId)
                ->where('type', 'inmetro_rejection')
                ->where('notifiable_type', 'inmetro_instrument')
                ->where('notifiable_id', $instrument->id)
                ->where('created_at', '>=', now()->subDays(3))
                ->exists();

            if ($alreadyNotified) {
                continue;
            }

            $users = \App\Models\User::where('tenant_id', $tenantId)->get();

            foreach ($users as $user) {
                Notification::create([
                    'tenant_id' => $tenantId,
                    'user_id' => $user->id,
                    'type' => 'inmetro_rejection',
                    'title' => "🔴 REPROVADO: {$instrument->owner_name}",
                    'message' => "Instrumento {$instrument->inmetro_number} ({$instrument->instrument_type}) foi REPROVADO pelo INMETRO.\n"
                        . "Cidade: {$instrument->address_city}\n"
                        . "Marca: {$instrument->brand} | Modelo: {$instrument->model}\n"
                        . "AÇÃO: Contato IMEDIATO — cliente precisa de reparo e calibração urgente!",
                    'icon' => 'alert-octagon',
                    'color' => 'red',
                    'notifiable_type' => 'inmetro_instrument',
                    'notifiable_id' => $instrument->id,
                    'data' => [
                        'priority' => 'critical',
                        'owner_id' => $instrument->owner_id,
                        'owner_phone' => $instrument->owner_phone,
                        'instrument_number' => $instrument->inmetro_number,
                        'city' => $instrument->address_city,
                    ],
                ]);
            }

            if ($users->isNotEmpty()) {
                $count++;
            }
        }

        Log::info("INMETRO rejection notifications", ['tenant' => $tenantId, 'count' => $count]);
        return $count;
    }

    /**
     * Check for instruments expiring soon and create tiered notifications.
     * Tiers: 7 days (critical), 30 days (urgent), 60 days (high), 90 days (normal)
     */
    public function checkAndNotifyExpirations(int $tenantId): int
    {
        $count = 0;
        $thresholds = [
            ['days' => 7, 'emoji' => '🔴', 'priority' => 'critical', 'icon' => 'alert-octagon', 'color' => 'red', 'action' => 'Contato IMEDIATO — vencimento em dias!', 'cooldown' => 3],
            ['days' => 30, 'emoji' => '🟠', 'priority' => 'urgent', 'icon' => 'alert-triangle', 'color' => 'orange', 'action' => 'Agendar visita urgente.', 'cooldown' => 10],
            ['days' => 60, 'emoji' => '🟡', 'priority' => 'high', 'icon' => 'alert-circle', 'color' => 'yellow', 'action' => 'Iniciar contato e enviar proposta.', 'cooldown' => 20],
            ['days' => 90, 'emoji' => '🔵', 'priority' => 'normal', 'icon' => 'clipboard', 'color' => 'blue', 'action' => 'Preparar proposta comercial.', 'cooldown' => 30],
        ];

        foreach ($thresholds as $threshold) {
            $instruments = InmetroInstrument::query()
                ->join('inmetro_locations', 'inmetro_instruments.location_id', '=', 'inmetro_locations.id')
                ->join('inmetro_owners', 'inmetro_locations.owner_id', '=', 'inmetro_owners.id')
                ->where('inmetro_owners.tenant_id', $tenantId)
                ->whereNull('inmetro_owners.converted_to_customer_id')
                ->where('inmetro_instruments.current_status', '!=', 'rejected')
                ->whereNotNull('inmetro_instruments.next_verification_at')
                ->where('inmetro_instruments.next_verification_at', '<=', now()->addDays($threshold['days']))
                ->where('inmetro_instruments.next_verification_at', '>', $threshold['days'] === 7 ? now()->subDays(365) : now()->addDays($threshold['days'] - 30))
                ->select(
                    'inmetro_instruments.*',
                    'inmetro_owners.name as owner_name',
                    'inmetro_owners.id as owner_id',
                    'inmetro_locations.address_city'
                )
                ->get();

            foreach ($instruments as $instrument) {
                $daysLeft = (int) now()->startOfDay()->diffInDays($instrument->next_verification_at, false);

                $alreadyNotified = Notification::where('tenant_id', $tenantId)
                    ->where('type', 'inmetro_expiration')
                    ->where('notifiable_type', 'inmetro_instrument')
                    ->where('notifiable_id', $instrument->id)
                    ->where('created_at', '>=', now()->subDays($threshold['cooldown']))
                    ->exists();

                if ($alreadyNotified) {
                    continue;
                }

                $title = $daysLeft <= 0
                    ? "{$threshold['emoji']} VENCIDO: {$instrument->owner_name}"
                    : "{$threshold['emoji']} Vence em {$daysLeft}d: {$instrument->owner_name}";

                $users = \App\Models\User::where('tenant_id', $tenantId)->get();

                foreach ($users as $user) {
                    Notification::create([
                        'tenant_id' => $tenantId,
                        'user_id' => $user->id,
                        'type' => 'inmetro_expiration',
                        'title' => $title,
                        'message' => "Instrumento {$instrument->inmetro_number} ({$instrument->instrument_type})\n"
                            . "Cidade: {$instrument->address_city}\n"
                            . "{$threshold['action']}",
                        'icon' => $threshold['icon'],
                        'color' => $threshold['color'],
                        'notifiable_type' => 'inmetro_instrument',
                        'notifiable_id' => $instrument->id,
                        'data' => [
                            'priority' => $threshold['priority'],
                            'days_left' => $daysLeft,
                            'owner_id' => $instrument->owner_id,
                        ],
                    ]);
                }

                if ($users->isNotEmpty()) {
                    $count++;
                }
            }
        }

        Log::info("INMETRO expiration notifications", ['tenant' => $tenantId, 'count' => $count]);
        return $count;
    }

    /**
     * Check for new competitors that appeared since last sync.
     */
    public function checkAndNotifyNewCompetitors(int $tenantId): int
    {
        $count = 0;

        // Find competitors created in the last 24 hours (new from sync)
        $newCompetitors = InmetroCompetitor::where('tenant_id', $tenantId)
            ->where('created_at', '>=', now()->subDay())
            ->get();

        foreach ($newCompetitors as $competitor) {
            $alreadyNotified = Notification::where('tenant_id', $tenantId)
                ->where('type', 'inmetro_new_competitor')
                ->where('notifiable_type', 'inmetro_competitor')
                ->where('notifiable_id', $competitor->id)
                ->exists();

            if ($alreadyNotified) {
                continue;
            }

            $species = is_array($competitor->authorized_species) ? implode(', ', $competitor->authorized_species) : '';

            $users = \App\Models\User::where('tenant_id', $tenantId)->get();

            foreach ($users as $user) {
                Notification::create([
                    'tenant_id' => $tenantId,
                    'user_id' => $user->id,
                    'type' => 'inmetro_new_competitor',
                    'title' => "⚠️ Novo concorrente: {$competitor->name}",
                    'message' => "Nova oficina autorizada detectada em {$competitor->city}/{$competitor->state}.\n"
                        . "CNPJ: {$competitor->cnpj}\n"
                        . "Espécies: {$species}\n"
                        . "Autorização: {$competitor->authorization_number}",
                    'icon' => 'user-plus',
                    'color' => 'orange',
                    'notifiable_type' => 'inmetro_competitor',
                    'notifiable_id' => $competitor->id,
                    'data' => [
                        'competitor_id' => $competitor->id,
                        'city' => $competitor->city,
                        'state' => $competitor->state,
                    ],
                ]);
            }

            if ($users->isNotEmpty()) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * Run all notification checks after a sync. Call from SyncInmetroData command.
     */
    public function runAllChecks(int $tenantId): array
    {
        return [
            'rejections' => $this->checkAndNotifyRejections($tenantId),
            'expirations' => $this->checkAndNotifyExpirations($tenantId),
            'new_competitors' => $this->checkAndNotifyNewCompetitors($tenantId),
        ];
    }
}
