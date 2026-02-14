<?php

namespace App\Observers;

use App\Models\TimeEntry;
use App\Models\User;

class TimeEntryObserver
{
    /**
     * Handle the TimeEntry "created" event.
     */
    public function created(TimeEntry $timeEntry): void
    {
        $this->updateUserStatus($timeEntry);
    }

    /**
     * Handle the TimeEntry "updated" event.
     */
    public function updated(TimeEntry $timeEntry): void
    {
        // Se foi finalizado (ended_at preenchido), volta para available
        if ($timeEntry->wasChanged('ended_at') && $timeEntry->ended_at !== null) {
            $this->setUserStatus($timeEntry->technician_id, 'available');
            return;
        }

        // Caso mude o tipo ou algo assim enquanto ainda está aberto
        if ($timeEntry->ended_at === null) {
            $this->updateUserStatus($timeEntry);
        }
    }

    /**
     * Handle the TimeEntry "deleted" event.
     */
    public function deleted(TimeEntry $timeEntry): void
    {
        // Se deletar um apontamento em aberto, volta para available (assumindo que era o único)
        if ($timeEntry->ended_at === null) {
            // Verificar se existem outros apontamentos em aberto seria ideal, 
            // mas por simplicidade e regra de negócio (apenas 1 por vez), voltamos para available.
            $this->setUserStatus($timeEntry->technician_id, 'available');
        }
    }

    private function updateUserStatus(TimeEntry $entry): void
    {
        // Se já estiver finalizado, não define status de ocupado
        if ($entry->ended_at !== null) {
            return;
        }

        $status = match ($entry->type) {
            TimeEntry::TYPE_TRAVEL => 'in_transit',
            TimeEntry::TYPE_WORK => 'working',
            TimeEntry::TYPE_WAITING => 'available', // Ou outro status se houver 'waiting'
            default => 'available',
        };

        if ($status !== 'available') {
            $this->setUserStatus($entry->technician_id, $status);
        }
    }

    private function setUserStatus(int $userId, string $status): void
    {
        $user = User::find($userId);
        if ($user) {
            $user->update(['status' => $status]);
            broadcast(new \App\Events\TechnicianLocationUpdated($user));
        }
    }
}
