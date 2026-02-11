<?php

namespace App\Enums;

enum QuoteStatus: string
{
    case DRAFT = 'draft';
    case SENT = 'sent';
    case APPROVED = 'approved';
    case REJECTED = 'rejected';
    case EXPIRED = 'expired';
    case INVOICED = 'invoiced';

    public function label(): string
    {
        return match ($this) {
            self::DRAFT => 'Rascunho',
            self::SENT => 'Enviado',
            self::APPROVED => 'Aprovado',
            self::REJECTED => 'Rejeitado',
            self::EXPIRED => 'Expirado',
            self::INVOICED => 'Faturado',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::DRAFT => 'bg-surface-100 text-surface-700',
            self::SENT => 'bg-blue-100 text-blue-700',
            self::APPROVED => 'bg-emerald-100 text-emerald-700',
            self::REJECTED => 'bg-red-100 text-red-700',
            self::EXPIRED => 'bg-amber-100 text-amber-700',
            self::INVOICED => 'bg-purple-100 text-purple-700',
        };
    }

    /** Statuses que permitem edição */
    public function isMutable(): bool
    {
        return in_array($this, [self::DRAFT, self::REJECTED], true);
    }
}
