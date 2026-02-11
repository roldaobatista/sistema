<?php

namespace App\Events;

use App\Models\EquipmentCalibration;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CalibrationExpiring
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public EquipmentCalibration $calibration,
        public int $daysUntilExpiry,
    ) {}
}
