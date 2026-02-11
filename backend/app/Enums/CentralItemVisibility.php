<?php

namespace App\Enums;

enum CentralItemVisibility: string
{
    case PRIVADO = 'PRIVADO';
    case EQUIPE = 'EQUIPE';
    case EMPRESA = 'EMPRESA';

    public function label(): string
    {
        return match($this) {
            self::PRIVADO => 'Privado',
            self::EQUIPE => 'Equipe',
            self::EMPRESA => 'Empresa',
        };
    }
}
