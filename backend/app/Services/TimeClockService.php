<?php

namespace App\Services;

use App\Models\TimeClockEntry;
use App\Models\TimeClockAdjustment;
use App\Models\GeofenceLocation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class TimeClockService
{
    /**
     * Register clock-in with selfie, liveness, GPS, and geofencing.
     */
    public function clockIn(User $user, array $data): TimeClockEntry
    {
        $openEntry = TimeClockEntry::where('user_id', $user->id)
            ->whereNull('clock_out')
            ->first();

        if ($openEntry) {
            throw new \DomainException('Já existe um ponto aberto. Registre a saída primeiro.');
        }

        $entryData = [
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'clock_in' => now(),
            'latitude_in' => $data['latitude'] ?? null,
            'longitude_in' => $data['longitude'] ?? null,
            'type' => $data['type'] ?? 'regular',
            'liveness_score' => $data['liveness_score'] ?? null,
            'liveness_passed' => ($data['liveness_score'] ?? 0) >= 0.8,
            'clock_method' => $data['clock_method'] ?? 'selfie',
            'device_info' => $data['device_info'] ?? null,
            'ip_address' => $data['ip_address'] ?? null,
            'work_order_id' => $data['work_order_id'] ?? null,
        ];

        // Selfie storage
        if (!empty($data['selfie'])) {
            $entryData['selfie_path'] = $this->storeSelfie($data['selfie'], $user->id);
        }

        // Geofencing validation
        if (!empty($data['geofence_location_id']) && !empty($data['latitude']) && !empty($data['longitude'])) {
            $geofence = GeofenceLocation::find($data['geofence_location_id']);
            if ($geofence) {
                $distance = $geofence->distanceFrom($data['latitude'], $data['longitude']);
                $entryData['geofence_location_id'] = $geofence->id;
                $entryData['geofence_distance_meters'] = $distance;

                // If outside geofence and liveness failed, require manual approval
                if (!$geofence->isWithinRadius($data['latitude'], $data['longitude'])) {
                    $entryData['approval_status'] = 'pending';
                }
            }
        }

        // If liveness check failed, require manual approval
        if (!$entryData['liveness_passed'] && $entryData['clock_method'] === 'selfie') {
            $entryData['approval_status'] = 'pending';
        }

        $entryData['approval_status'] ??= 'auto_approved';

        return TimeClockEntry::create($entryData);
    }

    /**
     * Register clock-out.
     */
    public function clockOut(User $user, array $data): TimeClockEntry
    {
        $openEntry = TimeClockEntry::where('user_id', $user->id)
            ->whereNull('clock_out')
            ->first();

        if (!$openEntry) {
            throw new \DomainException('Nenhum ponto aberto encontrado.');
        }

        $updateData = [
            'clock_out' => now(),
            'latitude_out' => $data['latitude'] ?? null,
            'longitude_out' => $data['longitude'] ?? null,
            'notes' => $data['notes'] ?? $openEntry->notes,
        ];

        $openEntry->update($updateData);

        return $openEntry->fresh();
    }

    /**
     * Auto clock-in when technician starts a work order.
     */
    public function autoClockInFromOS(User $user, int $workOrderId, ?array $gpsData = null): ?TimeClockEntry
    {
        // Don't auto-clock if there's already an open entry
        $existing = TimeClockEntry::where('user_id', $user->id)
            ->whereNull('clock_out')
            ->first();

        if ($existing) {
            return null; // Already clocked in
        }

        return $this->clockIn($user, [
            'type' => 'regular',
            'clock_method' => 'auto_os',
            'work_order_id' => $workOrderId,
            'latitude' => $gpsData['latitude'] ?? null,
            'longitude' => $gpsData['longitude'] ?? null,
            'liveness_score' => 1.0, // Auto = trusted
        ]);
    }

    /**
     * Request a time adjustment.
     */
    public function requestAdjustment(User $requester, int $entryId, array $data): TimeClockAdjustment
    {
        $entry = TimeClockEntry::findOrFail($entryId);

        return TimeClockAdjustment::create([
            'tenant_id' => $requester->tenant_id,
            'time_clock_entry_id' => $entry->id,
            'requested_by' => $requester->id,
            'original_clock_in' => $entry->clock_in,
            'original_clock_out' => $entry->clock_out,
            'adjusted_clock_in' => $data['adjusted_clock_in'] ?? null,
            'adjusted_clock_out' => $data['adjusted_clock_out'] ?? null,
            'reason' => $data['reason'],
            'status' => 'pending',
        ]);
    }

    /**
     * Approve a time adjustment.
     */
    public function approveAdjustment(int $adjustmentId, User $approver): TimeClockAdjustment
    {
        $adjustment = TimeClockAdjustment::findOrFail($adjustmentId);

        if ($adjustment->status !== 'pending') {
            throw new \DomainException('Este ajuste já foi processado.');
        }

        DB::beginTransaction();
        try {
            $adjustment->update([
                'status' => 'approved',
                'approved_by' => $approver->id,
                'decided_at' => now(),
            ]);

            // Apply adjustment to the original entry
            $entry = $adjustment->entry;
            $updateData = [];
            if ($adjustment->adjusted_clock_in) {
                $updateData['clock_in'] = $adjustment->adjusted_clock_in;
            }
            if ($adjustment->adjusted_clock_out) {
                $updateData['clock_out'] = $adjustment->adjusted_clock_out;
            }
            if (!empty($updateData)) {
                $entry->update($updateData);
            }

            DB::commit();
            return $adjustment->fresh();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Reject a time adjustment.
     */
    public function rejectAdjustment(int $adjustmentId, User $approver, string $reason): TimeClockAdjustment
    {
        $adjustment = TimeClockAdjustment::findOrFail($adjustmentId);

        if ($adjustment->status !== 'pending') {
            throw new \DomainException('Este ajuste já foi processado.');
        }

        $adjustment->update([
            'status' => 'rejected',
            'approved_by' => $approver->id,
            'rejection_reason' => $reason,
            'decided_at' => now(),
        ]);

        return $adjustment->fresh();
    }

    /**
     * Approve a pending clock entry.
     */
    public function approveClockEntry(int $entryId, User $approver): TimeClockEntry
    {
        $entry = TimeClockEntry::findOrFail($entryId);

        if ($entry->approval_status !== 'pending') {
            throw new \DomainException('Este ponto não está pendente de aprovação.');
        }

        $entry->update([
            'approval_status' => 'approved',
            'approved_by' => $approver->id,
        ]);

        return $entry->fresh();
    }

    /**
     * Reject a pending clock entry.
     */
    public function rejectClockEntry(int $entryId, User $approver, string $reason): TimeClockEntry
    {
        $entry = TimeClockEntry::findOrFail($entryId);

        if ($entry->approval_status !== 'pending') {
            throw new \DomainException('Este ponto não está pendente de aprovação.');
        }

        $entry->update([
            'approval_status' => 'rejected',
            'approved_by' => $approver->id,
            'rejection_reason' => $reason,
        ]);

        return $entry->fresh();
    }

    /**
     * Store selfie to disk with hashed filename.
     */
    private function storeSelfie($file, int $userId): string
    {
        $filename = 'selfie_' . $userId . '_' . now()->format('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.jpg';
        $path = "hr/selfies/{$userId}/{$filename}";

        if (is_string($file) && str_starts_with($file, 'data:image')) {
            // Base64 encoded image
            $imageData = explode(',', $file, 2)[1] ?? $file;
            Storage::disk('local')->put($path, base64_decode($imageData));
        } else {
            // Uploaded file
            Storage::disk('local')->putFileAs("hr/selfies/{$userId}", $file, $filename);
        }

        return $path;
    }
}
