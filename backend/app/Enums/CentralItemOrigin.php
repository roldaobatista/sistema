<?php

namespace App\Enums;

enum CentralItemOrigin: string
{
    case MANUAL = 'MANUAL';
    case AUTO = 'AUTO';
    case JOB = 'JOB';

    public function label(): string
    {
        return match($this) {
            self::MANUAL => 'Manual',
            self::AUTO => 'Automático',
            self::JOB => 'Job/Sistema',
        };
    }
}
