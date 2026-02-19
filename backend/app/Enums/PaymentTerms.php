<?php

namespace App\Enums;

enum PaymentTerms: string
{
    case A_VISTA = 'a_vista';
    case BOLETO_30 = 'boleto_30';
    case BOLETO_30_60 = 'boleto_30_60';
    case BOLETO_30_60_90 = 'boleto_30_60_90';
    case CARTAO = 'cartao';
    case PIX = 'pix';
    case PARCELADO_2X = 'parcelado_2x';
    case PARCELADO_3X = 'parcelado_3x';
    case PARCELADO_6X = 'parcelado_6x';
    case PARCELADO_10X = 'parcelado_10x';
    case PARCELADO_12X = 'parcelado_12x';
    case A_COMBINAR = 'a_combinar';
    case PERSONALIZADO = 'personalizado';

    public function label(): string
    {
        return match ($this) {
            self::A_VISTA => 'À Vista',
            self::BOLETO_30 => 'Boleto 30 dias',
            self::BOLETO_30_60 => 'Boleto 30/60 dias',
            self::BOLETO_30_60_90 => 'Boleto 30/60/90 dias',
            self::CARTAO => 'Cartão de Crédito',
            self::PIX => 'PIX',
            self::PARCELADO_2X => 'Parcelado 2x',
            self::PARCELADO_3X => 'Parcelado 3x',
            self::PARCELADO_6X => 'Parcelado 6x',
            self::PARCELADO_10X => 'Parcelado 10x',
            self::PARCELADO_12X => 'Parcelado 12x',
            self::A_COMBINAR => 'A Combinar',
            self::PERSONALIZADO => 'Personalizado',
        };
    }

    public function installments(): ?int
    {
        return match ($this) {
            self::PARCELADO_2X => 2,
            self::PARCELADO_3X => 3,
            self::PARCELADO_6X => 6,
            self::PARCELADO_10X => 10,
            self::PARCELADO_12X => 12,
            default => null,
        };
    }
}
